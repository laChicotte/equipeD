'use client';

import {
  ChevronLeft,
  ChevronRight,
  Info,
  Search,
  SearchX,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState, ErrorState, PageHeader } from '@/components/feedback/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/misc';
import { useMe } from '@/features/auth/api';
import { useDomains, useMentors, useSuggestions, type MentorFilters } from '@/features/catalog/api';
import { CAMPUS_FRANCE_NOTICE, LANGUAGES, isCampusFrance, modalityLabels } from '@/lib/labels';
import type { Modality } from '@/lib/types';
import { cn } from '@/lib/utils';
import { MentorCard, MentorCardSkeleton } from './mentor-card';

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

function Suggestions() {
  const { data, isPending, isError } = useSuggestions(true);
  if (isPending || isError || !data) return null;
  if (data.profileRequired || data.items.length === 0) return null;
  return (
    <section aria-labelledby="suggestions-title" className="mb-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="suggestions-title" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Sparkles className="size-5 text-amber-500" aria-hidden />
            Suggestions pour vous
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Classées selon vos domaines, compétences recherchées, modalité et langue.
          </p>
        </div>
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="size-3.5" aria-hidden />
          Score calculé par des règles transparentes, sans IA.
        </p>
      </div>
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.items.slice(0, 3).map(({ mentor, score, reasons }) => (
          <li key={mentor.id}>
            <MentorCard
              mentor={mentor}
              footer={
                <div className="rounded-md bg-teal-50/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-teal-800">Correspondance</span>
                    <span className="text-sm font-semibold text-teal-800 tabular-nums">{score}/100</span>
                  </div>
                  <ul className="mt-1.5 grid gap-1">
                    {reasons.slice(0, 3).map((r) => (
                      <li key={r} className="flex gap-1.5 text-xs leading-snug text-ink-700">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-teal-600" aria-hidden />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              }
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Directory() {
  const [filters, update] = useFilters();
  const { data: me } = useMe();
  const domains = useDomains();
  const mentors = useMentors(filters);
  const [q, setQ] = useState(filters.q ?? '');
  const [showFilters, setShowFilters] = useState(false);

  // Recherche avec anti-rebond (350 ms).
  useEffect(() => {
    if (q === (filters.q ?? '')) return;
    const t = setTimeout(() => update({ q }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const activeDomain = domains.data?.find((d) => d.slug === filters.domain);
  const activeCount = [filters.domain, filters.modality, filters.language, filters.available].filter(Boolean).length;
  const isMentee = me?.role === 'MENTEE' && me.hasProfile;

  return (
    <>
      <PageHeader
        title="Trouver un mentor"
        description="Des professionnels prêts à partager leur expérience. Filtrez selon vos besoins, puis envoyez une demande motivée."
      />

      {isMentee && !filters.q && activeCount === 0 && filters.page === 1 && <Suggestions />}

      <div className="mb-6 rounded-lg border border-border bg-surface p-3 shadow-card sm:p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Compétence, métier, mot-clé… (ex. « développement web »)"
              aria-label="Rechercher un mentor"
              className="pl-10"
            />
          </div>
          <Button
            variant="secondary"
            className="md:hidden"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            aria-controls="filtres"
          >
            <SlidersHorizontal aria-hidden />
            Filtres
            {activeCount > 0 && (
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-ink-900 text-[11px] text-white">
                {activeCount}
              </span>
            )}
          </Button>
        </div>
        <div
          id="filtres"
          className={cn('mt-3 grid gap-3 sm:grid-cols-2 md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto]', !showFilters && 'hidden')}
        >
          <NativeSelect
            aria-label="Domaine"
            value={filters.domain}
            onChange={(e) => update({ domain: e.target.value })}
          >
            <option value="">Tous les domaines</option>
            {domains.data?.map((d) => (
              <option key={d.id} value={d.slug}>
                {d.name}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="Modalité"
            value={filters.modality}
            onChange={(e) => update({ modality: e.target.value as Modality | '' })}
          >
            <option value="">Toutes modalités</option>
            {(Object.keys(modalityLabels) as Modality[]).map((m) => (
              <option key={m} value={m}>
                {modalityLabels[m]}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="Langue"
            value={filters.language}
            onChange={(e) => update({ language: e.target.value })}
          >
            <option value="">Toutes langues</option>
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </NativeSelect>
          <label className="inline-flex h-11 items-center gap-2.5 rounded-md border border-border px-3.5 text-sm font-medium whitespace-nowrap hover:border-border-strong">
            <Checkbox
              checked={!!filters.available}
              onCheckedChange={(v) => update({ available: v === true })}
              aria-label="Avec un créneau disponible"
            />
            Créneau disponible
          </label>
        </div>
      </div>

      {activeDomain && isCampusFrance(activeDomain.slug) && (
        <p className="mb-5 flex items-start gap-2 rounded-md border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-[#7a4a0f]">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {CAMPUS_FRANCE_NOTICE}
        </p>
      )}

      <div className="mb-4 flex min-h-8 flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {mentors.data
            ? `${mentors.data.total} mentor${mentors.data.total > 1 ? 's' : ''} trouvé${mentors.data.total > 1 ? 's' : ''}`
            : 'Recherche en cours…'}
        </p>
        {activeCount > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {activeDomain && <Badge tone="outline">{activeDomain.name}</Badge>}
            {filters.modality && <Badge tone="outline">{modalityLabels[filters.modality]}</Badge>}
            {filters.language && <Badge tone="outline">{filters.language}</Badge>}
            {filters.available && <Badge tone="outline">Créneau disponible</Badge>}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => update({ domain: '', modality: '', language: '', available: false })}
            >
              <X aria-hidden />
              Effacer
            </Button>
          </div>
        )}
      </div>

      {mentors.isError ? (
        <ErrorState error={mentors.error} onRetry={() => void mentors.refetch()} />
      ) : mentors.isPending ? (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i}>
              <MentorCardSkeleton />
            </li>
          ))}
        </ul>
      ) : mentors.data.items.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Aucun mentor ne correspond à ces critères"
          description="Essayez un autre mot-clé ou retirez un filtre."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setQ('');
                update({ q: '', domain: '', modality: '', language: '', available: false });
              }}
            >
              Réinitialiser la recherche
            </Button>
          }
        />
      ) : (
        <>
          <ul
            className={cn(
              'grid gap-4 transition-opacity md:grid-cols-2 xl:grid-cols-3',
              mentors.isPlaceholderData && 'opacity-60',
            )}
          >
            {mentors.data.items.map((m) => (
              <li key={m.id}>
                <MentorCard mentor={m} />
              </li>
            ))}
          </ul>
          {mentors.data.totalPages > 1 && (
            <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-3">
              <Button
                variant="secondary"
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
                variant="secondary"
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
    </>
  );
}
