'use client';

import { X } from 'lucide-react';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Me } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Visite guidée de l'espace mentoré ou mentor : quelques bulles posées sur la navigation.
 * Lancée une seule fois par compte et par appareil (localStorage), relançable depuis « Mon compte ».
 * Les cibles sont les liens de navigation marqués `data-tour="<clé>"` ; une étape sans cible
 * visible (ex. « Séances » absent de la barre mobile) s'affiche au centre de l'écran.
 */

interface TourStep {
  /** Valeur de `data-tour` à mettre en avant (absente : bulle centrée). */
  target?: string;
  title: string;
  body: string;
}

const START_EVENT = 'tc:guided-tour';
const storageKey = (userId: string) => `tc_tour_done_${userId}`;

/** Relance la visite (bouton de « Mon compte »). */
export function startGuidedTour() {
  window.dispatchEvent(new Event(START_EVENT));
}

function stepsFor(me: Pick<Me, 'role' | 'firstName'>): TourStep[] {
  const welcome: TourStep = {
    title: `Bienvenue, ${me.firstName} !`,
    body: 'En une minute, voici où trouver l’essentiel de votre espace. Vous pouvez passer la visite à tout moment.',
  };
  if (me.role === 'MENTOR') {
    return [
      welcome,
      {
        target: 'demandes',
        title: 'Demandes reçues',
        body: 'Les mentorés vous écrivent ici avec leur objectif. Acceptez ou refusez : une demande acceptée ouvre un mentorat.',
      },
      {
        target: 'messages',
        title: 'Messagerie',
        body: 'Échangez en privé avec vos mentorés, même avec une connexion faible : les messages partent dès que le réseau revient. Les appels audio et vidéo se lancent depuis la conversation.',
      },
      {
        target: 'disponibilites',
        title: 'Disponibilités',
        body: 'Publiez vos créneaux libres. Vos mentorés y réservent leurs séances, sans aller-retour pour trouver une date.',
      },
      {
        target: 'seances',
        title: 'Séances',
        body: 'Confirmez les séances demandées, retrouvez le lien de visio et les évaluations laissées par vos mentorés.',
      },
      {
        target: 'mentorats',
        title: 'Objectifs',
        body: 'Dans « Mes mentorés », chaque mentorat a son espace : objectifs découpés en étapes, votre retour sur chacun, ressources partagées.',
      },
      {
        target: 'mentorats',
        title: 'Certificat',
        body: 'À la clôture d’un mentorat avec au moins une séance réalisée, vous recevez un certificat d’accompagnement vérifiable, affiché sur votre fiche publique.',
      },
    ];
  }
  return [
    welcome,
    {
      target: 'mentors',
      title: 'Trouver un mentor',
      body: 'Cherchez par domaine ou par compétence. Les suggestions expliquent pourquoi un mentor vous correspond.',
    },
    {
      target: 'demandes',
      title: 'Mes demandes',
      body: 'Depuis la fiche d’un mentor, envoyez une demande avec votre objectif. Suivez ici sa réponse : une fois acceptée, le mentorat commence.',
    },
    {
      target: 'messages',
      title: 'Messagerie',
      body: 'Échangez en privé avec votre mentor, même avec une connexion faible : les messages partent dès que le réseau revient. Les appels audio et vidéo se lancent depuis la conversation.',
    },
    {
      target: 'seances',
      title: 'Séances',
      body: 'Réservez un créneau proposé par votre mentor, retrouvez le lien de visio, puis évaluez chaque séance réalisée.',
    },
    {
      target: 'mentorats',
      title: 'Objectifs',
      body: 'Dans « Mes mentorats », fixez vos objectifs avec votre mentor, cochez les étapes au fil des séances et retrouvez les ressources partagées.',
    },
    {
      target: 'mentorats',
      title: 'Certificat',
      body: 'À la clôture du mentorat, si au moins une séance a eu lieu, votre mentor reçoit un certificat d’accompagnement vérifiable : la preuve publique de votre parcours ensemble.',
    },
  ];
}

const isDone = (userId: string) => {
  try {
    return window.localStorage.getItem(storageKey(userId)) === '1';
  } catch {
    // Stockage bloqué (navigation privée) : on ne relance pas la visite à chaque page.
    return true;
  }
};

const markDone = (userId: string) => {
  try {
    window.localStorage.setItem(storageKey(userId), '1');
  } catch {
    /* sans stockage : la visite reviendra, sans gêner */
  }
};

/** Premier élément visible portant `data-tour` (la navigation diffère entre ordinateur et mobile). */
function findTarget(key: string): DOMRect | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${key}"]`)) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return rect;
  }
  return null;
}

const GAP = 12;
const PAD = 6;

