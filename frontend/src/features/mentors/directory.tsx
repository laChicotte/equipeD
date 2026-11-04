'use client';

import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Info,
  LoaderCircle,
  Search,
  SearchX,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { DomainIcon } from '@/components/domain-icon';
import { EmptyState, ErrorState } from '@/components/feedback/states';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/misc';
import { useMe } from '@/features/auth/api';
import { useDomains, useMentors, useSuggestions, type MentorFilters } from '@/features/catalog/api';
import { CAMPUS_FRANCE_NOTICE, LANGUAGES, isCampusFrance, modalityLabels } from '@/lib/labels';
import { photos } from '@/lib/photos';
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

/* ── Recommandations (score déterministe et expliqué) ─────────────────────── */

function Suggestions() {
  const { data, isPending, isError } = useSuggestions(true);
  if (isPending || isError || !data) return null;
  if (data.profileRequired || data.items.length === 0) return null;
  return (
    <section aria-labelledby="suggestions-title" className="mb-14">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="suggestions-title" className="flex items-center gap-2.5 font-display text-[26px] font-semibold tracking-[-0.025em] text-ink-900">
            <Sparkles className="size-6 text-amber-500" aria-hidden />
            Recommandés pour vous
          </h2>
          <p className="mt-1 text-[15px] text-muted-foreground">
            Selon vos domaines, les compétences que vous recherchez, votre modalité et vos langues.
          </p>
        </div>
        <p className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Info className="size-4" aria-hidden />
          Score calculé par des règles transparentes, sans IA.
        </p>
      </div>
      <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {data.items.slice(0, 3).map(({ mentor, score, reasons }) => (
          <li key={mentor.id}>
            <MentorCard
              mentor={mentor}
              footer={
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] font-semibold text-ink-900">Correspondance</span>
                    <span className="font-display text-[18px] font-semibold text-teal-700 tabular-nums">
                      {score}
                      <span className="text-[13px] text-muted-foreground"> /100</span>
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 bg-ink-50" role="img" aria-label={`Correspondance ${score} sur 100`}>
                    <div className="h-full bg-teal-600 transition-[width] duration-700" style={{ width: `${score}%` }} />
                  </div>
                  <ul className="mt-3 grid gap-1.5">
                    {reasons.slice(0, 3).map((r) => (
                      <li key={r} className="flex gap-2 text-[13px] leading-snug text-foreground">
                        <span className="mt-[7px] size-1.5 shrink-0 bg-amber-400" aria-hidden />
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

/* ── Écran ────────────────────────────────────────────────────────────────── */

const MODALITIES: (Modality | '')[] = ['', 'REMOTE', 'IN_PERSON', 'HYBRID'];

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
  const activeCount = [filters.modality, filters.language, filters.available].filter(Boolean).length;
  const isMentee = me?.role === 'MENTEE' && me.hasProfile;
  const total = mentors.data?.total;
  const resetAll = () => {
    setQ('');
    update({ q: '', domain: '', modality: '', language: '', available: false });
  };

  return (
    <>
      {/* Bandeau : titre, recherche, domaines */}
      <section className="relative isolate overflow-hidden bg-ink-950 text-white">
        <div className="absolute inset-y-0 right-0 -z-10 hidden w-[46%] lg:block">
          <Image src={photos.mentor.src} alt="" fill sizes="46vw" priority className="photo object-cover object-[50%_30%]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(14_27_48),rgb(14_27_48/0.35)_45%,rgb(14_27_48/0.1))]" />
        </div>

        <div className="px-6 pt-10 pb-8 sm:px-10 sm:pt-14 lg:max-w-[62%]">
          <h1 className="font-display text-[clamp(2.5rem,1.6rem+2.8vw,4rem)] leading-[0.98] font-semibold tracking-[-0.035em]">
            Trouver un mentor
          </h1>
          <p className="mt-4 max-w-[48ch] text-[17px] leading-relaxed text-ink-100">
            Des professionnels prêts à partager leur expérience. Cherchez par compétence ou par
            domaine, puis envoyez une demande motivée.
          </p>

          <div className="mt-8 flex items-stretch bg-white text-ink-900">
            <label htmlFor="recherche-mentor" className="sr-only">
              Rechercher un mentor
            </label>
            <span className="flex items-center pl-4 text-muted-foreground" aria-hidden>
              {mentors.isFetching && q ? <LoaderCircle className="size-5 animate-spin" /> : <Search className="size-5" />}
            </span>
            <input
              id="recherche-mentor"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Compétence, métier, nom… ex. « développement web »"
              className="h-14 min-w-0 flex-1 bg-transparent px-3 text-[16px] outline-none placeholder:text-muted-foreground"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ('')}
                className="flex items-center px-3 text-muted-foreground hover:text-ink-900"
                aria-label="Effacer la recherche"
              >
                <X className="size-4" />
              </button>
            )}
            <span className="notch hidden items-center gap-2 bg-teal-600 pr-6 pl-5 text-[15px] font-semibold text-white sm:flex" aria-live="polite">
              {total === undefined ? '…' : `${total} mentor${total > 1 ? 's' : ''}`}
            </span>
          </div>
        </div>

        {/* Domaines en filtres rapides */}
        <div className="relative px-6 pb-6 sm:px-10">
          <ul className="scrollbar-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-2" aria-label="Filtrer par domaine">
            <li>
              <button
                type="button"
                onClick={() => update({ domain: '' })}
                aria-pressed={!filters.domain}
                className={cn(
                  'inline-flex h-10 items-center gap-2 px-4 text-[14px] font-semibold whitespace-nowrap transition-colors',
                  !filters.domain ? 'bg-teal-600 text-white' : 'bg-white/10 text-white hover:bg-white/20',
                )}
              >
                Tous les domaines
              </button>
            </li>
            {domains.data?.map((d) => {
              const on = filters.domain === d.slug;
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => update({ domain: on ? '' : d.slug })}
                    aria-pressed={on}
                    className={cn(
                      'inline-flex h-10 items-center gap-2 px-4 text-[14px] font-semibold whitespace-nowrap transition-colors',
                      on ? 'bg-teal-600 text-white' : 'bg-white/10 text-white hover:bg-white/20',
                    )}
                  >
                    <DomainIcon name={d.icon} className={cn('size-4', on ? 'text-white' : 'text-amber-400')} />
                    {d.name}
                    <span className={cn('tabular-nums', on ? 'text-teal-100' : 'text-white/60')}>{d.mentorCount}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Barre de filtres */}
      <div className="mb-10 bg-surface px-4 py-3 ring-1 ring-border sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="secondary"
            size="sm"
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
          <div id="filtres" className={cn('w-full flex-wrap items-center gap-3 md:flex md:w-auto', showFilters ? 'flex' : 'hidden')}>
            <div className="inline-flex flex-wrap bg-background p-1" role="group" aria-label="Modalité">
              {MODALITIES.map((m) => (
                <button
                  key={m || 'all'}
                  type="button"
                  onClick={() => update({ modality: m })}
                  aria-pressed={filters.modality === m}
                  className={cn(
                    'h-9 px-3.5 text-[14px] font-semibold transition-colors',
                    filters.modality === m ? 'bg-ink-900 text-white' : 'text-muted-foreground hover:text-ink-900',
                  )}
                >
                  {m ? modalityLabels[m] : 'Toutes modalités'}
                </button>
              ))}
            </div>
            <NativeSelect
              aria-label="Langue"
              value={filters.language}
              onChange={(e) => update({ language: e.target.value })}
              className="h-11 w-auto min-w-44"
            >
              <option value="">Toutes les langues</option>
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </NativeSelect>
            <label className="inline-flex h-11 cursor-pointer items-center gap-2.5 px-2 text-[14px] font-semibold whitespace-nowrap">
              <Checkbox
                checked={!!filters.available}
                onCheckedChange={(v) => update({ available: v === true })}
                aria-label="Avec un créneau disponible"
              />
              Disponible sous 14 jours
            </label>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-[14px] text-muted-foreground" aria-live="polite">
              {mentors.data ? (
                <>
                  <span className="font-semibold text-ink-900">{mentors.data.total}</span> résultat
                  {mentors.data.total > 1 ? 's' : ''}
                  {activeDomain && <> en {activeDomain.name.toLowerCase()}</>}
                </>
              ) : (
                'Recherche en cours…'
              )}
            </p>
            {(activeCount > 0 || filters.domain || filters.q) && (
              <Button variant="ghost" size="sm" onClick={resetAll}>
                <X aria-hidden />
                Tout effacer
              </Button>
            )}
          </div>
        </div>
      </div>

      {activeDomain && isCampusFrance(activeDomain.slug) && (
        <p className="mb-8 flex items-start gap-2 bg-amber-50 px-4 py-3 text-[14px] text-[#7a4a0f]">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {CAMPUS_FRANCE_NOTICE}
        </p>
      )}

      {isMentee && !filters.q && activeCount === 0 && !filters.domain && filters.page === 1 && <Suggestions />}

      {isMentee && !filters.q && activeCount === 0 && !filters.domain && filters.page === 1 && (
        <h2 className="mb-6 font-display text-[26px] font-semibold tracking-[-0.025em] text-ink-900">Tous les mentors</h2>
      )}

      {mentors.isError ? (
        <ErrorState error={mentors.error} onRetry={() => void mentors.refetch()} />
      ) : mentors.isPending ? (
        <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
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
          description="Essayez un autre mot-clé, un autre domaine ou retirez un filtre."
          action={
            <Button variant="secondary" onClick={resetAll}>
              Réinitialiser la recherche
            </Button>
          }
        />
      ) : (
        <>
          <ul
            className={cn(
              'grid gap-6 transition-opacity md:grid-cols-2 xl:grid-cols-3',
              mentors.isPlaceholderData && 'opacity-60',
            )}
          >
            {mentors.data.items.map((m) => (
              <li key={m.id} className="animate-slide-up">
                <MentorCard mentor={m} />
              </li>
            ))}
          </ul>
          {mentors.data.totalPages > 1 && (
            <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-3">
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
          {!me && (
            <div className="mt-14 flex flex-wrap items-center justify-between gap-6 bg-teal-700 px-8 py-8 text-white">
              <div>
                <p className="font-display text-[24px] font-semibold tracking-[-0.02em]">Un profil vous intéresse ?</p>
                <p className="mt-1 text-[15px] text-teal-50">Créez votre compte en deux minutes pour envoyer une demande motivée.</p>
              </div>
              <a
                href="/inscription"
                className="notch inline-flex h-12 items-center gap-2 bg-white pr-6 pl-5 text-[15px] font-semibold text-ink-900 transition-colors hover:bg-amber-100"
              >
                Créer mon compte <ArrowRight className="size-4" aria-hidden />
              </a>
            </div>
          )}
        </>
      )}
    </>
  );
}
