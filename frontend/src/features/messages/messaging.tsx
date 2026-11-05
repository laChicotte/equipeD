'use client';

import {
  ArrowLeft,
  ExternalLink,
  Lock,
  MessagesSquare,
  Plus,
  Presentation,
  Search,
  UserSearch,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { EmptyState, ErrorState } from '@/components/feedback/states';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { useMe } from '@/features/auth/api';
import { useGroups } from '@/features/groups/api';
import { GroupConversation } from '@/features/groups/group-conversation';
import { CreateGroupDialog, GroupInfoDialog } from '@/features/groups/group-dialogs';
import { GroupWorkshopsDialog } from '@/features/groups/workshops';
import { CallButtons, previewText } from '@/features/messages/chat-parts';
import { Conversation } from '@/features/mentorships/conversation';
import { useMentorships } from '@/features/mentorships/api';
import { formatRelative, fullName, normalizeText } from '@/lib/format';
import type { GroupSummary, Me, MentorshipSummary } from '@/lib/types';
import { cn } from '@/lib/utils';

type Thread =
  | { kind: 'direct'; id: string; m: MentorshipSummary }
  | { kind: 'group'; id: string; g: GroupSummary };

const lastActivity = (t: Thread) =>
  new Date(
    t.kind === 'direct'
      ? (t.m.lastMessage?.createdAt ?? t.m.startedAt)
      : (t.g.lastMessage?.createdAt ?? t.g.createdAt),
  ).getTime();
const unread = (t: Thread) => (t.kind === 'direct' ? t.m.unreadCount : t.g.unreadCount);
const title = (t: Thread) => (t.kind === 'direct' ? fullName(t.m.counterpart) : t.g.name);

/** Tri : conversations avec messages non lus, puis la plus récente activité en premier. */
function sortThreads(list: Thread[]) {
  return [...list].sort(
    (a, b) =>
      (unread(b) > 0 ? 1 : 0) - (unread(a) > 0 ? 1 : 0) || lastActivity(b) - lastActivity(a),
  );
}

/** Pastille de groupe : jusqu'à trois photos de membres superposées. */
function GroupBadge({ g, className }: { g: GroupSummary; className?: string }) {
  if (g.preview.length === 0) {
    return (
      <span
        className={cn(
          'inline-flex size-12 shrink-0 items-center justify-center rounded-[30%] bg-teal-50 text-teal-800 ring-1 ring-teal-100 ring-inset',
          className,
        )}
        aria-hidden
      >
        <UsersRound className="size-5" />
      </span>
    );
  }
  const [a, b] = g.preview;
  return (
    <span className={cn('relative inline-block size-12 shrink-0', className)} aria-hidden>
      <Avatar person={a} size="sm" className="absolute top-0 left-0 size-8 ring-2 ring-surface" />
      {b ? (
        <Avatar
          person={b}
          size="sm"
          className="absolute right-0 bottom-0 size-8 ring-2 ring-surface"
        />
      ) : (
        <span className="absolute right-0 bottom-0 inline-flex size-8 items-center justify-center rounded-[30%] bg-teal-50 text-teal-800 ring-2 ring-surface">
          <UsersRound className="size-4" />
        </span>
      )}
    </span>
  );
}

function ThreadItem({
  t,
  me,
  active,
  onSelect,
}: {
  t: Thread;
  me: Me;
  active: boolean;
  onSelect: () => void;
}) {
  const count = unread(t);
  let preview: string;
  if (t.kind === 'direct') {
    const last = t.m.lastMessage;
    preview = last
      ? `${last.senderId === me.id && !last.callId ? 'Vous : ' : ''}${previewText(last)}`
      : 'Aucun message pour l’instant';
  } else {
    const last = t.g.lastMessage;
    preview = last
      ? `${last.senderId === me.id ? 'Vous' : last.sender.firstName} : ${previewText(last)}`
      : 'Aucun message pour l’instant';
  }
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
        {t.kind === 'direct' ? (
          <Avatar person={t.m.counterpart} size="md" className="size-12" />
        ) : (
          <GroupBadge g={t.g} />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span
              className={cn(
                'truncate text-[14px] text-ink-900',
                count > 0 ? 'font-bold' : 'font-semibold',
              )}
            >
              {title(t)}
            </span>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {formatRelative(new Date(lastActivity(t)).toISOString())}
            </span>
          </span>
          <span className="block truncate text-[12px] text-muted-foreground">
            {t.kind === 'direct' ? (
              <>
                {t.m.myRole === 'MENTEE' ? 'Votre mentor' : 'Votre mentoré·e'}
                {t.m.domain && <> · {t.m.domain.name}</>}
                {t.m.status === 'COMPLETED' && <> · mentorat clôturé</>}
              </>
            ) : (
              <>
                Groupe · {t.g.memberCount} membre{t.g.memberCount > 1 ? 's' : ''}
                {t.g.isOwner && <> · vous l’animez</>}
              </>
            )}
          </span>
          <span className="mt-0.5 flex items-center gap-2">
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-[13px]',
                count > 0 ? 'font-semibold text-ink-900' : 'text-muted-foreground',
              )}
            >
              {preview}
            </span>
            {count > 0 && (
              <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-teal-600 px-1.5 text-[11px] font-semibold text-white">
                {count}
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

/** Messagerie : conversations privées et groupes d'accompagnement, au même endroit. */
export function Messaging() {
  const { data: me } = useMe();
  const list = useMentorships(!!me);
  const groups = useGroups(!!me);
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [workshopsOpen, setWorkshopsOpen] = useState(false);

  const threads = useMemo(
    () =>
      sortThreads([
        ...(list.data ?? [])
          // Un mentorat annulé n'a plus de conversation.
          .filter((m) => m.status !== 'CANCELLED')
          .map((m): Thread => ({ kind: 'direct', id: m.id, m })),
        ...(groups.data ?? []).map((g): Thread => ({ kind: 'group', id: g.id, g })),
      ]),
    [list.data, groups.data],
  );
  const filtered = useMemo(() => {
    const term = normalizeText(q.trim());
    return term ? threads.filter((t) => normalizeText(title(t)).includes(term)) : threads;
  }, [threads, q]);

  const directId = params.get('c');
  const groupId = params.get('g');
  const selected =
    threads.find((t) =>
      groupId ? t.kind === 'group' && t.id === groupId : t.kind === 'direct' && t.id === directId,
    ) ?? null;
  // Sur grand écran, on ouvre la conversation la plus récente par défaut.
  const shown = selected ?? threads[0] ?? null;
  const select = (t: Thread | null) =>
    router.replace(t ? `${pathname}?${t.kind === 'group' ? 'g' : 'c'}=${t.id}` : pathname, {
      scroll: false,
    });
  const openGroup = (id: string) => router.replace(`${pathname}?g=${id}`, { scroll: false });

  if (!me) return null;
  const isMentor = me.role === 'MENTOR';
  const createDialog = isMentor && (
    <CreateGroupDialog open={creating} onOpenChange={setCreating} onCreated={openGroup} />
  );

  if (list.isError) return <ErrorState error={list.error} onRetry={() => void list.refetch()} />;
  if (groups.isError) {
    return <ErrorState error={groups.error} onRetry={() => void groups.refetch()} />;
  }

  if (list.isPending || groups.isPending) {
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
            isMentor
              ? 'Une conversation privée s’ouvre dès que vous acceptez la demande d’un mentoré. Vous pouvez aussi créer un groupe pour accompagner plusieurs personnes ensemble.'
              : 'Une conversation privée s’ouvre dès qu’un mentor accepte votre demande.'
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild variant="secondary">
                <Link href={isMentor ? '/demandes' : '/mentors'}>
                  {isMentor ? (
                    'Voir les demandes reçues'
                  ) : (
                    <>
                      <UserSearch aria-hidden />
                      Trouver un mentor
                    </>
                  )}
                </Link>
              </Button>
              {isMentor && (
                <Button onClick={() => setCreating(true)}>
                  <UsersRound aria-hidden />
                  Créer un groupe
                </Button>
              )}
            </div>
          }
        />
        {createDialog}
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
            <div className="flex items-center justify-between gap-2">
              <h1 className="font-display text-[20px] font-semibold text-ink-900">Messagerie</h1>
              {isMentor && (
                <Button size="sm" variant="soft" onClick={() => setCreating(true)}>
                  <Plus aria-hidden />
                  Nouveau groupe
                </Button>
              )}
            </div>
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
                placeholder="Rechercher une personne ou un groupe"
                className="h-9 w-full rounded-md border border-border bg-background pr-3 pl-9 text-[14px] outline-none placeholder:text-muted-foreground focus:border-teal-600 focus:bg-surface"
              />
            </div>
          </div>
          <ul
            className="scrollbar-thin min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto"
            aria-label="Conversations"
          >
            {filtered.map((t) => (
              <ThreadItem
                key={`${t.kind}-${t.id}`}
                t={t}
                me={me}
                active={shown?.kind === t.kind && shown.id === t.id}
                onSelect={() => select(t)}
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
            aria-label={
              shown.kind === 'direct'
                ? `Conversation avec ${fullName(shown.m.counterpart)}`
                : `Groupe ${shown.g.name}`
            }
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
              {shown.kind === 'direct' ? (
                <>
                  <Avatar person={shown.m.counterpart} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-ink-900">
                      {fullName(shown.m.counterpart)}
                    </p>
                    <p className="truncate text-[12px] text-muted-foreground">
                      {shown.m.initialGoal}
                    </p>
                  </div>
                  <CallButtons
                    mentorshipId={shown.m.id}
                    peer={shown.m.counterpart}
                    disabled={shown.m.status === 'CANCELLED'}
                  />
                  <Button asChild variant="secondary" size="sm" className="shrink-0">
                    <Link href={`/mentorats/${shown.m.id}`}>
                      <ExternalLink aria-hidden />
                      <span className="hidden sm:inline">Espace de mentorat</span>
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <GroupBadge g={shown.g} className="size-10" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-ink-900">
                      {shown.g.name}
                    </p>
                    <p className="truncate text-[12px] text-muted-foreground">
                      {shown.g.memberCount} membre{shown.g.memberCount > 1 ? 's' : ''}
                      {shown.g.description && <> · {shown.g.description}</>}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setWorkshopsOpen(true)}
                  >
                    <Presentation aria-hidden />
                    <span className="hidden sm:inline">Ateliers</span>
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setInfoOpen(true)}
                  >
                    <UsersRound aria-hidden />
                    <span className="hidden sm:inline">
                      {shown.g.isOwner ? 'Gérer le groupe' : 'Membres'}
                    </span>
                  </Button>
                </>
              )}
            </header>
            {shown.kind === 'direct' ? (
              <Conversation
                key={shown.id}
                mentorship={shown.m}
                me={me}
                hideHeader
                className="h-auto min-h-0 flex-1 rounded-none border-0 shadow-none"
              />
            ) : (
              <>
                <GroupConversation key={shown.id} group={shown.g} me={me} />
                <GroupWorkshopsDialog
                  key={`ateliers-${shown.id}`}
                  groupId={shown.id}
                  groupName={shown.g.name}
                  isOwner={shown.g.isOwner}
                  me={me}
                  open={workshopsOpen}
                  onOpenChange={setWorkshopsOpen}
                />
                <GroupInfoDialog
                  key={`info-${shown.id}`}
                  groupId={shown.id}
                  me={me}
                  open={infoOpen}
                  onOpenChange={setInfoOpen}
                  onLeft={() => select(null)}
                />
              </>
            )}
          </section>
        )}
      </div>
      {createDialog}
    </div>
  );
}
