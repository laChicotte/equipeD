'use client';

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
  LoaderCircle,
  Search,
  SearchX,
  Sparkles,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { DomainIcon } from '@/components/domain-icon';
import { EmptyState, ErrorState } from '@/components/feedback/states';
import { Button } from '@/components/ui/button';
import { useMe } from '@/features/auth/api';
import { useDomains, useMentors, useSuggestions, type MentorFilters } from '@/features/catalog/api';
import { CAMPUS_FRANCE_NOTICE, LANGUAGES, isCampusFrance, modalityLabels } from '@/lib/labels';
import type { Modality } from '@/lib/types';
import { cn } from '@/lib/utils';
import { MentorResult, MentorResultSkeleton } from './mentor-card';

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
    if (next.page && next.page > 1) sp.set('page', String(next.page));
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return [filters, update];
}

/* ── Briques ──────────────────────────────────────────────────────────────── */

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
          Selon vos domaines, compétences recherchées, modalité et langues. Règles transparentes,
          sans IA.
        </p>
      </div>
      <ul className="divide-y divide-border/70">
        {data.items.slice(0, 3).map(({ mentor, score, reasons }) => (
          <li key={mentor.id}>
            <MentorResult
              mentor={mentor}
              aside={
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                  <span className="inline-flex items-center gap-2 font-semibold text-teal-700 tabular-nums">
                    <span className="h-1.5 w-16 overflow-hidden rounded-full bg-ink-50" aria-hidden>
                      <span
                        className="block h-full rounded-full bg-teal-600"
                        style={{ width: `${score}%` }}
                      />
                    </span>
                    Correspondance {score}/100
                  </span>
                  <span className="text-muted-foreground">{reasons[0]}</span>
                </p>
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

  // Recherche avec anti-rebond (350 ms).
  useEffect(() => {
    if (q === (filters.q ?? '')) return;
    const t = setTimeout(() => update({ q }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const activeDomain = domains.data?.find((d) => d.slug === filters.domain);
  const activeCount = [
    filters.modality,
    filters.language,
    filters.available,
    filters.domain,
    filters.q,
  ].filter(Boolean).length;
  const isMentee = me?.role === 'MENTEE' && me.hasProfile;
  const showSuggestions = isMentee && activeCount === 0 && filters.page === 1;
  const total = mentors.data?.total;
  const resetAll = () => {
    setQ('');
    update({ q: '', domain: '', modality: '', language: '', available: false });
  };

  return (
    <div className="mx-auto grid max-w-[1128px] gap-4">
      {/* Barre de recherche et de filtres */}
      <section className={cn(panel, 'px-4 py-3 sm:px-5')} aria-label="Recherche de mentors">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative w-full lg:max-w-[300px]">
            <label htmlFor="recherche-mentor" className="sr-only">
              Rechercher un mentor
            </label>
            <span
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            >
              {mentors.isFetching && q ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
            </span>
            <input
              id="recherche-mentor"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Compétence, métier, nom…"
              className="h-9 w-full rounded-md border border-border bg-background pr-9 pl-9 text-[14px] text-ink-900 outline-none placeholder:text-muted-foreground focus:border-teal-600 focus:bg-surface focus:ring-3 focus:ring-teal-600/15"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ('')}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-ink-900"
                aria-label="Effacer la recherche"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <span className="hidden h-6 w-px bg-border lg:block" aria-hidden />
          <div className="scrollbar-none -mx-1 flex min-w-0 items-center gap-2 overflow-x-auto px-1 py-0.5">
            <PillSelect
              label="Domaine"
              value={filters.domain ?? ''}
              onChange={(v) => update({ domain: v })}
            >
              <option value="">Domaine</option>
              {domains.data?.map((d) => (
                <option key={d.id} value={d.slug}>
                  {d.name} ({d.mentorCount})
                </option>
              ))}
            </PillSelect>
            {MODALITIES.map((m) => (
              <Pill
                key={m}
                active={filters.modality === m}
                onClick={() => update({ modality: filters.modality === m ? '' : m })}
              >
                {modalityLabels[m]}
              </Pill>
            ))}
            <PillSelect
              label="Langue"
              value={filters.language ?? ''}
              onChange={(v) => update({ language: v })}
            >
              <option value="">Langue</option>
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
              Disponible sous 14 jours
            </Pill>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={resetAll}
                className="h-8 shrink-0 rounded-full px-3 text-[14px] font-semibold whitespace-nowrap text-muted-foreground hover:bg-surface-muted hover:text-ink-900"
              >
                Réinitialiser
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid min-w-0 gap-4">
          {activeDomain && isCampusFrance(activeDomain.slug) && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-[14px] text-[#7a4a0f] ring-1 ring-amber-100">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              {CAMPUS_FRANCE_NOTICE}
            </p>
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
              <p className="text-[13px] text-muted-foreground" aria-live="polite">
                {total === undefined
                  ? 'Recherche en cours…'
                  : `${total} résultat${total > 1 ? 's' : ''}`}
              </p>
            </div>
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
              <div className="p-5">
                <EmptyState
                  icon={SearchX}
                  title="Aucun mentor ne correspond à ces critères"
                  description="Essayez un autre mot-clé, un autre domaine ou retirez un filtre."
                  action={
                    <Button variant="secondary" onClick={resetAll}>
                      Réinitialiser la recherche
                    </Button>
                  }
                />
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
