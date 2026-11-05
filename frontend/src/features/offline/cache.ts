'use client';

import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { Query } from '@tanstack/react-query';
import { clear, createStore, del, get, set, type UseStore } from 'idb-keyval';

/** Les données consultées restent lisibles hors ligne pendant 7 jours (durée d'une session). */
export const OFFLINE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

let store: UseStore | undefined;
const idb = () => (store ??= createStore('talents-connectes', 'offline'));

export const offlineStorage = {
  get: <T>(key: string) => get<T>(key, idb()),
  set: (key: string, value: unknown) => set(key, value, idb()),
};

export const queryPersister = createAsyncStoragePersister({
  key: 'query-cache',
  throttleTime: 2_000,
  storage: {
    getItem: async (key) => (await get<string>(key, idb())) ?? null,
    setItem: (key, value) => set(key, value, idb()),
    removeItem: (key) => del(key, idb()),
  },
});

/**
 * Seules les données utiles à la relecture sont écrites sur l'appareil. Les recherches,
 * l'administration et l'assistant restent en mémoire. Rien des pages publiques non plus : restauré
 * avant l'hydratation, leur contenu différerait du HTML du serveur.
 */
const PERSISTED_ROOTS = new Set([
  'auth',
  'profile',
  'dashboard',
  'mentorships',
  'sessions',
  'groups',
]);

export function shouldPersistQuery(query: Query) {
  const [root, second] = query.queryKey;
  if (query.state.status !== 'success' || query.state.data == null) return false;
  if (root === 'groups' && second === 'candidates') return false;
  return PERSISTED_ROOTS.has(String(root));
}

/** Efface tout ce qui est gardé sur l'appareil (déconnexion, session expirée, à la demande). */
export async function clearOfflineData() {
  if (typeof indexedDB !== 'undefined') await clear(idb()).catch(() => undefined);
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.controller?.postMessage({ type: 'CLEAR_PAGES' });
  }
}
