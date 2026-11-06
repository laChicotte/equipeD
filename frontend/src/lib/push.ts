'use client';

import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { api } from '@/lib/api';

/**
 * Notifications push (Web Push) : l'appareil reçoit les nouveaux messages, demandes et séances
 * même quand l'application est fermée. Le service worker (public/sw.js) les affiche.
 */

export type PushState =
  | 'unsupported' // navigateur sans push (ex. Safari iOS hors application installée)
  | 'disabled' // serveur sans clés VAPID
  | 'denied' // refusé dans les réglages du navigateur
  | 'off'
  | 'on';

const supported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window &&
  process.env.NODE_ENV === 'production';

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function currentSubscription() {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

const send = (sub: PushSubscription) => {
  const json = sub.toJSON();
  return api('/push/subscriptions', {
    method: 'POST',
    body: { endpoint: json.endpoint, keys: json.keys },
  });
};

function usePushConfig() {
  return useQuery({
    queryKey: ['push', 'config'],
    queryFn: () => api<{ enabled: boolean; publicKey: string | null }>('/push/config'),
    staleTime: 60 * 60_000,
  });
}

const noop = () => () => undefined;

export function usePush() {
  const config = usePushConfig();
  // Lu côté navigateur seulement (rendu serveur : « non pris en charge »).
  const isSupported = useSyncExternalStore(noop, supported, () => false);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isSupported) return;
    let alive = true;
    void currentSubscription()
      .then((sub) => alive && setSubscribed(!!sub))
      .catch(() => alive && setSubscribed(false));
    return () => {
      alive = false;
    };
  }, [isSupported]);

  const permission = isSupported ? Notification.permission : 'default';
  const state: PushState = !isSupported
    ? 'unsupported'
    : config.data && !config.data.enabled
      ? 'disabled'
      : denied || permission === 'denied'
        ? 'denied'
        : subscribed && permission === 'granted'
          ? 'on'
          : 'off';

  /** Doit être appelé par un clic : le navigateur affiche sa demande d'autorisation. */
  const enable = useCallback(async () => {
    if (!config.data?.publicKey) return false;
    setBusy(true);
    try {
      const result = await Notification.requestPermission();
      if (result !== 'granted') {
        setDenied(result === 'denied');
        return false;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(config.data.publicKey),
        }));
      await send(sub);
      setSubscribed(true);
      return true;
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  }, [config.data]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      await disablePushOnThisDevice();
      setSubscribed(false);
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, enable, disable };
}

/**
 * À l'ouverture de l'espace connecté : si l'appareil est déjà abonné, l'abonnement est
 * rattaché à la session actuelle (nouvelle connexion, autre compte sur le même appareil).
 */
export function usePushSync(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !supported() || Notification.permission !== 'granted') return;
    void currentSubscription()
      .then((sub) => (sub ? send(sub) : undefined))
      .catch(() => undefined);
  }, [enabled]);
}

/** Déconnexion : l'appareil ne reçoit plus rien pour ce compte. */
export async function disablePushOnThisDevice() {
  if (!supported()) return;
  const sub = await currentSubscription().catch(() => null);
  if (!sub) return;
  await api('/push/subscriptions', { method: 'DELETE', body: { endpoint: sub.endpoint } }).catch(
    () => undefined,
  );
  await sub.unsubscribe().catch(() => undefined);
}
