import { createHmac } from 'node:crypto';
import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { AppConfigService } from '../../config/app-config.service.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { conflict, forbidden, isConstraintViolation, notFound } from '../../common/errors.js';
import type { CallKind, CallStatus } from '../../generated/prisma/enums.js';
import { MentorshipAccessService } from '../mentorships/mentorship-access.service.js';
import { RealtimeService, type RealtimeClient } from '../realtime/realtime.service.js';

/** Durée de sonnerie avant « appel manqué ». */
export const RING_TIMEOUT_MS = 40_000;
/** Durée de validité des identifiants TURN délivrés. */
const TURN_TTL_SECONDS = 6 * 3600;

interface LiveCall {
  id: string;
  mentorshipId: string;
  kind: CallKind;
  callerId: string;
  calleeId: string;
  callerClientId: string;
  calleeClientId?: string;
  answeredAt?: Date;
  timer?: NodeJS.Timeout;
}

type EndReason = 'missed' | 'declined' | 'cancelled' | 'hangup' | 'disconnected' | 'unavailable';

const KIND_LABEL: Record<CallKind, string> = { AUDIO: 'Appel audio', VIDEO: 'Appel vidéo' };

function duration(ms: number) {
  const total = Math.max(1, Math.round(ms / 1000));
  const min = Math.floor(total / 60);
  const sec = total % 60;
  if (min === 0) return `${sec} s`;
  return sec === 0 ? `${min} min` : `${min} min ${sec} s`;
}

/** Compte rendu inscrit dans la conversation, comme sur une messagerie mobile. */
export function callSummary(kind: CallKind, status: CallStatus, durationMs = 0) {
  switch (status) {
    case 'ENDED':
      return `${KIND_LABEL[kind]} · ${duration(durationMs)}`;
    case 'DECLINED':
      return `${KIND_LABEL[kind]} refusé`;
    default:
      return `${KIND_LABEL[kind]} manqué`;
  }
}

const str = (v: unknown) => (typeof v === 'string' && v.length > 0 && v.length <= 64 ? v : null);

/**
 * Appels audio et vidéo entre les deux participants d'un mentorat (WebRTC pair à pair).
 * Le serveur sonne, relaie la signalisation (SDP, candidats ICE) entre les deux navigateurs et
 * inscrit le compte rendu de l'appel dans la conversation. Aucun flux média ne passe par l'API.
 */
