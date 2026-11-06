'use client';

import {
  ArrowDownUp,
  CalendarCheck2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
  SearchX,
  Sparkles,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { DomainIcon } from '@/components/domain-icon';
import { ErrorState } from '@/components/feedback/states';
import { Button } from '@/components/ui/button';
import { OrientationPanel, WhyThisMentor } from '@/features/ai/ai-parts';
import { useMe } from '@/features/auth/api';
import {
  useDomains,
  useMentors,
  useSuggestions,
  type MentorFilters,
  type MentorSort,
} from '@/features/catalog/api';
import { CAMPUS_FRANCE_NOTICE, LANGUAGES, isCampusFrance, modalityLabels } from '@/lib/labels';
import type { Modality } from '@/lib/types';
import { cn } from '@/lib/utils';
import { MentorResult, MentorResultSkeleton } from './mentor-card';
import { MentorSearchBox } from './search-box';

function useFilters(): [MentorFilters, (patch: Partial<MentorFilters>) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters = useMemo<MentorFilters>(
    () => ({
      q: params.get('q') ?? '',
      domain: params.get('domain') ?? '',
      modality: (params.get('modality') as Modality | null) ?? '',
      language: params.get('language') ?? '',
      available: params.get('available') === 'true',
      sort: (SORTS.some((s) => s.value === params.get('tri'))
        ? params.get('tri')
        : 'relevance') as MentorSort,
      page: Number(params.get('page') ?? 1) || 1,
    }),
    [params],
  );

  const update = (patch: Partial<MentorFilters>) => {
    const next = { ...filters, page: 1, ...patch };
    const sp = new URLSearchParams();
    if (next.q) sp.set('q', next.q);
    if (next.domain) sp.set('domain', next.domain);
    if (next.modality) sp.set('modality', next.modality);
    if (next.language) sp.set('language', next.language);
    if (next.available) sp.set('available', 'true');
    if (next.sort && next.sort !== 'relevance') sp.set('tri', next.sort);
    if (next.page && next.page > 1) sp.set('page', String(next.page));
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return [filters, update];
}

/* ── Briques ──────────────────────────────────────────────────────────────── */

const SORTS: { value: MentorSort; label: string; hint: string }[] = [
  {
    value: 'relevance',
    label: 'Pertinence',
    hint: 'Profils vérifiés d’abord, puis l’expérience démontrée sur la plateforme, la disponibilité et les années d’expérience.',
  },
  {
    value: 'experience',
    label: 'Expérience',
    hint: 'Accompagnements menés à terme, certificats et avis sur la plateforme, puis années d’expérience.',
  },
  {
    value: 'availability',
    label: 'Disponibilité',
    hint: 'Le prochain créneau libre le plus proche d’abord.',
  },
  {
    value: 'rating',
    label: 'Note',
    hint: 'Note moyenne des séances, prise en compte à partir de 3 avis.',
  },
];

const panel = 'overflow-hidden rounded-lg bg-surface shadow-card ring-1 ring-border/70';
const MODALITIES: Modality[] = ['REMOTE', 'IN_PERSON', 'HYBRID'];

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-semibold whitespace-nowrap transition-colors',
        active
          ? 'bg-ink-900 text-white hover:bg-ink-800'
          : 'text-muted-foreground ring-1 ring-border-strong ring-inset hover:bg-surface-muted hover:text-ink-900 hover:ring-ink-900',
      )}
    >
      {children}
    </button>
  );
}

function PillSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <span className="relative inline-flex shrink-0">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-8 max-w-[240px] cursor-pointer appearance-none truncate rounded-full pr-8 pl-3.5 text-[14px] font-semibold outline-none [field-sizing:content] focus-visible:ring-2 focus-visible:ring-teal-600',
          value
            ? 'bg-ink-900 text-white'
            : 'bg-surface text-muted-foreground ring-1 ring-border-strong ring-inset hover:bg-surface-muted hover:ring-ink-900',
        )}
      >
        {children}
      </select>
      <ChevronDown
        className={cn(
          'pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2',
          value ? 'text-white' : 'text-muted-foreground',
        )}
        aria-hidden
      />
    </span>
  );
}

/** « Vouliez-vous dire … ? » : relance la recherche avec le mot corrigé. */
function DidYouMean({ value, onPick }: { value: string; onPick: (v: string) => void }) {
  return (
    <span>
      Vouliez-vous dire{' '}
      <button
        type="button"
        onClick={() => onPick(value)}
        className="font-semibold text-teal-700 underline underline-offset-2 hover:text-teal-800"
      >
        {value}
      </button>{' '}
      ?
    </span>
  );
}

/* ── Recommandations (score déterministe et expliqué) ─────────────────────── */

