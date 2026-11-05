'use client';

import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { isOnline, useOnline } from '@/lib/connectivity';
import { isDataSaverOn } from '@/lib/data-saver';
import type { GroupSummary, Me, MentorshipSummary } from '@/lib/types';
import { clearOfflineData } from './cache';
import { flushOutbox, loadOutbox, resetOutbox } from './outbox';

const RECENT_THREADS = 5;
const PRELOAD_DELAY_MS = 4_000;

/**
 * Prépare la relecture hors ligne après la connexion : dernières conversations, séances et
 * objectifs, et pages de l'espace connecté. Rien de tout cela en économie de données.
 */
async function preload(qc: QueryClient) {
  const fetchInto = <T>(
    queryKey: unknown[],
    path: string,
    query?: Record<string, number | string>,
  ) => qc.fetchQuery({ queryKey, queryFn: () => api<T>(path, { query }), staleTime: 60_000 });

  const [mentorships, groups] = await Promise.all([
    fetchInto<MentorshipSummary[]>(['mentorships', 'me'], '/mentorships/me'),
    fetchInto<GroupSummary[]>(['groups', 'me'], '/groups/me'),
    fetchInto(['sessions', 'upcoming'], '/sessions/me', { scope: 'upcoming' }),
    fetchInto(['sessions', 'all'], '/sessions/me', { scope: 'all' }),
    fetchInto(['dashboard'], '/dashboard/me'),
  ]);
  const recent = [...mentorships]
    .sort(
      (a, b) =>
        new Date(b.lastMessage?.createdAt ?? b.startedAt).getTime() -
        new Date(a.lastMessage?.createdAt ?? a.startedAt).getTime(),
    )
    .slice(0, RECENT_THREADS);
  for (const m of recent) {
    await fetchInto(['mentorships', m.id], `/mentorships/${m.id}`);
    await fetchInto(['mentorships', m.id, 'messages'], `/mentorships/${m.id}/messages`, {
      limit: 100,
    });
    await fetchInto(['mentorships', m.id, 'goals'], `/mentorships/${m.id}/goals`);
  }
  for (const g of groups.slice(0, RECENT_THREADS)) {
    await fetchInto(['groups', g.id, 'messages'], `/groups/${g.id}/messages`, { limit: 100 });
  }
  if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage({
      type: 'CACHE_PAGES',
      urls: [
        '/tableau-de-bord',
        '/messages',
        '/seances',
        '/mentorats',
        '/mentorats/consultation',
        '/compte',
      ],
    });
  }
}

/** Une fois toutes les 10 minutes au plus : recharger une page ne recharge pas tout. */
const PRELOAD_KEY = 'tc-offline-preload';
function recentlyPreloaded(userId: string) {
  try {
    const [id, at] = (sessionStorage.getItem(PRELOAD_KEY) ?? '').split('|');
    return id === userId && Date.now() - Number(at) < 10 * 60_000;
  } catch {
    return false;
  }
}
function markPreloaded(userId: string) {
  try {
    sessionStorage.setItem(PRELOAD_KEY, `${userId}|${Date.now()}`);
  } catch {
    /* stockage indisponible : le préchargement sera simplement refait */
  }
}

/**
 * Vie de la session sur l'appareil : efface les données privées dès qu'il n'y a plus de session,
 * envoie la file de messages au retour du réseau et prépare le mode hors ligne.
 * `me` : undefined pendant le chargement, null sans session.
 */
export function useOfflineSession(me: Me | null | undefined) {
  const qc = useQueryClient();
  const online = useOnline();
  const preloadedFor = useRef<string | null>(null);

  useEffect(() => {
    if (me !== null) return;
    preloadedFor.current = null;
    qc.removeQueries({ predicate: (q) => !['domains', 'auth'].includes(String(q.queryKey[0])) });
    resetOutbox();
    void clearOfflineData();
  }, [me, qc]);

  useEffect(() => {
    if (me) void loadOutbox();
    if (me && online) void flushOutbox(qc);
  }, [me, online, qc]);

  useEffect(() => {
    if (!me || !online || me.role === 'ADMIN' || !me.hasProfile) return;
    if (preloadedFor.current === me.id || isDataSaverOn() || recentlyPreloaded(me.id)) return;
    const timer = setTimeout(() => {
      if (!isOnline()) return;
      preloadedFor.current = me.id;
      markPreloaded(me.id);
      void preload(qc).catch(() => undefined);
    }, PRELOAD_DELAY_MS);
    return () => clearTimeout(timer);
  }, [me, online, qc]);
}
