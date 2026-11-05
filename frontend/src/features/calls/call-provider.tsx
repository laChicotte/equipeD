'use client';

import { Gauge, Mic, MicOff, Phone, PhoneIncoming, PhoneOff, Video, VideoOff } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/avatar';
import { api } from '@/lib/api';
import { fullName } from '@/lib/format';
import { useRealtime, type RealtimeEvent } from '@/lib/realtime';
import type { PersonRef } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatMegabytes, limitAudio, setVideoSaver, useCallDataUsage } from './call-quality';
import { startTone, type Tone } from './tones';

export type CallKind = 'AUDIO' | 'VIDEO';

type CallState =
  | { phase: 'idle' }
  | {
      phase: 'outgoing' | 'incoming' | 'connecting' | 'active';
      callId: string | null;
      kind: CallKind;
      mentorshipId: string;
      peer: PersonRef;
      startedAt?: number;
    };

interface CallsContextValue {
  state: CallState;
  /** Lance un appel vers l'autre participant du mentorat. */
  startCall: (mentorshipId: string, kind: CallKind, peer: PersonRef) => void;
  available: boolean;
}

const CallsContext = createContext<CallsContextValue | null>(null);

const END_MESSAGES: Record<string, string> = {
  declined: 'Appel refusé.',
  missed: 'Pas de réponse.',
  unavailable: 'Cette personne n’est pas connectée : elle verra votre appel manqué.',
  busy: 'Cette personne est déjà en communication.',
  disconnected: 'La communication a été interrompue.',
};

type SignalPayload = { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };

interface IceConfig {
  iceServers: RTCIceServer[];
  ringTimeoutMs: number;
}

function mediaError(error: unknown) {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError') {
    return 'Accès au micro ou à la caméra refusé : autorisez-le dans votre navigateur.';
  }
  if (name === 'NotFoundError') return 'Aucun micro ou caméra détecté sur cet appareil.';
  if (!window.isSecureContext) {
    return 'Les appels nécessitent une connexion sécurisée (https ou localhost).';
  }
  return 'Impossible d’accéder au micro ou à la caméra.';
}

/**
 * Appels audio et vidéo pair à pair (WebRTC). La signalisation passe par le canal temps réel ;
 * les flux audio et vidéo vont directement d'un navigateur à l'autre (ou via le relais TURN).
 */
