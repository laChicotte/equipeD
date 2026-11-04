'use client';

import { ArrowUpRight, Briefcase, CalendarClock, Globe2, LoaderCircle, MapPin, Plus, Search, SearchX } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState, ErrorState } from '@/components/feedback/states';
import { BandChip, PageBand } from '@/components/layout/page-band';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/input';
import { Checkbox, Skeleton } from '@/components/ui/misc';
import { useMe } from '@/features/auth/api';
import { useDomains } from '@/features/catalog/api';
import { errorMessage } from '@/lib/api';
import { formatDate, fullName } from '@/lib/format';
import { opportunityTypeLabels } from '@/lib/labels';
import { photos } from '@/lib/photos';
import type { Opportunity, OpportunityType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useMyOpportunities, useOpportunities, useOpportunityMutations } from './api';
import { OpportunityDialog } from './opportunity-dialog';

const TYPES: (OpportunityType | '')[] = ['', 'INTERNSHIP', 'JOB', 'CALL_FOR_PROJECTS', 'SCHOLARSHIP', 'TRAINING', 'EVENT'];

function daysLeft(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function Deadline({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-muted-foreground">Sans date limite</span>;
  const d = daysLeft(iso);
  if (d < 0) return <span className="text-muted-foreground">Clôturée le {formatDate(iso)}</span>;
  return (
    <span className={cn('font-semibold', d <= 7 ? 'text-[#8a5410]' : 'text-teal-800')}>
      {d === 0 ? 'Clôture aujourd’hui' : `Clôture dans ${d} jour${d > 1 ? 's' : ''}`}
      <span className="font-normal text-muted-foreground"> · {formatDate(iso)}</span>
    </span>
  );
}

function OpportunityCard({ item }: { item: Opportunity }) {
  return (
    <article className="flex h-full flex-col bg-surface p-6 ring-1 ring-border transition-shadow duration-300 hover:shadow-raised">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="ink">{opportunityTypeLabels[item.type]}</Badge>
        {item.domain && <Badge tone="teal" className="max-w-full truncate">{item.domain.name}</Badge>}
      </div>
      <h3 className="mt-4 font-display text-[20px] leading-snug font-semibold tracking-[-0.02em] text-ink-900">{item.title}</h3>
      <p className="mt-1 text-[15px] font-semibold text-foreground">{item.organization}</p>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-muted-foreground">
        {item.location && (
          <li className="inline-flex items-center gap-1.5">
            <MapPin className="size-4" aria-hidden />
            {item.location}
          </li>
        )}
        {item.isRemote && (
          <li className="inline-flex items-center gap-1.5">
            <Globe2 className="size-4" aria-hidden />À distance
          </li>
        )}
      </ul>
      <p className="mt-4 line-clamp-4 text-[15px] leading-relaxed text-foreground">{item.description}</p>
      <div className="mt-auto pt-6">
        <p className="flex items-center gap-2 bg-background px-3 py-2.5 text-[14px]">
          <CalendarClock className="size-4 shrink-0 text-teal-700" aria-hidden />
          <Deadline iso={item.deadline} />
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-muted-foreground">
            Partagée par <span className="font-semibold text-ink-900">{fullName(item.author)}</span>
          </p>
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-teal-700 hover:text-teal-800"
            >
              Candidater
              <ArrowUpRight className="size-4" aria-hidden />
              <span className="sr-only">(nouvel onglet)</span>
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function MyPublications() {
  const mine = useMyOpportunities(true);
  const { setArchived } = useOpportunityMutations();
  if (mine.isPending || mine.isError || mine.data.length === 0) return null;
  return (
    <section aria-labelledby="mes-publications" className="mt-16">
      <h2 id="mes-publications" className="font-display text-[24px] font-semibold tracking-[-0.025em] text-ink-900">
        Mes publications
      </h2>
      <ul className="mt-5 divide-y divide-border bg-surface ring-1 ring-border">
        {mine.data.map((o) => {
          const archived = !!o.archivedAt;
          const expired = !!o.deadline && daysLeft(o.deadline) < 0;
          return (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink-900">{o.title}</p>
                <p className="text-[13px] text-muted-foreground">
                  {opportunityTypeLabels[o.type]} · {o.organization} ·{' '}
                  {archived ? 'Archivée' : expired ? 'Expirée' : 'En ligne'}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                loading={setArchived.isPending && setArchived.variables?.id === o.id}
                onClick={() =>
                  setArchived.mutate(
                    { id: o.id, archived: !archived },
                    {
                      onSuccess: () => toast.success(archived ? 'Opportunité republiée' : 'Opportunité archivée'),
                      onError: (e) => toast.error(errorMessage(e)),
                    },
                  )
                }
              >
                {archived ? 'Republier' : 'Archiver'}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function OpportunitiesView() {
  const { data: me } = useMe();
  const domains = useDomains();
  const [q, setQ] = useState('');
  const query = useDeferredValue(q.trim());
  const [type, setType] = useState<OpportunityType | ''>('');
  const [domain, setDomain] = useState('');
  const [remote, setRemote] = useState(false);
  const [page, setPage] = useState(1);
  const [publishing, setPublishing] = useState(false);
  const list = useOpportunities({ q: query.length >= 2 ? query : undefined, type, domain, remote, page });
  const canPublish = me?.role === 'MENTOR' || me?.role === 'ADMIN';

  return (
    <>
      <PageBand
        title="Opportunités"
        description="Stages, emplois, appels à projets, bourses, formations et événements repérés par les mentors. Les dates limites dépassées disparaissent d’elles-mêmes."
        photo={photos.communaute}
        photoPosition="object-[50%_40%]"
        actions={
          canPublish ? (
            <Button onClick={() => setPublishing(true)} className="notch rounded-none bg-teal-600 hover:bg-teal-700">
              <Plus aria-hidden />
              Publier une opportunité
            </Button>
          ) : undefined
        }
      >
        <div className="flex items-stretch bg-white text-ink-900">
          <label htmlFor="recherche-opportunite" className="sr-only">
            Rechercher une opportunité
          </label>
          <span className="flex items-center pl-4 text-muted-foreground" aria-hidden>
            {list.isFetching && q ? <LoaderCircle className="size-5 animate-spin" /> : <Search className="size-5" />}
          </span>
          <input
            id="recherche-opportunite"
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Stage, atelier, financement, structure…"
            className="h-14 min-w-0 flex-1 bg-transparent px-3 text-[16px] outline-none placeholder:text-muted-foreground"
          />
        </div>
        <ul className="scrollbar-thin -mx-1 mt-5 flex gap-2 overflow-x-auto px-1 pb-2" aria-label="Filtrer par type">
          {TYPES.map((t) => (
            <li key={t || 'all'}>
              <BandChip active={type === t} onClick={() => { setType(t); setPage(1); }}>
                {t ? opportunityTypeLabels[t] : 'Toutes'}
              </BandChip>
            </li>
          ))}
        </ul>
      </PageBand>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 bg-surface px-4 py-3 ring-1 ring-border sm:px-6">
        <div className="flex flex-wrap items-center gap-4">
          <NativeSelect
            aria-label="Domaine"
            value={domain}
            onChange={(e) => { setDomain(e.target.value); setPage(1); }}
            className="h-11 w-auto min-w-56"
          >
            <option value="">Tous les domaines</option>
            {domains.data?.map((d) => (
              <option key={d.id} value={d.slug}>
                {d.name}
              </option>
            ))}
          </NativeSelect>
          <label className="inline-flex items-center gap-2.5 text-[14px] font-semibold">
            <Checkbox checked={remote} onCheckedChange={(v) => { setRemote(v === true); setPage(1); }} />
            Accessible à distance
          </label>
        </div>
        <p className="text-[14px] text-muted-foreground" aria-live="polite">
          {list.data ? (
            <>
              <span className="font-semibold text-ink-900">{list.data.total}</span> opportunité{list.data.total > 1 ? 's' : ''} ouverte{list.data.total > 1 ? 's' : ''}
            </>
          ) : (
            'Chargement…'
          )}
        </p>
      </div>

      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : list.isPending ? (
        <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i}>
              <Skeleton className="h-80" />
            </li>
          ))}
        </ul>
      ) : list.data.items.length === 0 ? (
        <EmptyState
          icon={query || type || domain || remote ? SearchX : Briefcase}
          title={query || type || domain || remote ? 'Aucune opportunité ne correspond' : 'Aucune opportunité ouverte pour le moment'}
          description="Revenez bientôt : les mentors partagent ici les stages, emplois et appels à projets qu’ils repèrent."
        />
      ) : (
        <>
          <ul className={cn('grid gap-6 md:grid-cols-2 xl:grid-cols-3', list.isPlaceholderData && 'opacity-60')}>
            {list.data.items.map((o) => (
              <li key={o.id} className="animate-slide-up">
                <OpportunityCard item={o} />
              </li>
            ))}
          </ul>
          {list.data.totalPages > 1 && (
            <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-3">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Précédent
              </Button>
              <span className="text-sm text-muted-foreground tabular-nums">
                Page {list.data.page} sur {list.data.totalPages}
              </span>
              <Button variant="secondary" size="sm" disabled={page >= list.data.totalPages} onClick={() => setPage(page + 1)}>
                Suivant
              </Button>
            </nav>
          )}
        </>
      )}

      {canPublish && <MyPublications />}
      {canPublish && <OpportunityDialog open={publishing} onOpenChange={setPublishing} />}
    </>
  );
}