function Suggestions() {
  const { data, isPending, isError } = useSuggestions(true);
  if (isPending || isError || !data) return null;
  if (data.profileRequired || data.items.length === 0) return null;
  return (
    <section aria-labelledby="suggestions-title" className={panel}>
      <div className="px-5 pt-4 pb-2 sm:px-6">
        <h2
          id="suggestions-title"
          className="flex items-center gap-2 font-display text-[18px] font-semibold text-ink-900"
        >
          <Sparkles className="size-[18px] text-amber-500" aria-hidden />
          Recommandés pour vous
        </h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Selon vos domaines, compétences recherchées et modalité. Le score suit des règles
          transparentes, l’IA ne fait que l’expliquer.
        </p>
      </div>
      <ul className="divide-y divide-border/70">
        {data.items.slice(0, 3).map(({ mentor, score, reasons }) => (
          <li key={mentor.id}>
            <MentorResult
              mentor={mentor}
              aside={
                <div className="grid gap-1.5">
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                    <span className="inline-flex items-center gap-2 font-semibold text-teal-700 tabular-nums">
                      <span
                        className="h-1.5 w-16 overflow-hidden rounded-full bg-ink-50"
                        aria-hidden
                      >
                        <span
                          className="block h-full rounded-full bg-teal-600"
                          style={{ width: `${score}%` }}
                        />
                      </span>
                      Correspondance {score}/100
                    </span>
                    <span className="text-muted-foreground">{reasons[0]}</span>
                  </p>
                  <WhyThisMentor mentorId={mentor.id} />
                </div>
              }
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── Écran ────────────────────────────────────────────────────────────────── */

export function Directory() {
  const [filters, update] = useFilters();
  const { data: me } = useMe();
  const domains = useDomains();
  const mentors = useMentors(filters);
  const [q, setQ] = useState(filters.q ?? '');

  // Résultats en direct pendant la saisie (anti-rebond court) ; Entrée cherche immédiatement.
  useEffect(() => {
    if (q.trim() === (filters.q ?? '').trim()) return;
    const t = setTimeout(() => update({ q: q.trim() }), 280);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const activeDomain = domains.data?.find((d) => d.slug === filters.domain);
  const chips: { key: string; label: string; clear: () => void }[] = [
    ...(filters.q
      ? [
          {
            key: 'q',
            label: `« ${filters.q} »`,
            clear: () => {
              setQ('');
              update({ q: '' });
            },
          },
        ]
      : []),
    ...(activeDomain
      ? [{ key: 'domain', label: activeDomain.name, clear: () => update({ domain: '' }) }]
      : []),
    ...(filters.modality
      ? [
          {
            key: 'modality',
            label: modalityLabels[filters.modality],
            clear: () => update({ modality: '' }),
          },
        ]
      : []),
    ...(filters.language
      ? [{ key: 'language', label: filters.language, clear: () => update({ language: '' }) }]
      : []),
    ...(filters.available
      ? [
          {
            key: 'available',
            label: 'Disponible sous 14 jours',
            clear: () => update({ available: false }),
          },
        ]
      : []),
  ];
  const activeCount = chips.length;
  const isMentee = me?.role === 'MENTEE' && me.hasProfile;
  const showSuggestions = isMentee && activeCount === 0 && filters.page === 1;
  const total = mentors.data?.total;
  const search = mentors.data?.search;
  const resetAll = () => {
    setQ('');
    update({ q: '', domain: '', modality: '', language: '', available: false });
  };
  const runSearch = (value: string) => {
    setQ(value);
    update({ q: value.trim() });
  };

  return (
    <div className="mx-auto grid max-w-[1128px] gap-4">
      {/* Recherche et filtres */}
      <section
        className={cn(panel, 'overflow-visible px-4 py-4 sm:px-5')}
        aria-label="Recherche de mentors"
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
          <MentorSearchBox
            value={q}
            onChange={setQ}
            onSubmit={runSearch}
            onDomain={(domain) => update({ domain, q: '' })}
            loading={mentors.isFetching}
          />
          <label className="relative block">
            <span className="sr-only">Domaine</span>
            <select
              value={filters.domain ?? ''}
              onChange={(e) => update({ domain: e.target.value })}
              className={cn(
                'h-11 w-full cursor-pointer appearance-none rounded-lg border pr-10 pl-3.5 text-[15px] font-medium outline-none transition-colors focus:ring-4 focus:ring-teal-600/12',
                filters.domain
                  ? 'border-ink-900 bg-ink-900 text-white'
                  : 'border-border bg-background text-ink-900 hover:border-border-strong focus:border-teal-600',
              )}
            >
              <option value="">Tous les domaines</option>
              {domains.data?.map((d) => (
                <option key={d.id} value={d.slug}>
                  {d.name} ({d.mentorCount})
                </option>
              ))}
            </select>
            <ChevronDown
              className={cn(
                'pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2',
                filters.domain ? 'text-white' : 'text-muted-foreground',
              )}
              aria-hidden
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Modalité"
            className="scrollbar-none inline-flex max-w-full shrink-0 overflow-x-auto rounded-full bg-surface-muted p-0.5"
          >
            {(['', ...MODALITIES] as const).map((m) => (
              <button
                key={m || 'all'}
                type="button"
                aria-pressed={(filters.modality ?? '') === m}
                onClick={() => update({ modality: m })}
                className={cn(
                  'h-8 rounded-full px-3.5 text-[13px] font-semibold whitespace-nowrap transition-all duration-150',
                  (filters.modality ?? '') === m
                    ? 'bg-surface text-ink-900 shadow-card'
                    : 'text-muted-foreground hover:text-ink-900',
                )}
              >
                {m ? modalityLabels[m] : 'Toutes modalités'}
              </button>
            ))}
          </div>
          <PillSelect
            label="Langue"
            value={filters.language ?? ''}
            onChange={(v) => update({ language: v })}
          >
            <option value="">Toutes les langues</option>
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </PillSelect>
          <Pill
            active={!!filters.available}
            onClick={() => update({ available: !filters.available })}
          >
            <CalendarCheck2 className="size-3.5" aria-hidden />
            Disponible sous 14 jours
          </Pill>
          <span className="ml-auto h-6 w-px shrink-0 bg-border" aria-hidden />
          <label className="inline-flex shrink-0 items-center gap-2 text-[13px] text-muted-foreground">
            <ArrowDownUp className="size-3.5" aria-hidden />
            <span className="sr-only sm:not-sr-only">Trier par</span>
            <select
              value={filters.sort ?? 'relevance'}
              onChange={(e) => update({ sort: e.target.value as MentorSort })}
              title={SORTS.find((s) => s.value === (filters.sort ?? 'relevance'))?.hint}
              className="h-8 cursor-pointer rounded-full bg-surface pr-3 pl-3 text-[13px] font-semibold text-ink-900 ring-1 ring-border-strong outline-none ring-inset focus-visible:ring-2 focus-visible:ring-teal-600"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {chips.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
            <span className="text-[12px] font-medium text-muted-foreground">Filtres :</span>
            {chips.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={c.clear}
                className="inline-flex h-7 animate-scale-in items-center gap-1.5 rounded-full bg-ink-50 pr-2 pl-3 text-[13px] font-medium text-ink-900 ring-1 ring-ink-100 transition-colors hover:bg-ink-100"
                aria-label={`Retirer le filtre ${c.label}`}
              >
                {c.label}
                <X className="size-3.5 text-muted-foreground" aria-hidden />
              </button>
            ))}
            {chips.length > 1 && (
              <button
                type="button"
                onClick={resetAll}
                className="h-7 rounded-full px-2.5 text-[13px] font-semibold text-teal-700 hover:underline"
              >
                Tout effacer
              </button>
            )}
          </div>
        )}
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid min-w-0 gap-4">
          {activeDomain && isCampusFrance(activeDomain.slug) && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-[14px] text-[#7a4a0f] ring-1 ring-amber-100">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              {CAMPUS_FRANCE_NOTICE}
            </p>
          )}

          {me && me.role !== 'ADMIN' && (
            <OrientationPanel onDomain={(domain) => update({ domain })} onSkill={runSearch} />
          )}

          {showSuggestions && <Suggestions />}

          <section className={panel} aria-labelledby="resultats-titre">
            <div className="flex items-baseline justify-between gap-3 border-b border-border/70 px-5 py-3.5 sm:px-6">
              <h1
                id="resultats-titre"
                className="font-display text-[18px] font-semibold text-ink-900"
              >
                {activeDomain ? activeDomain.name : 'Trouver un mentor'}
              </h1>
              <p className="text-[13px] text-muted-foreground tabular-nums" aria-live="polite">
                {total === undefined
                  ? 'Recherche en cours…'
                  : `${total} mentor${total > 1 ? 's' : ''}`}
              </p>
            </div>

            {search?.mode === 'approximate' && total !== undefined && total > 0 && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border/70 bg-amber-50/60 px-5 py-2.5 text-[13px] text-[#7a4a0f] sm:px-6">
                <Info className="size-4 shrink-0" aria-hidden />
                <span>
                  Aucun profil ne contient tous les mots de « {filters.q} » : voici les plus
                  proches.
                </span>
                {search.didYouMean && <DidYouMean value={search.didYouMean} onPick={runSearch} />}
              </div>
            )}

            {mentors.isError ? (
              <div className="p-5">
                <ErrorState error={mentors.error} onRetry={() => void mentors.refetch()} />
              </div>
            ) : mentors.isPending ? (
              <ul className="divide-y divide-border/70">
                {Array.from({ length: 4 }).map((_, i) => (
                  <li key={i}>
                    <MentorResultSkeleton />
                  </li>
                ))}
              </ul>
            ) : mentors.data.items.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-12 text-center">
                <span className="inline-flex size-12 items-center justify-center rounded-full bg-surface-muted text-muted-foreground">
                  <SearchX className="size-5" aria-hidden />
                </span>
                <p className="mt-4 font-display text-[17px] font-semibold text-ink-900">
                  {filters.q
                    ? `Aucun mentor pour « ${filters.q} »`
                    : 'Aucun mentor avec ces filtres'}
                </p>
                <p className="mt-1 max-w-sm text-[14px] text-muted-foreground">
                  {search?.didYouMean ? (
                    <DidYouMean value={search.didYouMean} onPick={runSearch} />
                  ) : chips.length > 1 ? (
                    'Retirez un filtre pour élargir la recherche :'
                  ) : (
                    'Essayez un autre mot, plus général.'
                  )}
                </p>
                {chips.length > 1 && (
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    {chips.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={c.clear}
                        className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-[13px] font-medium text-ink-900 ring-1 ring-border-strong hover:bg-surface-muted"
                      >
                        <X className="size-3.5" aria-hidden />
                        {c.label}
                      </button>
                    ))}
                  </div>
                )}
                <Button variant="secondary" size="sm" className="mt-5" onClick={resetAll}>
                  Voir tous les mentors
                </Button>
              </div>
            ) : (
              <>
                <ul
                  className={cn(
                    'divide-y divide-border/70 transition-opacity',
                    mentors.isPlaceholderData && 'opacity-60',
                  )}
                >
                  {mentors.data.items.map((m) => (
                    <li key={m.id}>
                      <MentorResult mentor={m} />
                    </li>
                  ))}
                </ul>
                {mentors.data.totalPages > 1 && (
                  <nav
                    aria-label="Pagination"
                    className="flex items-center justify-between gap-3 border-t border-border/70 px-5 py-3"
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={mentors.data.page <= 1}
                      onClick={() => update({ page: mentors.data.page - 1 })}
                    >
                      <ChevronLeft aria-hidden />
                      Précédent
                    </Button>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      Page {mentors.data.page} sur {mentors.data.totalPages}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={mentors.data.page >= mentors.data.totalPages}
                      onClick={() => update({ page: mentors.data.page + 1 })}
                    >
                      Suivant
                      <ChevronRight aria-hidden />
                    </Button>
                  </nav>
                )}
              </>
            )}
          </section>
        </div>

        <aside className="grid gap-4 lg:sticky lg:top-[88px]">
          {!me && (
            <section className={cn(panel, 'p-5')}>
              <h2 className="font-display text-[16px] font-semibold text-ink-900">
                Un profil vous intéresse ?
              </h2>
              <p className="mt-1 text-[14px] text-muted-foreground">
                Créez votre compte en deux minutes pour envoyer une demande motivée.
              </p>
              <Button asChild variant="accent" className="mt-4 w-full">
                <Link href="/inscription">Créer mon compte</Link>
              </Button>
              <Button asChild variant="secondary" className="mt-2 w-full">
                <Link href="/connexion?next=/mentors">Se connecter</Link>
              </Button>
            </section>
          )}
          <section className={panel}>
            <div className="relative isolate h-16 overflow-hidden bg-ink-900">
              <div className="pattern-kente absolute inset-0 -z-10 opacity-[0.16]" aria-hidden />
            </div>
            <div className="p-5">
              <h2 className="font-display text-[16px] font-semibold text-ink-900">
                Comment ça marche
              </h2>
              <ol className="mt-3 grid gap-3 text-[14px] text-foreground">
                {[
                  'Choisissez un mentor selon votre objectif.',
                  'Envoyez une demande motivée.',
                  'Une fois acceptée, échangez et réservez une séance.',
                ].map((t, i) => (
                  <li key={t} className="flex gap-3">
                    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-teal-50 text-[12px] font-semibold text-teal-800">
                      {i + 1}
                    </span>
                    {t}
                  </li>
                ))}
              </ol>
            </div>
          </section>
          <section className={cn(panel, 'p-5')}>
            <h2 className="font-display text-[16px] font-semibold text-ink-900">Domaines</h2>
            <ul className="mt-3 grid gap-1">
              {domains.data?.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => update({ domain: filters.domain === d.slug ? '' : d.slug })}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] font-medium transition-colors',
                      filters.domain === d.slug
                        ? 'bg-teal-50 text-teal-800'
                        : 'text-foreground hover:bg-background',
                    )}
                  >
                    <DomainIcon name={d.icon} className="size-4 shrink-0 text-teal-700" />
                    <span className="flex-1 truncate">{d.name}</span>
                    <span className="text-muted-foreground tabular-nums">{d.mentorCount}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