export function CallProvider({ children }: { children: ReactNode }) {
  const realtime = useRealtime();
  const [state, setRenderedState] = useState<CallState>({ phase: 'idle' });
  // Copie synchrone de l'état pour les gestionnaires d'événements (WebSocket, WebRTC).
  const stateRef = useRef<CallState>({ phase: 'idle' });
  const setState = useCallback((next: CallState | ((prev: CallState) => CallState)) => {
    stateRef.current = typeof next === 'function' ? next(stateRef.current) : next;
    setRenderedState(stateRef.current);
  }, []);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  /** Signaux reçus avant que la connexion locale soit prête (offre arrivée très vite). */
  const pendingSignals = useRef<SignalPayload[]>([]);
  const [, setTrackVersion] = useState(0);
  const toneRef = useRef<Tone | null>(null);
  const iceRef = useRef<IceConfig | null>(null);

  const stopTone = () => {
    toneRef.current?.stop();
    toneRef.current = null;
  };

  const cleanup = useCallback(() => {
    stopTone();
    pcRef.current?.close();
    pcRef.current = null;
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    pendingCandidates.current = [];
    pendingSignals.current = [];
    setLocalStream(null);
    setRemoteStream(null);
    setState({ phase: 'idle' });
  }, [setState]);

  const iceConfig = async () => {
    iceRef.current ??= await api<IceConfig>('/calls/config');
    return iceRef.current;
  };

  const getMedia = async (kind: CallKind) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: kind === 'VIDEO' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
    });
    localRef.current = stream;
    setLocalStream(stream);
    return stream;
  };

  /** Connexion pair à pair : pistes locales, candidats ICE relayés, flux distant. */
  const createPeer = async (callId: string) => {
    const { iceServers } = await iceConfig();
    const pc = new RTCPeerConnection({ iceServers });
    pcRef.current = pc;
    localRef.current?.getTracks().forEach((track) => pc.addTrack(track, localRef.current!));
    pc.onicecandidate = (e) => {
      if (e.candidate)
        realtime.send('call:signal', { callId, payload: { candidate: e.candidate.toJSON() } });
    };
    pc.ontrack = (e) => {
      setRemoteStream(e.streams[0] ?? new MediaStream([e.track]));
      setTrackVersion((v) => v + 1); // une piste de plus dans le même flux : nouveau rendu
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        // Voix plafonnée à 32 kbit/s : appel praticable même sur une connexion mobile faible.
        void limitAudio(pc);
        setState((s) =>
          s.phase === 'idle' ? s : { ...s, phase: 'active', startedAt: s.startedAt ?? Date.now() },
        );
      } else if (pc.connectionState === 'failed') {
        toast.error(
          'La connexion a échoué : le réseau bloque l’appel (un relais TURN est nécessaire).',
        );
        realtime.send('call:hangup', { callId });
        cleanup();
      }
    };
    return pc;
  };

  const flushCandidates = async (pc: RTCPeerConnection) => {
    for (const c of pendingCandidates.current.splice(0)) {
      await pc.addIceCandidate(c).catch(() => undefined);
    }
  };

  const onSignal = async (callId: string, payload: SignalPayload) => {
    const pc = pcRef.current;
    if (!pc) {
      pendingSignals.current.push(payload);
      return;
    }
    if (payload.description) {
      await pc.setRemoteDescription(payload.description);
      if (payload.description.type === 'offer') {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        realtime.send('call:signal', {
          callId,
          payload: { description: pc.localDescription?.toJSON() },
        });
      }
      await flushCandidates(pc);
    } else if (payload.candidate) {
      if (pc.remoteDescription) await pc.addIceCandidate(payload.candidate).catch(() => undefined);
      else pendingCandidates.current.push(payload.candidate);
    }
  };

  // ─── Événements du serveur ───────────────────────────────────────────────
  useEffect(() => {
    return realtime.subscribe((event: RealtimeEvent) => {
      const s = stateRef.current;
      const callId = typeof event.callId === 'string' ? event.callId : null;
      switch (event.type) {
        case 'call:incoming': {
          if (s.phase !== 'idle' || !callId) return;
          setState({
            phase: 'incoming',
            callId,
            kind: event.kind as CallKind,
            mentorshipId: String(event.mentorshipId),
            peer: event.caller as PersonRef,
          });
          toneRef.current = startTone('ring');
          return;
        }
        case 'call:ringing':
          if (s.phase === 'outgoing') setState({ ...s, callId });
          return;
        case 'call:accepted': {
          if (s.phase !== 'outgoing' || s.callId !== callId || !callId) return;
          stopTone();
          setState({ ...s, phase: 'connecting' });
          void (async () => {
            const pc = await createPeer(callId);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            realtime.send('call:signal', {
              callId,
              payload: { description: pc.localDescription?.toJSON() },
            });
          })().catch(() => {
            toast.error('Impossible d’établir la communication.');
            realtime.send('call:hangup', { callId });
            cleanup();
          });
          return;
        }
        case 'call:connected': {
          if (s.phase !== 'connecting' || s.callId !== callId || !callId) return;
          void createPeer(callId)
            .then(async () => {
              for (const payload of pendingSignals.current.splice(0))
                await onSignal(callId, payload);
            })
            .catch(() => {
              realtime.send('call:hangup', { callId });
              cleanup();
            });
          return;
        }
        case 'call:signal':
          if (s.phase !== 'idle' && s.callId === callId && callId) {
            void onSignal(callId, event.payload as SignalPayload);
          }
          return;
        case 'call:ended': {
          if (s.phase === 'idle' || (s.callId && s.callId !== callId)) return;
          const reason = String(event.reason);
          const message =
            reason === 'hangup' && s.phase === 'active' ? 'Appel terminé.' : END_MESSAGES[reason];
          if (message && reason !== 'answered-elsewhere') toast(message);
          cleanup();
          return;
        }
        case 'error':
          if (typeof event.event === 'string' && event.event.startsWith('call:')) {
            toast.error(String(event.message));
            if (event.event === 'call:invite') cleanup();
          }
          return;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realtime.subscribe]);

  // Coupure du canal temps réel : l'appel ne peut pas continuer (le serveur le clôt aussi).
  useEffect(() => {
    if (!realtime.connected && stateRef.current.phase !== 'idle') {
      toast.error('Connexion perdue : l’appel est interrompu.');
      cleanup();
    }
  }, [realtime.connected, cleanup]);

  const startCall = useCallback(
    (mentorshipId: string, kind: CallKind, peer: PersonRef) => {
      if (stateRef.current.phase !== 'idle') return;
      if (!realtime.connected) {
        toast.error('Connexion temps réel indisponible : réessayez dans un instant.');
        return;
      }
      setState({ phase: 'outgoing', callId: null, kind, mentorshipId, peer });
      void (async () => {
        try {
          await iceConfig();
          await getMedia(kind);
        } catch (error) {
          toast.error(error instanceof DOMException ? mediaError(error) : 'Appel impossible.');
          cleanup();
          return;
        }
        toneRef.current = startTone('ringback');
        realtime.send('call:invite', { mentorshipId, kind });
      })();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [realtime.connected, realtime.send, cleanup],
  );

  const accept = async () => {
    const s = stateRef.current;
    if (s.phase !== 'incoming' || !s.callId) return;
    stopTone();
    try {
      await iceConfig();
      await getMedia(s.kind);
    } catch (error) {
      toast.error(error instanceof DOMException ? mediaError(error) : 'Appel impossible.');
      realtime.send('call:decline', { callId: s.callId });
      cleanup();
      return;
    }
    setState({ ...s, phase: 'connecting' });
    realtime.send('call:accept', { callId: s.callId });
  };

  const decline = () => {
    const s = stateRef.current;
    if (s.phase === 'incoming' && s.callId) realtime.send('call:decline', { callId: s.callId });
    cleanup();
  };

  const hangup = () => {
    const s = stateRef.current;
    if (s.phase !== 'idle' && s.callId) realtime.send('call:hangup', { callId: s.callId });
    cleanup();
  };

  const getPeer = useCallback(() => pcRef.current, []);

  const value = useMemo(
    () => ({ state, startCall, available: realtime.connected }),
    [state, startCall, realtime.connected],
  );

  return (
    <CallsContext.Provider value={value}>
      {children}
      {state.phase === 'incoming' && (
        <IncomingCall
          peer={state.peer}
          kind={state.kind}
          onAccept={() => void accept()}
          onDecline={decline}
        />
      )}
      {(state.phase === 'outgoing' || state.phase === 'connecting' || state.phase === 'active') && (
        <CallScreen
          state={state}
          localStream={localStream}
          remoteStream={remoteStream}
          getPeer={getPeer}
          onHangup={hangup}
        />
      )}
    </CallsContext.Provider>
  );
}

export function useCalls() {
  const ctx = useContext(CallsContext);
  if (!ctx) throw new Error('useCalls doit être utilisé dans CallProvider');
  return ctx;
}

// ─── Interface ──────────────────────────────────────────────────────────────

function IncomingCall({
  peer,
  kind,
  onAccept,
  onDecline,
}: {
  peer: PersonRef;
  kind: CallKind;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div
      role="alertdialog"
      aria-modal="false"
      aria-labelledby="appel-entrant-titre"
      className="fixed inset-x-3 bottom-24 z-[80] mx-auto max-w-sm animate-slide-up rounded-xl bg-ink-950 p-4 text-white shadow-raised sm:right-6 sm:bottom-6 sm:left-auto"
    >
      <div className="flex items-center gap-3">
        <span className="relative">
          <span
            className="absolute inset-0 animate-ping rounded-[30%] bg-teal-400/40"
            aria-hidden
          />
          <Avatar person={peer} size="lg" className="relative" />
        </span>
        <div className="min-w-0 flex-1">
          <p id="appel-entrant-titre" className="truncate text-[16px] font-semibold">
            {fullName(peer)}
          </p>
          <p className="flex items-center gap-1.5 text-[13px] text-ink-100">
            <PhoneIncoming className="size-3.5" aria-hidden />
            {kind === 'VIDEO' ? 'Appel vidéo entrant' : 'Appel audio entrant'}
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onDecline}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-red-600 font-semibold transition-colors hover:bg-red-700"
        >
          <PhoneOff className="size-4" aria-hidden />
          Refuser
        </button>
        <button
          type="button"
          onClick={onAccept}
          autoFocus
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-emerald-600 font-semibold transition-colors hover:bg-emerald-700"
        >
          {kind === 'VIDEO' ? (
            <Video className="size-4" aria-hidden />
          ) : (
            <Phone className="size-4" aria-hidden />
          )}
          Accepter
        </button>
      </div>
    </div>
  );
}

function useElapsed(startedAt?: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  if (!startedAt) return null;
  const s = Math.max(0, Math.floor((now - startedAt) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function MediaView({
  stream,
  muted,
  className,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} className={className} />;
}

function CallScreen({
  state,
  localStream,
  remoteStream,
  getPeer,
  onHangup,
}: {
  state: Extract<CallState, { phase: 'outgoing' | 'connecting' | 'active' | 'incoming' }>;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  getPeer: () => RTCPeerConnection | null;
  onHangup: () => void;
}) {
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [saver, setSaver] = useState(false);
  const dataUsed = useCallDataUsage(getPeer, state.phase === 'active');
  const elapsed = useElapsed(state.phase === 'active' ? state.startedAt : undefined);
  const video = state.kind === 'VIDEO';
  const remoteHasVideo = video && !!remoteStream?.getVideoTracks().length;

  const toggleMic = () => {
    localStream?.getAudioTracks().forEach((t) => (t.enabled = !micOn));
    setMicOn(!micOn);
  };
  const toggleCam = () => {
    localStream?.getVideoTracks().forEach((t) => (t.enabled = !camOn));
    setCamOn(!camOn);
  };
  const toggleSaver = () => {
    const pc = getPeer();
    if (pc) void setVideoSaver(pc, !saver);
    setSaver(!saver);
  };

  const status =
    state.phase === 'outgoing'
      ? state.callId
        ? 'Ça sonne…'
        : 'Appel en cours…'
      : state.phase === 'connecting'
        ? 'Connexion…'
        : (elapsed ?? '');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${video ? 'Appel vidéo' : 'Appel audio'} avec ${fullName(state.peer)}`}
      className="fixed inset-0 z-[80] flex flex-col bg-ink-950 text-white"
    >
      {/* Flux distant (vidéo) ou son seul (audio) */}
      {remoteHasVideo ? (
        <MediaView stream={remoteStream} className="absolute inset-0 size-full object-cover" />
      ) : (
        remoteStream && <MediaView stream={remoteStream} className="hidden" />
      )}

      <div
        className={cn(
          'relative z-10 flex flex-1 flex-col items-center px-6 text-center',
          remoteHasVideo ? 'justify-start pt-8' : 'justify-center',
        )}
      >
        {!remoteHasVideo && (
          <Avatar person={state.peer} size="xl" className="mb-5 size-28 text-4xl" />
        )}
        <p
          className={cn(
            'font-display text-[24px] font-semibold',
            remoteHasVideo && 'rounded-full bg-black/40 px-4 py-1 text-[16px]',
          )}
        >
          {fullName(state.peer)}
        </p>
        <p
          className={cn(
            'mt-1 text-[15px] text-ink-100 tabular-nums',
            remoteHasVideo && 'rounded-full bg-black/40 px-3',
          )}
          aria-live="polite"
        >
          {status}
        </p>
        {state.phase === 'active' && (
          <p
            className={cn(
              'mt-2 text-[13px] text-ink-100',
              remoteHasVideo && 'rounded-full bg-black/40 px-3 py-0.5',
            )}
          >
            {video
              ? saver
                ? 'Vidéo en économie de données'
                : 'Appel vidéo'
              : 'Appel audio · sobre en données'}
            {dataUsed !== null && <> · {formatMegabytes(dataUsed)} utilisés</>}
          </p>
        )}
      </div>

      {/* Aperçu de sa propre caméra */}
      {video && localStream && (
        <MediaView
          stream={localStream}
          muted
          className={cn(
            'absolute right-4 bottom-28 z-20 aspect-[3/4] w-28 rounded-lg bg-ink-900 object-cover shadow-raised ring-2 ring-white/20 sm:w-40 [transform:scaleX(-1)]',
            !camOn && 'opacity-0',
          )}
        />
      )}

      <div className="relative z-20 flex items-center justify-center gap-4 pb-10 pt-4">
        <button
          type="button"
          onClick={toggleMic}
          aria-pressed={!micOn}
          aria-label={micOn ? 'Couper le micro' : 'Réactiver le micro'}
          className={cn(
            'inline-flex size-14 items-center justify-center rounded-full transition-colors',
            micOn ? 'bg-white/15 hover:bg-white/25' : 'bg-white text-ink-950',
          )}
        >
          {micOn ? <Mic className="size-6" /> : <MicOff className="size-6" />}
        </button>
        {video && (
          <button
            type="button"
            onClick={toggleCam}
            aria-pressed={!camOn}
            aria-label={camOn ? 'Couper la caméra' : 'Réactiver la caméra'}
            className={cn(
              'inline-flex size-14 items-center justify-center rounded-full transition-colors',
              camOn ? 'bg-white/15 hover:bg-white/25' : 'bg-white text-ink-950',
            )}
          >
            {camOn ? <Video className="size-6" /> : <VideoOff className="size-6" />}
          </button>
        )}
        {video && (
          <button
            type="button"
            onClick={toggleSaver}
            aria-pressed={saver}
            aria-label={
              saver ? 'Désactiver l’économie de données' : 'Activer l’économie de données'
            }
            title="Économie de données : image allégée pour les connexions mobiles"
            className={cn(
              'inline-flex size-14 items-center justify-center rounded-full transition-colors',
              saver ? 'bg-white text-ink-950' : 'bg-white/15 hover:bg-white/25',
            )}
          >
            <Gauge className="size-6" />
          </button>
        )}
        <button
          type="button"
          onClick={onHangup}
          aria-label="Raccrocher"
          className="inline-flex size-16 items-center justify-center rounded-full bg-red-600 transition-colors hover:bg-red-700"
        >
          <PhoneOff className="size-7" />
        </button>
      </div>
    </div>
  );
}
