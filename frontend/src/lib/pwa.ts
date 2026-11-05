'use client';

import { useEffect, useSyncExternalStore } from 'react';

/** Événement non standard de Chromium (Android, Chrome et Edge sur ordinateur). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    emit();
  });
}

/**
 * Enregistre le service worker (production uniquement : en développement, il gênerait le
 * rechargement à chaud). L'API n'est jamais mise en cache (voir public/sw.js).
 */
export function useServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch(() => undefined);
  }, []);
}

/** Proposition d'installation, si le navigateur la permet (null sinon, ex. Safari iOS). */
export function useInstallPrompt(): (() => Promise<boolean>) | null {
  const available = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => deferred !== null,
    () => false,
  );
  if (!available) return null;
  return async () => {
    const event = deferred;
    if (!event) return false;
    deferred = null;
    emit();
    await event.prompt();
    return (await event.userChoice).outcome === 'accepted';
  };
}
