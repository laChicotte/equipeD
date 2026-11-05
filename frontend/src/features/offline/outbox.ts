'use client';

import type { QueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { api, isApiError } from '@/lib/api';
import { offlineStorage } from './cache';

/**
 * File d'envoi : les messages écrits sans réseau sont gardés sur l'appareil, puis envoyés dans
 * l'ordre au retour de la connexion. L'identifiant `clientId` évite tout doublon côté serveur si
 * la réponse à un envoi réussi s'est perdue. Texte seulement : pas de fichier en file d'attente.
 */
export type ThreadKind = 'direct' | 'group';

export interface OutboxEntry {
  clientId: string;
  kind: ThreadKind;
  threadId: string;
  userId: string;
  content: string;
  createdAt: string;
  /** Refusé par le serveur : la personne décide de réessayer ou de supprimer. */
  error?: string;
}

const KEY = 'outbox';
const EMPTY: OutboxEntry[] = [];
let entries: OutboxEntry[] = EMPTY;
let loaded: Promise<void> | undefined;
let flushing = false;
const listeners = new Set<() => void>();

function update(next: OutboxEntry[]) {
  entries = next;
  listeners.forEach((l) => l());
  void offlineStorage.set(KEY, next).catch(() => undefined);
}

export function loadOutbox() {
  loaded ??= offlineStorage
    .get<OutboxEntry[]>(KEY)
    .then((saved) => {
      if (saved?.length) {
        entries = saved;
        listeners.forEach((l) => l());
      }
    })
    .catch(() => undefined);
  return loaded;
}

/** Vide la mémoire : le contenu du stockage est effacé par `clearOfflineData`. */
export function resetOutbox() {
  loaded = undefined;
  if (entries.length === 0) return;
  entries = EMPTY;
  listeners.forEach((l) => l());
}

export function newClientId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function enqueueMessage(entry: Omit<OutboxEntry, 'createdAt'>) {
  update([...entries, { ...entry, createdAt: new Date().toISOString() }]);
}

export function removeFromOutbox(clientId: string) {
  update(entries.filter((e) => e.clientId !== clientId));
}

export function retryOutboxEntry(clientId: string, qc: QueryClient) {
  update(entries.map((e) => (e.clientId === clientId ? { ...e, error: undefined } : e)));
  void flushOutbox(qc);
}

function pathFor(entry: OutboxEntry) {
  return entry.kind === 'direct'
    ? `/mentorships/${entry.threadId}/messages`
    : `/groups/${entry.threadId}/messages`;
}

/** Envoie la file dans l'ordre ; s'arrête à la première coupure pour conserver cet ordre. */
export async function flushOutbox(qc: QueryClient) {
  if (flushing) return;
  flushing = true;
  try {
    await loadOutbox();
    for (const entry of entries.filter((e) => !e.error)) {
      try {
        await api(pathFor(entry), {
          method: 'POST',
          body: { content: entry.content, clientId: entry.clientId },
        });
        removeFromOutbox(entry.clientId);
        const root = entry.kind === 'direct' ? 'mentorships' : 'groups';
        void qc.invalidateQueries({ queryKey: [root, entry.threadId, 'messages'] });
        void qc.invalidateQueries({ queryKey: [root, 'me'] });
      } catch (error) {
        const rejected =
          isApiError(error) &&
          error.statusCode >= 400 &&
          error.statusCode < 500 &&
          error.statusCode !== 401 &&
          error.statusCode !== 429;
        if (!rejected) return; // réseau, session ou serveur : on réessaiera plus tard
        update(
          entries.map((e) => (e.clientId === entry.clientId ? { ...e, error: error.message } : e)),
        );
      }
    }
  } finally {
    flushing = false;
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useOutbox() {
  return useSyncExternalStore(
    subscribe,
    () => entries,
    () => EMPTY,
  );
}