export function GuidedTour({ me }: { me: Me }) {
  const { role, firstName } = me;
  // Stable entre deux rendus : sinon le calcul de position se relancerait sans fin.
  const steps = useMemo(() => stepsFor({ role, firstName }), [role, firstName]);
  const [index, setIndex] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const bodyId = useId();

  // Première visite : lancée automatiquement, sauf dans un navigateur piloté (tests automatisés).
  useEffect(() => {
    if (navigator.webdriver || isDone(me.id)) return;
    const timer = window.setTimeout(() => setIndex(0), 700);
    return () => window.clearTimeout(timer);
  }, [me.id]);

  useEffect(() => {
    const start = () => setIndex(0);
    window.addEventListener(START_EVENT, start);
    return () => window.removeEventListener(START_EVENT, start);
  }, []);

  const step = index === null ? null : steps[index];
  const target = step?.target;

  // Position de la cible, recalculée au redimensionnement et au défilement.
  useLayoutEffect(() => {
    if (index === null) return;
    const update = () => setRect(target ? findTarget(target) : null);
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [index, target]);

  useEffect(() => {
    if (index !== null) bubbleRef.current?.focus();
  }, [index]);

  const close = useCallback(() => {
    markDone(me.id);
    setIndex(null);
  }, [me.id]);

  const last = steps.length - 1;
  const next = useCallback(() => {
    if (index === null) return;
    if (index >= last) close();
    else setIndex(index + 1);
  }, [index, last, close]);
  const prev = useCallback(() => {
    if (index) setIndex(index - 1);
  }, [index]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, close, next, prev]);

  if (index === null || !step) return null;

  // Bulle sous la cible si elle est en haut de l'écran (navigation d'ordinateur), au-dessus sinon
  // (barre d'onglets mobile), centrée horizontalement sur la cible sans sortir de l'écran.
  const vw = typeof window === 'undefined' ? 1024 : window.innerWidth;
  const vh = typeof window === 'undefined' ? 768 : window.innerHeight;
  const width = Math.min(340, vw - 32);
  let position: React.CSSProperties;
  if (rect) {
    const left = Math.min(Math.max(16, rect.left + rect.width / 2 - width / 2), vw - width - 16);
    position =
      rect.top < vh / 2
        ? { top: rect.bottom + PAD + GAP, left, width }
        : { bottom: vh - rect.top + PAD + GAP, left, width };
  } else {
    // Centrée sans transform (l'animation d'apparition l'écraserait) : marges automatiques.
    position = { inset: 0, margin: 'auto', width, height: 'fit-content' };
  }

  return (
    <div className="fixed inset-0 z-[60] print:hidden">
      {rect ? (
        // Projecteur : un trou autour de la cible, le reste de l'écran assombri.
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-lg transition-all duration-200"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            // Contour ambre puis voile : les deux dans la même ombre (une classe ring serait écrasée).
            boxShadow: '0 0 0 2px var(--color-amber-400), 0 0 0 9999px rgb(11 32 26 / 0.55)',
          }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-ink-950/55" />
      )}

      <div
        ref={bubbleRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        style={position}
        className="absolute animate-scale-in rounded-lg bg-surface p-5 shadow-raised ring-1 ring-border/70 outline-none"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Fermer la visite guidée"
          className="absolute top-2.5 right-2.5 inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-ink-900"
        >
          <X className="size-4" aria-hidden />
        </button>
        <p className="text-[12px] font-semibold tracking-[0.06em] text-teal-700 uppercase">
          Visite guidée · {index + 1} / {steps.length}
        </p>
        <h2
          id={titleId}
          className="mt-1.5 pr-8 font-display text-[18px] font-semibold tracking-[-0.01em] text-ink-900"
        >
          {step.title}
        </h2>
        <p id={bodyId} className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          {step.body}
        </p>
        {index === last && (
          <p className="mt-2 text-[13px] text-muted-foreground">
            Pour revoir cette visite : « Mon compte ».
          </p>
        )}

        <div className="mt-4 flex items-center gap-1.5" aria-hidden>
          {steps.map((s, i) => (
            <span
              key={`${s.title}-${i}`}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === index ? 'w-5 bg-ink-900' : 'w-1.5 bg-border-strong',
              )}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2">
          {index < last && (
            <Button variant="ghost" size="sm" onClick={close} className="-ml-2">
              Passer
            </Button>
          )}
          <span className="ml-auto flex gap-2">
            {index > 0 && (
              <Button variant="secondary" size="sm" onClick={prev}>
                Précédent
              </Button>
            )}
            <Button size="sm" onClick={next}>
              {index === 0 ? 'Commencer' : index === last ? 'Terminer' : 'Suivant'}
            </Button>
          </span>
        </div>
      </div>
    </div>
  );
}
