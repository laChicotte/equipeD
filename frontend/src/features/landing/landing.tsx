'use client';

import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck2,
  CircleCheck,
  Hourglass,
  Lock,
  MessagesSquare,
  Search,
  Send,
  ShieldCheck,
  Target,
} from 'lucide-react';
import Link from 'next/link';
import { DomainIcon } from '@/components/domain-icon';
import { ErrorState } from '@/components/feedback/states';
import { Button } from '@/components/ui/button';
import { Progress, Skeleton } from '@/components/ui/misc';
import { useDomains } from '@/features/catalog/api';
import { CAMPUS_FRANCE_NOTICE, isCampusFrance } from '@/lib/labels';

const steps = [
  {
    icon: Search,
    title: 'Trouvez le bon mentor',
    text: 'Filtrez par domaine, compétence, langue ou disponibilité. Des suggestions expliquent pourquoi un profil vous correspond.',
  },
  {
    icon: Send,
    title: 'Envoyez une demande motivée',
    text: 'Formulez votre objectif. Le mentor accepte ou décline : la relation démarre sur des attentes claires.',
  },
  {
    icon: CalendarCheck2,
    title: 'Avancez ensemble',
    text: 'Réservez des séances, échangez en privé et suivez vos objectifs jalon après jalon.',
  },
];

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-hidden>
      <div className="pointer-events-none absolute -top-10 -right-6 size-64 rounded-full bg-teal-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-8 size-56 rounded-full bg-amber-100/80 blur-3xl" />
      <div className="relative rounded-xl border border-border bg-surface/90 p-5 shadow-raised backdrop-blur">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Exemple de parcours
          </p>
          <span className="rounded-sm bg-ink-50 px-2 py-0.5 text-[11px] font-semibold text-ink-700">Illustration</span>
        </div>
        <ol className="grid gap-3">
          <li className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
            <span className="inline-flex size-9 items-center justify-center rounded-md bg-warning-50 text-warning-700">
              <Hourglass className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Demande envoyée</p>
              <p className="truncate text-xs text-muted-foreground">« Construire mon premier portfolio web »</p>
            </div>
          </li>
          <li className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
            <span className="inline-flex size-9 items-center justify-center rounded-md bg-success-50 text-success-700">
              <CircleCheck className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Demande acceptée</p>
              <p className="text-xs text-muted-foreground">La conversation privée est ouverte</p>
            </div>
            <MessagesSquare className="size-4 text-teal-700" />
          </li>
          <li className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
            <span className="inline-flex size-9 items-center justify-center rounded-md bg-teal-50 text-teal-700">
              <CalendarCheck2 className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Séance confirmée</p>
              <p className="text-xs text-muted-foreground">Créneau réservé, lien de réunion externe</p>
            </div>
          </li>
          <li className="rounded-lg border border-border bg-surface p-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-9 items-center justify-center rounded-md bg-ink-50 text-ink-900">
                <Target className="size-4" />
              </span>
              <p className="flex-1 text-sm font-semibold">Objectif en cours</p>
              <span className="text-xs font-semibold text-teal-700 tabular-nums">2/3 jalons</span>
            </div>
            <Progress value={66} className="mt-3" label="Exemple de progression" />
          </li>
        </ol>
      </div>
    </div>
  );
}

