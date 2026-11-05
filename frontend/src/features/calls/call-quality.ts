'use client';

import { useEffect, useState } from 'react';

/**
 * Sobriété des appels : sur réseau mobile, chaque mégaoctet compte.
 *
 * - Audio : débit Opus plafonné à 32 kbit/s, largement suffisant pour la voix.
 * - Vidéo « économie de données » : 150 kbit/s et résolution divisée par deux.
 * Le compteur affiché pendant l'appel est mesuré par le navigateur (statistiques WebRTC),
 * pas estimé.
 */
export const AUDIO_MAX_BITRATE = 32_000;
export const VIDEO_SAVER_MAX_BITRATE = 150_000;

async function tune(sender: RTCRtpSender, patch: Partial<RTCRtpEncodingParameters>) {
  const params = sender.getParameters();
  if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
  params.encodings = params.encodings.map((e) => ({ ...e, ...patch }));
  await sender.setParameters(params).catch(() => undefined);
}

/** Plafonne le débit audio émis (appelé une fois la connexion établie). */
export async function limitAudio(pc: RTCPeerConnection) {
  for (const sender of pc.getSenders()) {
    if (sender.track?.kind === 'audio') await tune(sender, { maxBitrate: AUDIO_MAX_BITRATE });
  }
}

/** Active ou désactive l'économie de données sur la vidéo émise. */
export async function setVideoSaver(pc: RTCPeerConnection, on: boolean) {
  for (const sender of pc.getSenders()) {
    if (sender.track?.kind !== 'video') continue;
    await tune(
      sender,
      on
        ? { maxBitrate: VIDEO_SAVER_MAX_BITRATE, scaleResolutionDownBy: 2 }
        : { maxBitrate: undefined, scaleResolutionDownBy: 1 },
    );
  }
}

/** Octets envoyés et reçus depuis le début de l'appel, mesurés par le navigateur. */
async function measureBytes(pc: RTCPeerConnection): Promise<number | null> {
  const stats = await pc.getStats();
  let transport: number | null = null;
  let pair: number | null = null;
  stats.forEach((report) => {
    if (report.type === 'transport' && typeof report.bytesSent === 'number') {
      transport = (transport ?? 0) + report.bytesSent + (report.bytesReceived ?? 0);
    }
    if (
      report.type === 'candidate-pair' &&
      (report.nominated || report.selected) &&
      typeof report.bytesSent === 'number'
    ) {
      pair = Math.max(pair ?? 0, report.bytesSent + (report.bytesReceived ?? 0));
    }
  });
  return transport ?? pair;
}

/** Consommation de données de l'appel en cours, actualisée toutes les 2 secondes. */
export function useCallDataUsage(getPeer: () => RTCPeerConnection | null, active: boolean) {
  const [bytes, setBytes] = useState<number | null>(null);
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    const tick = async () => {
      const pc = getPeer();
      if (!pc) return;
      const value = await measureBytes(pc).catch(() => null);
      if (!stopped && value !== null) setBytes(value);
    };
    void tick();
    const timer = setInterval(() => void tick(), 2000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [getPeer, active]);
  return bytes;
}

export function formatMegabytes(bytes: number): string {
  const mb = bytes / 1_000_000;
  return `${mb.toLocaleString('fr-FR', { maximumFractionDigits: mb < 10 ? 2 : 1 })} Mo`;
}
