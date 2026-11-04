'use client';

import { useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();
let now = 0;
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 30_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

function getSnapshot() {
  return now || (now = Date.now());
}

/** Horloge partagée, rafraîchie toutes les 30 s (évite Date.now() pendant le rendu). */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, () => 0);
}
