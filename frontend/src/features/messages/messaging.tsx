'use client';

import { ArrowLeft, ExternalLink, Lock, MessagesSquare, Search, UserSearch } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { EmptyState, ErrorState } from '@/components/feedback/states';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { useMe } from '@/features/auth/api';
import { Conversation } from '@/features/mentorships/conversation';
import { useMentorships } from '@/features/mentorships/api';
import { formatRelative, fullName, normalizeText } from '@/lib/format';
import type { Me, MentorshipSummary } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Tri : conversations avec messages non lus, puis la plus récente activité en premier. */
function sortThreads(list: MentorshipSummary[]) {
  const last = (m: MentorshipSummary) =>
    new Date(m.lastMessage?.createdAt ?? m.startedAt).getTime();
  return [...list].sort(
    (a, b) => (b.unreadCount > 0 ? 1 : 0) - (a.unreadCount > 0 ? 1 : 0) || last(b) - last(a),
  );
}

function ThreadItem({
  m,
  me,
  active,
  onSelect,
}: {
  m: MentorshipSummary;
  me: Me;
  active: boolean;
  onSelect: () => void;
}) {
  const mine = m.lastMessage?.senderId === me.id;
  const preview = m.lastMessage
    ? `${mine ? 'Vous : ' : ''}${m.lastMessage.content}`
    : 'Aucun message pour l’instant';
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? 'true' : undefined}
        className={cn(
          'relative flex w-full gap-3 px-4 py-3.5 text-left transition-colors',
          active ? 'bg-teal-50/70' : 'hover:bg-background',
        )}
      >
        {active && <span className="absolute inset-y-0 left-0 w-[3px] bg-teal-600" aria-hidden />}
        <Avatar person={m.counterpart} size="md" className="size-12" />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span
              className={cn(
                'truncate text-[14px] text-ink-900',
                m.unreadCount > 0 ? 'font-bold' : 'font-semibold',
              )}
            >
              {fullName(m.counterpart)}
            </span>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {formatRelative(m.lastMessage?.createdAt ?? m.startedAt)}
            </span>
          </span>
          <span className="block truncate text-[12px] text-muted-foreground">
            {m.myRole === 'MENTEE' ? 'Votre mentor' : 'Votre mentoré·e'}
            {m.domain && <> · {m.domain.name}</>}
            {m.status !== 'ACTIVE' && <> · clôturé</>}
          </span>
          <span className="mt-0.5 flex items-center gap-2">
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-[13px]',
                m.unreadCount > 0 ? 'font-semibold text-ink-900' : 'text-muted-foreground',
              )}
            >
              {preview}
            </span>
            {m.unreadCount > 0 && (
              <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-teal-600 px-1.5 text-[11px] font-semibold text-white">
                {m.unreadCount}
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

/** Messagerie : toutes les conversations privées de l'utilisateur, au même endroit. */
export function Messaging() {
  const { data: me } = useMe();
  const list = useMentorships(!!me);
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState('');

  const threads = useMemo(() => sortThreads(list.data ?? []), [list.data]);
  const filtered = useMemo(() => {
    const term = normalizeText(q.trim());
    return term
      ? threads.filter((m) => normalizeText(fullName(m.counterpart)).includes(term))
      : threads;
  }, [threads, q]);

  const selectedId = params.get('c');
  const selected = threads.find((m) => m.id === selectedId) ?? null;
  // Sur grand écran, on ouvre la conversation la plus récente par défaut.
  const shown = selected ?? threads[0] ?? null;
  const select = (id: string | null) =>
    router.replace(id ? `${pathname}?c=${id}` : pathname, { scroll: false });

  if (!me) return null;
  if (list.isError) return <ErrorState error={list.error} onRetry={() => void list.refetch()} />;

  if (list.isPending) {
    return (
      <div className="grid h-[calc(100dvh-180px)] min-h-[480px] gap-0 overflow-hidden rounded-lg bg-surface ring-1 ring-border/70 md:grid-cols-[340px_minmax(0,1fr)]">
        <div className="grid content-start gap-3 border-r border-border/70 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
        <Skeleton className="hidden m-4 md:block" />
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="mx-auto max-w-[1128px]">
        <h1 className="mb-4 font-display text-[22px] font-semibold text-ink-900">Messagerie</h1>
        <EmptyState
          icon={MessagesSquare}
          title="Aucune conversation pour l’instant"
          description={
            me.role === 'MENTOR'
              ? 'Une conversation privée s’ouvre dès que vous acceptez la demande d’un mentoré.'
              : 'Une conversation privée s’ouvre dès qu’un mentor accepte votre demande.'
          }
          action={
            <Button asChild variant="secondary">
              <Link href={me.role === 'MENTOR' ? '/demandes' : '/mentors'}>
                {me.role === 'MENTOR' ? (
                  'Voir les demandes reçues'
                ) : (
                  <>
                    <UserSearch aria-hidden />
                    Trouver un mentor
                  </>
                )}
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1128px]">
      <div className="grid h-[calc(100dvh-180px)] min-h-[480px] overflow-hidden rounded-lg bg-surface shadow-card ring-1 ring-border/70 md:grid-cols-[340px_minmax(0,1fr)] lg:h-[calc(100dvh-140px)]">
        {/* Liste des conversations */}
        <aside
          className={cn(
            'flex min-h-0 flex-col border-r border-border/70',
            selected && 'hidden md:flex',
          )}
        >
          <div className="border-b border-border/70 px-4 pt-4 pb-3">
            <h1 className="font-display text-[20px] font-semibold text-ink-900">Messagerie</h1>
            <div className="relative mt-3">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <label htmlFor="recherche-conversation" className="sr-only">
                Rechercher une conversation
              </label>
              <input
                id="recherche-conversation"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher une conversation"
                className="h-9 w-full rounded-md border border-border bg-background pr-3 pl-9 text-[14px] outline-none placeholder:text-muted-foreground focus:border-teal-600 focus:bg-surface"
              />
            </div>
          </div>
          <ul
            className="scrollbar-thin min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto"
            aria-label="Conversations"
          >
            {filtered.map((m) => (
              <ThreadItem
                key={m.id}
                m={m}
                me={me}
                active={shown?.id === m.id}
                onSelect={() => select(m.id)}
              />
            ))}
            {filtered.length === 0 && (
              <li className="px-4 py-6 text-center text-[13px] text-muted-foreground">
                Aucun résultat.
              </li>
            )}
          </ul>
          <p className="flex items-center gap-1.5 border-t border-border/70 px-4 py-2.5 text-[11px] text-muted-foreground">
            <Lock className="size-3" aria-hidden />
            Conversations privées, visibles des seuls participants.
          </p>
        </aside>

        {/* Conversation ouverte */}
        {shown && (
          <section
            className={cn('min-h-0 flex-col', selected ? 'flex' : 'hidden md:flex')}
            aria-label={`Conversation avec ${fullName(shown.counterpart)}`}
          >
            <header className="flex items-center gap-3 border-b border-border/70 px-4 py-3">
              <button
                type="button"
                onClick={() => select(null)}
                className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-background md:hidden"
                aria-label="Retour aux conversations"
              >
                <ArrowLeft className="size-5" />
              </button>
              <Avatar person={shown.counterpart} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-ink-900">
                  {fullName(shown.counterpart)}
                </p>
                <p className="truncate text-[12px] text-muted-foreground">{shown.initialGoal}</p>
              </div>
              <Button asChild variant="secondary" size="sm" className="shrink-0">
                <Link href={`/mentorats/${shown.id}`}>
                  <ExternalLink aria-hidden />
                  <span className="hidden sm:inline">Espace de mentorat</span>
                </Link>
              </Button>
            </header>
            <Conversation
              key={shown.id}
              mentorship={shown}
              me={me}
              hideHeader
              className="h-auto min-h-0 flex-1 rounded-none border-0 shadow-none"
            />
          </section>
        )}
      </div>
    </div>
  );
}
