'use client';

import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

/**
 * État de la connexion, tel que l'application le constate.
 *
 * `navigator.onLine` ne suffit pas : un téléphone peut être « connecté » à un réseau qui ne laisse
 * rien passer. Une requête vers l'API qui échoue compte donc aussi, jusqu'à ce qu'un test
 * de `/health` réussisse.
 */
const PROBE_INTERVAL_MS = 15_000;

let browserOnline = true;
let apiReachable = true;
let probe: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

export const isOnline = () => browserOnline && apiReachable;

function emit() {
  listeners.forEach((l) => l());
}

function runProbe() {
  void fetch('/api/v1/health', { cache: 'no-store', signal: AbortSignal.timeout(8_000) })
    .then((r) => (r.ok ? markApiReachable() : scheduleProbe()))
    .catch(scheduleProbe);
}

function scheduleProbe() {
  clearTimeout(probe);
  if (!apiReachable) probe = setTimeout(runProbe, PROBE_INTERVAL_MS);
}

export function markApiUnreachable() {
  if (!apiReachable) return;
  apiReachable = false;
  emit();
  scheduleProbe();
}

export function markApiReachable() {
  if (apiReachable) return;
  apiReachable = true;
  clearTimeout(probe);
  emit();
}

if (typeof window !== 'undefined') {
  browserOnline = navigator.onLine;
  window.addEventListener('online', () => {
    browserOnline = true;
    // Retour du réseau : on vérifie tout de suite plutôt qu'au prochain test.
    if (!apiReachable) {
      clearTimeout(probe);
      runProbe();
    }
    emit();
  });
  window.addEventListener('offline', () => {
    browserOnline = false;
    emit();
  });
  // TanStack Query suspend ses requêtes et les reprend selon ce même état.
  onlineManager.setEventListener((setOnline) => {
    const listener = () => setOnline(isOnline());
    listeners.add(listener);
    listener();
    return () => {
      listeners.delete(listener);
    };
  });
}

export function subscribeConnectivity(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useOnline() {
  return useSyncExternalStore(subscribeConnectivity, isOnline, () => true);
}
