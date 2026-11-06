'use client';

import { BellRing, X } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { usePush, type PushState } from '@/lib/push';

const HINTS: Record<PushState, string> = {
  on: 'Activées sur cet appareil.',
  off: 'Désactivées sur cet appareil.',
  denied:
    'Bloquées par le navigateur : autorisez les notifications pour ce site dans ses réglages, puis revenez ici.',
  unsupported:
    'Ce navigateur ne les gère pas. Sur iPhone, installez d’abord l’application sur l’écran d’accueil.',
  disabled: 'Non disponibles sur cette plateforme pour le moment.',
};

/** Réglage « Mon compte » : activer ou couper les notifications push de cet appareil. */
export function PushSetting() {
  const { state, busy, enable, disable } = usePush();
  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      {state === 'on' ? (
        <Button variant="secondary" size="sm" loading={busy} onClick={() => void disable()}>
          Désactiver
        </Button>
      ) : state === 'off' ? (
        <Button
          size="sm"
          loading={busy}
          onClick={() =>
            void enable().then((ok) =>
              ok
                ? toast.success('Notifications activées sur cet appareil')
                : toast.error('Notifications non autorisées par le navigateur'),
            )
          }
        >
          <BellRing aria-hidden />
          Activer
        </Button>
      ) : null}
      <p className="max-w-xs text-[12px] text-muted-foreground sm:text-right">{HINTS[state]}</p>
    </div>
  );
}

const DISMISS_KEY = 'tc-push-prompt-dismissed';
const listeners = new Set<() => void>();
const readDismissed = () => {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
};

/** Invitation discrète, une seule fois par appareil, à activer les notifications. */
export function PushPrompt() {
  const { state, busy, enable } = usePush();
  const dismissed = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    readDismissed,
    () => true,
  );
  const [hidden, setHidden] = useState(false);
  if (state !== 'off' || dismissed || hidden) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* stockage indisponible : l'invitation reviendra */
    }
    setHidden(true);
    listeners.forEach((l) => l());
  };

  return (
    <div className="mb-5 flex animate-slide-up items-start gap-3 rounded-xl bg-ink-900 p-4 text-white shadow-raised sm:items-center sm:px-5">
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-amber-400">
        <BellRing className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Ne manquez aucune réponse</p>
        <p className="text-[13px] text-ink-100">
          Recevez une notification pour les nouveaux messages, demandes et séances, même quand
          l’application est fermée.
        </p>
        <div className="mt-3 flex gap-2 sm:hidden">
          <Button
            size="sm"
            variant="accent"
            loading={busy}
            onClick={() => void enable().then(dismiss)}
          >
            Activer
          </Button>
        </div>
      </div>
      <Button
        size="sm"
        variant="accent"
        className="hidden sm:inline-flex"
        loading={busy}
        onClick={() =>
          void enable().then((ok) => {
            if (ok) toast.success('Notifications activées sur cet appareil');
            dismiss();
          })
        }
      >
        Activer
      </Button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Plus tard"
        className="rounded-md p-1 text-ink-100 hover:bg-white/10 hover:text-white"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