function Domains() {
  const { data, isPending, isError, error, refetch } = useDomains();
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {isPending
        ? Array.from({ length: 6 }).map((_, i) => (
            <li key={i}>
              <Skeleton className="h-44" />
            </li>
          ))
        : data.map((d) => (
            <li key={d.id}>
              <Link
                href={`/mentors?domain=${d.slug}`}
                className="group flex h-full flex-col rounded-lg border border-border bg-surface p-5 shadow-card transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-raised"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex size-11 items-center justify-center rounded-md bg-teal-50 text-teal-700 transition-colors group-hover:bg-teal-700 group-hover:text-white">
                    <DomainIcon name={d.icon} className="size-5" />
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                    {d.mentorCount === 0
                      ? 'Bientôt des mentors'
                      : `${d.mentorCount} mentor${d.mentorCount > 1 ? 's' : ''}`}
                  </span>
                </div>
                <h3 className="mt-4 font-semibold tracking-tight">{d.name}</h3>
                <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                  {d.description}
                </p>
                {isCampusFrance(d.slug) && (
                  <p className="mt-3 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-[#7a4a0f]">
                    {CAMPUS_FRANCE_NOTICE}
                  </p>
                )}
                <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-accent">
                  Voir les mentors
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
    </ul>
  );
}

export function Landing() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-surface">
        <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:py-24">
          <div className="animate-slide-up">
            <p className="inline-flex items-center gap-2 rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
              <span className="size-1.5 rounded-full bg-teal-600" />
              Le mentorat à l’ère du numérique
            </p>
            <h1 className="mt-5 text-4xl leading-[1.08] font-bold tracking-tight text-ink-900 sm:text-5xl">
              Avancez plus vite, <span className="text-teal-700">accompagné·e</span> par ceux qui sont
              passés par là.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Talents Connectés met en relation jeunes talents et professionnels expérimentés :
              orientation, insertion, entrepreneuriat, numérique, Campus France… Un accompagnement
              structuré, de la première demande au suivi des objectifs.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/mentors">
                  Trouver un mentor
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/inscription?role=MENTOR">Devenir mentor</Link>
              </Button>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <BadgeCheck className="size-4 text-amber-500" aria-hidden />
                Profils vérifiés par l’équipe
              </li>
              <li className="flex items-center gap-2">
                <Lock className="size-4 text-teal-700" aria-hidden />
                Conversations privées
              </li>
              <li className="flex items-center gap-2">
                <CalendarCheck2 className="size-4 text-teal-700" aria-hidden />
                Séances sans double réservation
              </li>
            </ul>
          </div>
          <HeroVisual />
        </div>
      </section>

      {/* Fonctionnement */}
      <section id="fonctionnement" className="scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8 lg:py-24">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-teal-700">Fonctionnement</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Trois étapes, un vrai suivi</h2>
            <p className="mt-3 text-muted-foreground">
              Chaque étape est enregistrée : vous savez toujours où en est votre accompagnement.
            </p>
          </div>
          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {steps.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="relative rounded-lg border border-border bg-surface p-6 shadow-card">
                <div className="flex items-center justify-between">
                  <span className="inline-flex size-11 items-center justify-center rounded-md bg-ink-900 text-white">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="text-4xl font-semibold text-ink-100 tabular-nums" aria-hidden>
                    0{i + 1}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">
                  <span className="sr-only">Étape {i + 1} : </span>
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Domaines */}
      <section id="domaines" className="scroll-mt-20 border-y border-border bg-surface-muted/60">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8 lg:py-24">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-teal-700">Domaines d’accompagnement</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                Sept domaines, de l’orientation à l’entrepreneuriat
              </h2>
            </div>
            <Button asChild variant="secondary">
              <Link href="/mentors">Explorer l’annuaire</Link>
            </Button>
          </div>
          <div className="mt-10">
            <Domains />
          </div>
        </div>
      </section>

      {/* Confiance */}
      <section>
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-8 lg:grid-cols-2 lg:py-24">
          <div>
            <p className="text-sm font-semibold text-teal-700">Un cadre de confiance</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">
              Pensé pour protéger la relation de mentorat
            </h2>
            <p className="mt-3 max-w-lg text-muted-foreground">
              Le mentor ne fait pas à la place du mentoré : il l’aide à développer son autonomie et sa
              capacité de décision. La plateforme pose un cadre clair pour les deux.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: ShieldCheck, t: 'Vérification humaine', d: 'Les profils mentors sont vérifiés par l’équipe, sans validation automatique de diplômes.' },
              { icon: Lock, t: 'Données protégées', d: 'Coordonnées jamais exposées publiquement ; messages visibles des seuls participants.' },
              { icon: MessagesSquare, t: 'Échanges encadrés', d: 'La conversation s’ouvre uniquement après acceptation de la demande.' },
              { icon: Target, t: 'Objectifs mesurables', d: 'Jalons, progression et retours du mentor pour garder le cap.' },
            ].map(({ icon: Icon, t, d }) => (
              <li key={t} className="rounded-lg border border-border bg-surface p-5">
                <Icon className="size-5 text-teal-700" aria-hidden />
                <p className="mt-3 font-semibold">{t}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA final */}
      <section className="px-4 pb-16 sm:px-8 lg:pb-24">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-xl bg-ink-900 px-6 py-12 text-white sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute -top-20 -right-10 size-72 rounded-full bg-teal-600/35 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-10 size-64 rounded-full bg-amber-400/15 blur-3xl" />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <h2 className="text-3xl font-semibold tracking-tight">
                Votre expérience peut changer un parcours.
              </h2>
              <p className="mt-3 text-ink-100/85">
                Rejoignez la plateforme comme mentoré·e ou comme mentor. L’inscription prend deux minutes.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" variant="accent">
                <Link href="/inscription">Commencer maintenant</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="text-white ring-1 ring-white/25 hover:bg-white/10"
              >
                <Link href="/inscription?role=MENTOR">Devenir mentor</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
