'use client';

import { BookOpen, ChevronDown, LoaderCircle, Plus, Search, SearchX } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { DomainIcon } from '@/components/domain-icon';
import { EmptyState, ErrorState } from '@/components/feedback/states';
import { BandChip, PageBand } from '@/components/layout/page-band';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { useMe } from '@/features/auth/api';
import { useDomains } from '@/features/catalog/api';
import { resourceKindLabels } from '@/lib/labels';
import { photos } from '@/lib/photos';
import type { Me, ResourceKind } from '@/lib/types';
import { cn, isStaff } from '@/lib/utils';
import { useLibrary, useMyResources } from './api';
import { ResourceCard } from './resource-card';
import { ResourceDialog } from './resource-dialog';

const KINDS: (ResourceKind | '')[] = [
  '',
  'BOOK',
  'GUIDE',
  'PODCAST',
  'ADVICE',
  'ARTICLE',
  'VIDEO',
  'TEMPLATE',
  'TOOL',
];

/** Mes publications : statut de validation de chaque ressource proposée. */
function MyPublications({ me }: { me: Me }) {
  const [open, setOpen] = useState(false);
  const mine = useMyResources(true);
  const items = mine.data ?? [];
  if (items.length === 0) return null;
  const pending = items.filter((r) => r.status === 'PENDING').length;
  const rejected = items.filter((r) => r.status === 'REJECTED').length;
  return (
    <section className="mb-6 overflow-hidden rounded-xl bg-surface ring-1 ring-border">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left"
      >
        <span className="font-display text-[16px] font-semibold text-ink-900">
          Mes publications{' '}
          <span className="font-normal text-muted-foreground">({items.length})</span>
        </span>
        <span className="flex items-center gap-2">
          {pending > 0 && <Badge tone="amber">{pending} en attente</Badge>}
          {rejected > 0 && (
            <Badge tone="danger">
              {rejected} refusée{rejected > 1 ? 's' : ''}
            </Badge>
          )}
          <ChevronDown
            className={cn(
              'size-4 text-muted-foreground transition-transform',
              open && 'rotate-180',
            )}
            aria-hidden
          />
        </span>
      </button>
      {open && (
        <ul className="grid gap-5 border-t border-border/70 p-5 md:grid-cols-2 xl:grid-cols-3">
          {items.map((r) => (
            <li key={r.id} className="animate-slide-up">
              <ResourceCard resource={r} me={me} showStatus />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Bibliothèque publique de ressources et conseils (TDR §7.2). */
export function Library() {
  const { data: me } = useMe();
  const domains = useDomains();
  const [q, setQ] = useState('');
  const query = useDeferredValue(q.trim());
  const [domain, setDomain] = useState('');
  const [kind, setKind] = useState<ResourceKind | ''>('');
  const [page, setPage] = useState(1);
  const [publishing, setPublishing] = useState(false);
  const lib = useLibrary({ q: query.length >= 2 ? query : undefined, domain, kind, page });
  const canPublish = me?.role === 'MENTOR' || isStaff(me?.role);

  return (
    <>
      <PageBand
        title="Bibliothèque et ressources"
        description="Livres, guides, podcasts, fiches pratiques et modèles partagés par l’équipe et les mentors. Tout est gratuit et vérifié."
        photo={photos.eleves}
        actions={
          canPublish ? (
            <Button onClick={() => setPublishing(true)}>
              <Plus aria-hidden />
              Publier une ressource
            </Button>
          ) : undefined
        }
      >
        <div className="flex max-w-2xl items-stretch rounded-lg bg-surface text-ink-900 shadow-raised focus-within:ring-3 focus-within:ring-amber-400/60">
          <label htmlFor="recherche-ressource" className="sr-only">
            Rechercher une ressource
          </label>
          <span className="flex items-center pl-3 text-muted-foreground" aria-hidden>
            {lib.isFetching && q ? (
              <LoaderCircle className="size-5 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
          </span>
          <input
            id="recherche-ressource"
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Livre, guide, auteur, entretien, Campus France…"
            className="h-13 min-w-0 flex-1 bg-transparent px-3 text-[16px] outline-none placeholder:text-muted-foreground"
          />
        </div>
        <ul
          className="scrollbar-thin -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-2"
          aria-label="Filtrer par domaine"
        >
          <li>
            <BandChip
              active={!domain}
              onClick={() => {
                setDomain('');
                setPage(1);
              }}
            >
              Tous les domaines
            </BandChip>
          </li>
          {domains.data?.map((d) => (
            <li key={d.id}>
              <BandChip
                active={domain === d.slug}
                onClick={() => {
                  setDomain(domain === d.slug ? '' : d.slug);
                  setPage(1);
                }}
              >
                <DomainIcon
                  name={d.icon}
                  className={cn('size-4', domain === d.slug ? 'text-ink-950' : 'text-amber-400')}
                />
                {d.name}
              </BandChip>
            </li>
          ))}
        </ul>
      </PageBand>

      {me && canPublish && <MyPublications me={me} />}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div
          className="inline-flex flex-wrap rounded-full bg-surface p-1 ring-1 ring-border"
          role="group"
          aria-label="Type de ressource"
        >
          {KINDS.map((k) => (
            <button
              key={k || 'all'}
              type="button"
              onClick={() => {
                setKind(k);
                setPage(1);
              }}
              aria-pressed={kind === k}
              className={cn(
                'h-8 rounded-full px-3.5 text-[14px] font-semibold transition-colors',
                kind === k ? 'bg-ink-900 text-white' : 'text-muted-foreground hover:text-ink-900',
              )}
            >
              {k ? resourceKindLabels[k] : 'Tous les types'}
            </button>
          ))}
        </div>
        <p className="text-[14px] text-muted-foreground" aria-live="polite">
          {lib.data ? (
            <>
              <span className="font-semibold text-ink-900">{lib.data.total}</span> ressource
              {lib.data.total > 1 ? 's' : ''}
            </>
          ) : (
            'Chargement…'
          )}
        </p>
      </div>

      {lib.isError ? (
        <ErrorState error={lib.error} onRetry={() => void lib.refetch()} />
      ) : lib.isPending ? (
        <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i}>
              <Skeleton className="h-64" />
            </li>
          ))}
        </ul>
      ) : lib.data.items.length === 0 ? (
        <EmptyState
          icon={query || domain || kind ? SearchX : BookOpen}
          title={
            query || domain || kind
              ? 'Aucune ressource ne correspond'
              : 'La bibliothèque est encore vide'
          }
          description={
            canPublish
              ? 'Partagez un livre, un guide, un podcast ou une fiche pratique avec tous les mentorés.'
              : 'Les mentors publient ici leurs conseils et leurs ressources.'
          }
          action={
            canPublish ? (
              <Button onClick={() => setPublishing(true)}>
                <Plus aria-hidden />
                Publier une ressource
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <ul
            className={cn(
              'grid gap-6 md:grid-cols-2 xl:grid-cols-3',
              lib.isPlaceholderData && 'opacity-60',
            )}
          >
            {lib.data.items.map((r) => (
              <li key={r.id} className="animate-slide-up">
                <ResourceCard resource={r} me={me} />
              </li>
            ))}
          </ul>
          {lib.data.totalPages > 1 && (
            <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Précédent
              </Button>
              <span className="text-sm text-muted-foreground tabular-nums">
                Page {lib.data.page} sur {lib.data.totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= lib.data.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Suivant
              </Button>
            </nav>
          )}
        </>
      )}

      {canPublish && <ResourceDialog open={publishing} onOpenChange={setPublishing} />}
    </>
  );
}