@Injectable()
export class CallsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('Calls');
  private readonly live = new Map<string, LiveCall>();
  private readonly busy = new Map<string, string>(); // userId → callId

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly access: MentorshipAccessService,
    private readonly realtime: RealtimeService,
  ) {}

  async onApplicationBootstrap() {
    // Après un redémarrage, aucun appel ne peut être en cours : on clôt les traces orphelines.
    const now = new Date();
    await this.prisma.call.updateMany({
      where: { status: 'RINGING' },
      data: { status: 'MISSED', endedAt: now },
    });
    await this.prisma.call.updateMany({
      where: { status: 'ACTIVE' },
      data: { status: 'ENDED', endedAt: now },
    });

    this.realtime.on('call:invite', (c, d) => this.invite(c, d));
    this.realtime.on('call:accept', (c, d) => this.accept(c, d));
    this.realtime.on('call:decline', (c, d) => this.decline(c, d));
    this.realtime.on('call:hangup', (c, d) => this.hangup(c, d));
    this.realtime.on('call:signal', (c, d) => this.signal(c, d));
    this.realtime.onDisconnect((c) => this.onDisconnect(c));
  }

  onModuleDestroy() {
    for (const call of this.live.values()) clearTimeout(call.timer);
  }

  /** Serveurs STUN/TURN pour RTCPeerConnection ; identifiants TURN temporaires (coturn use-auth-secret). */
  iceServers(user: AuthUser) {
    const servers: { urls: string[]; username?: string; credential?: string }[] = [];
    const stun = this.config.get('STUN_URLS');
    if (stun.length) servers.push({ urls: stun });
    const turn = this.config.get('TURN_URLS');
    if (turn.length) {
      const username = `${Math.floor(Date.now() / 1000) + TURN_TTL_SECONDS}:${user.id}`;
      const credential = createHmac('sha1', this.config.get('TURN_SECRET'))
        .update(username)
        .digest('base64');
      servers.push({ urls: turn, username, credential });
    }
    return { iceServers: servers, ringTimeoutMs: RING_TIMEOUT_MS };
  }

  /** Appel en cours de l'utilisateur (pour reprendre l'état après un rechargement de page). */
  current(userId: string) {
    const id = this.busy.get(userId);
    return id ? (this.live.get(id) ?? null) : null;
  }

  // ─── Événements ──────────────────────────────────────────────────────────

  private async invite(client: RealtimeClient, data: unknown) {
    const d = data as { mentorshipId?: unknown; kind?: unknown };
    const mentorshipId = str(d.mentorshipId);
    const kind = d.kind === 'VIDEO' ? 'VIDEO' : d.kind === 'AUDIO' ? 'AUDIO' : null;
    if (!mentorshipId || !kind) throw notFound('MENTORSHIP_NOT_FOUND', 'Mentorat introuvable.');

    const user = client.user;
    const access = await this.access.assertMessagingParticipant(user, mentorshipId);
    if (this.busy.has(user.id)) {
      throw conflict('CALL_IN_PROGRESS', 'Vous êtes déjà en communication.');
    }
    const calleeId = access.counterpartId;

    // Personne injoignable ou déjà en ligne : l'appel est tracé comme manqué, sans sonnerie.
    const unavailable = !this.realtime.isOnline(calleeId) ? 'unavailable' : null;
    const busy = this.busy.has(calleeId) ? 'busy' : null;
    if (unavailable || busy) {
      const call = await this.prisma.call.create({
        data: {
          mentorshipId,
          callerId: user.id,
          calleeId,
          kind,
          status: 'MISSED',
          endedAt: new Date(),
        },
        select: { id: true },
      });
      await this.record(call.id, mentorshipId, user.id, calleeId, kind, 'MISSED');
      this.realtime.send(client, 'call:ended', {
        callId: call.id,
        reason: unavailable ?? 'busy',
      });
      return;
    }

    let callId: string;
    try {
      callId = (
        await this.prisma.call.create({
          data: { mentorshipId, callerId: user.id, calleeId, kind },
          select: { id: true },
        })
      ).id;
    } catch (error) {
      if (isConstraintViolation(error, 'calls_one_live_per_mentorship')) {
        throw conflict('CALL_IN_PROGRESS', 'Un appel est déjà en cours dans ce mentorat.');
      }
      throw error;
    }

    const call: LiveCall = {
      id: callId,
      mentorshipId,
      kind,
      callerId: user.id,
      calleeId,
      callerClientId: client.id,
    };
    call.timer = setTimeout(() => void this.finish(call, 'MISSED', 'missed'), RING_TIMEOUT_MS);
    call.timer.unref();
    this.live.set(callId, call);
    this.busy.set(user.id, callId);
    this.busy.set(calleeId, callId);

    const caller = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { id: true, firstName: true, lastName: true, avatarUpdatedAt: true },
    });
    this.realtime.emitToUser(calleeId, 'call:incoming', { callId, kind, mentorshipId, caller });
    this.realtime.send(client, 'call:ringing', { callId, kind, mentorshipId });
  }

  private async accept(client: RealtimeClient, data: unknown) {
    const call = this.ownCall(client, data, 'callee');
    if (call.answeredAt) throw conflict('CALL_ALREADY_ANSWERED', 'Cet appel a déjà été décroché.');
    clearTimeout(call.timer);
    call.answeredAt = new Date();
    call.calleeClientId = client.id;
    await this.prisma.call.update({
      where: { id: call.id },
      data: { status: 'ACTIVE', answeredAt: call.answeredAt },
    });
    const caller = this.realtime.findClient(call.callerId, call.callerClientId);
    if (!caller) return this.finish(call, 'ENDED', 'disconnected');
    this.realtime.send(caller, 'call:accepted', { callId: call.id });
    this.realtime.send(client, 'call:connected', { callId: call.id });
    // Les autres onglets ou appareils de la personne appelée cessent de sonner.
    this.realtime.emitToUser(
      call.calleeId,
      'call:ended',
      { callId: call.id, reason: 'answered-elsewhere' },
      client.id,
    );
  }

  private async decline(client: RealtimeClient, data: unknown) {
    const call = this.ownCall(client, data, 'callee');
    if (call.answeredAt) throw conflict('CALL_ALREADY_ANSWERED', 'Cet appel a déjà été décroché.');
    await this.finish(call, 'DECLINED', 'declined');
  }

  private async hangup(client: RealtimeClient, data: unknown) {
    const call = this.ownCall(client, data, 'any');
    if (call.answeredAt) await this.finish(call, 'ENDED', 'hangup');
    else if (client.user.id === call.callerId) await this.finish(call, 'CANCELLED', 'cancelled');
    else await this.finish(call, 'DECLINED', 'declined');
  }

  /** Relais SDP / candidats ICE vers l'autre participant, uniquement pendant un appel décroché. */
  private signal(client: RealtimeClient, data: unknown) {
    const d = data as { payload?: unknown };
    const call = this.ownCall(client, data, 'any');
    if (!call.answeredAt)
      throw conflict('CALL_NOT_ANSWERED', 'L’appel n’a pas encore été décroché.');
    const mine = client.user.id === call.callerId ? call.callerClientId : call.calleeClientId;
    if (mine !== client.id)
      throw forbidden('CALL_OTHER_DEVICE', 'Cet appel est en cours sur un autre appareil.');
    const otherId = client.user.id === call.callerId ? call.calleeId : call.callerId;
    const otherClientId =
      client.user.id === call.callerId ? call.calleeClientId : call.callerClientId;
    const other = this.realtime.findClient(otherId, otherClientId);
    if (other) this.realtime.send(other, 'call:signal', { callId: call.id, payload: d.payload });
  }

  private onDisconnect(client: RealtimeClient) {
    const callId = this.busy.get(client.user.id);
    const call = callId ? this.live.get(callId) : undefined;
    if (!call) return;
    const bound =
      (client.user.id === call.callerId && call.callerClientId === client.id) ||
      (client.user.id === call.calleeId && call.calleeClientId === client.id);
    if (!bound) return; // un autre onglet de la personne appelée qui se ferme pendant la sonnerie
    void this.finish(call, call.answeredAt ? 'ENDED' : 'CANCELLED', 'disconnected');
  }

  // ─── Outils ──────────────────────────────────────────────────────────────

  private ownCall(client: RealtimeClient, data: unknown, role: 'callee' | 'any') {
    const callId = str((data as { callId?: unknown }).callId);
    const call = callId ? this.live.get(callId) : undefined;
    const uid = client.user.id;
    const participant = call && (call.callerId === uid || call.calleeId === uid);
    if (!call || !participant) throw notFound('CALL_NOT_FOUND', 'Cet appel est terminé.');
    if (role === 'callee' && call.calleeId !== uid) {
      throw forbidden('NOT_CALLEE', 'Seule la personne appelée peut répondre.');
    }
    return call;
  }

  private async finish(call: LiveCall, status: CallStatus, reason: EndReason) {
    if (!this.live.delete(call.id)) return; // déjà terminé
    clearTimeout(call.timer);
    if (this.busy.get(call.callerId) === call.id) this.busy.delete(call.callerId);
    if (this.busy.get(call.calleeId) === call.id) this.busy.delete(call.calleeId);

    const endedAt = new Date();
    try {
      await this.prisma.call.update({ where: { id: call.id }, data: { status, endedAt } });
      const ms = call.answeredAt ? endedAt.getTime() - call.answeredAt.getTime() : 0;
      await this.record(
        call.id,
        call.mentorshipId,
        call.callerId,
        call.calleeId,
        call.kind,
        status,
        ms,
      );
    } catch (error) {
      this.logger.warn(`Fin d'appel ${call.id} non enregistrée : ${(error as Error).message}`);
    }
    this.realtime.emitToUsers([call.callerId, call.calleeId], 'call:ended', {
      callId: call.id,
      reason,
    });
  }

  /** Inscrit le compte rendu dans la conversation et prévient les deux participants. */
  private async record(
    callId: string,
    mentorshipId: string,
    callerId: string,
    calleeId: string,
    kind: CallKind,
    status: CallStatus,
    durationMs = 0,
  ) {
    const now = new Date();
    await this.prisma.message.create({
      data: {
        mentorshipId,
        senderId: callerId,
        callId,
        content: callSummary(kind, status, durationMs),
        // Un appel décroché a été vécu par les deux : rien à « lire ». Un appel manqué reste non lu.
        readAt: status === 'ENDED' ? now : null,
      },
    });
    this.realtime.emitToUsers([callerId, calleeId], 'message:new', { mentorshipId });
  }
}
