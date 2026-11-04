'use client';

import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  ExternalLink,
  Inbox,
  MessageSquare,
  Search,
  Send,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { EmptyState, ErrorState } from '@/components/feedback/states';
import { StatusBadge } from '@/components/feedback/status-badge';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress, Skeleton } from '@/components/ui/misc';
import { useMe } from '@/features/auth/api';
import { useDashboard, useMentorships } from '@/features/mentorships/api';
import { formatRelative, formatShortDate, formatTime, fullName } from '@/lib/format';
import type { Dashboard as DashboardData, Me, MentorshipSummary, Session } from '@/lib/types';
import { cn } from '@/lib/utils';

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  href,
  emphasis = false,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: LucideIcon;
  href?: string;
  emphasis?: boolean;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className={cn('text-[13px] leading-snug font-medium sm:text-sm', 'text-muted-foreground')}>{label}</span>
        <Icon className="hidden size-4 shrink-0 text-muted-foreground sm:block" aria-hidden />
      </div>
      <p className={cn('mt-2 text-3xl font-semibold tracking-tight tabular-nums sm:mt-3 sm:text-4xl', emphasis ? 'text-teal-700' : 'text-foreground')}>
        {value}
      </p>
      {hint && (
        <p className={cn('mt-1 text-xs', 'text-muted-foreground')}>{hint}</p>
      )}
    </>
  );
  const cls = cn(
    'block rounded-lg border border-border bg-surface p-4 transition-colors duration-150 sm:p-5',
    href && 'hover:border-ink-900',
  );
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function SessionRow({ session, me }: { session: Session & { mentorshipId: string }; me: Me }) {
  const other = me.role === 'MENTOR' ? session.mentee : session.mentor;
  return (
    <li className="flex min-w-0 items-center gap-4 py-3.5 first:pt-0 last:pb-0">
      <div className="flex w-14 shrink-0 flex-col items-center rounded-md border border-border bg-surface-muted py-1.5 text-center">
        <span className="text-xs font-semibold text-muted-foreground first-letter:uppercase">
          {formatShortDate(session.startsAt, me.timezone).split(' ')[0]}
        </span>
        <span className="text-lg leading-tight font-semibold">
          {new Intl.DateTimeFormat('fr-FR', { day: 'numeric', timeZone: me.timezone }).format(new Date(session.startsAt))}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-semibold">{session.topic}</p>
        <p className="text-xs text-muted-foreground">
          {formatTime(session.startsAt, me.timezone)} – {formatTime(session.endsAt, me.timezone)} · avec {fullName(other)}
        </p>
        <StatusBadge kind="session" status={session.status} className="mt-1.5" />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {session.status === 'CONFIRMED' && session.meetingUrl && (
          <Button asChild variant="soft" size="sm">
            <a href={session.meetingUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden />
              Rejoindre
            </a>
          </Button>
        )}
      </div>
    </li>
  );
}

function MentorshipRow({ m }: { m: MentorshipSummary }) {
  return (
    <li className="min-w-0">
      <Link
        href={`/mentorats/${m.id}`}
        className="flex items-center gap-4 rounded-md p-3 -mx-3 transition-colors hover:bg-surface-muted"
      >
        <Avatar person={m.counterpart} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{fullName(m.counterpart)}</p>
            {m.unreadCount > 0 && (
              <span className="inline-flex h-5 items-center rounded-full bg-teal-700 px-1.5 text-[11px] font-semibold text-white">
                {m.unreadCount} nouveau{m.unreadCount > 1 ? 'x' : ''}
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {m.lastMessage ? `${m.lastMessage.content} · ${formatRelative(m.lastMessage.createdAt)}` : m.initialGoal}
          </p>
        </div>
        <div className="hidden w-24 shrink-0 sm:block">
          {m.averageProgress !== null ? (
            <>
              <p className="mb-1 text-right text-xs font-semibold text-muted-foreground">{Math.round(m.averageProgress)} %</p>
              <Progress value={m.averageProgress} label={`Progression des objectifs avec ${m.counterpart.firstName}`} />
            </>
          ) : (
            <p className="text-right text-xs text-muted-foreground">Aucun objectif</p>
          )}
        </div>
      </Link>
    </li>
  );
}

function Tiles({ data, me }: { data: DashboardData; me: Me }) {
  const goalsHint =
    data.goals.total === 0
      ? 'Aucun objectif défini'
      : `${data.goals.completed} atteint${data.goals.completed > 1 ? 's' : ''} sur ${data.goals.total}`;

  if (me.role === 'MENTOR') {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile
          emphasis
          label="Demandes à traiter"
          value={data.pendingRequests}
          hint={data.pendingRequests ? 'Des mentorés attendent votre réponse' : 'Vous êtes à jour'}
          icon={Inbox}
          href="/demandes"
        />
        <StatTile
          label="Mentorés accompagnés"
          value={data.mentor ? `${data.activeMentorships}/${data.mentor.maxMentees}` : data.activeMentorships}
          hint="Capacité que vous avez fixée"
          icon={Users}
          href="/mentorats"
        />
        <StatTile
          label="Séances à confirmer"
          value={data.sessionsAwaitingConfirmation}
          hint="Demandées par vos mentorés"
          icon={CalendarClock}
          href="/seances"
        />
        <StatTile
          label="Créneaux libres à venir"
          value={data.mentor?.freeUpcomingSlots ?? 0}
          hint={data.mentor?.freeUpcomingSlots ? 'Visibles sur votre fiche' : 'Publiez des créneaux'}
          icon={CalendarPlus}
          href="/disponibilites"
        />
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <StatTile
        emphasis
        label="Mentorats en cours"
        value={data.activeMentorships}
        hint={data.activeMentorships ? 'Accédez à vos espaces de mentorat' : 'Trouvez votre premier mentor'}
        icon={Users}
        href={data.activeMentorships ? '/mentorats' : '/mentors'}
      />
      <StatTile
        label="Demandes en attente"
        value={data.pendingRequests}
        hint="En attente de réponse du mentor"
        icon={Send}
        href="/demandes"
      />
      <StatTile
        label="Messages non lus"
        value={data.unreadMessages}
        hint="Dans vos conversations"
        icon={MessageSquare}
        href="/mentorats"
      />
      <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] leading-snug font-medium text-muted-foreground sm:text-sm">Progression des objectifs</span>
          <span className="hidden sm:inline-flex items-center justify-center text-muted-foreground">
            <Target className="size-4" aria-hidden />
          </span>
        </div>
        <p className="mt-2 text-2xl font-semibold tracking-tight sm:mt-3 sm:text-3xl">
          {data.goals.averageProgress === null ? '—' : `${Math.round(data.goals.averageProgress)} %`}
        </p>
        {data.goals.averageProgress !== null && (
          <Progress value={data.goals.averageProgress} className="mt-2" label="Progression moyenne des objectifs" />
        )}
        <p className="mt-2 text-xs text-muted-foreground">{goalsHint}</p>
      </div>
    </div>
  );
}

export function Dashboard() {
  const { data: me } = useMe();
  const dash = useDashboard(!!me);
  const mentorships = useMentorships(!!me);

  if (!me) return null;
  if (dash.isError) return <ErrorState error={dash.error} onRetry={() => void dash.refetch()} />;

  const today = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: me.timezone,
  }).format(new Date());
  const active = mentorships.data?.filter((m) => m.status === 'ACTIVE') ?? [];

  return (
    <div className="grid gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground first-letter:uppercase">{today}</p>
          <h1 className="mt-1 text-3xl font-display font-semibold tracking-[-0.03em] text-ink-900 sm:text-4xl">Bonjour {me.firstName}</h1>
          <p className="mt-1 text-[15px] text-muted-foreground">
            {me.role === 'MENTOR'
              ? 'Voici l’essentiel de votre activité de mentor.'
              : 'Voici où en est votre accompagnement.'}
          </p>
        </div>
        <Button asChild variant={me.role === 'MENTOR' ? 'secondary' : 'primary'}>
          {me.role === 'MENTOR' ? (
            <Link href="/disponibilites">
              <CalendarPlus aria-hidden />
              Ajouter des créneaux
            </Link>
          ) : (
            <Link href="/mentors">
              <Search aria-hidden />
              Trouver un mentor
            </Link>
          )}
        </Button>
      </div>

      {dash.isPending ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[136px]" />
          ))}
        </div>
      ) : (
        <Tiles data={dash.data} me={me} />
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{me.role === 'MENTOR' ? 'Mes mentorés' : 'Mes mentorats'}</CardTitle>
              <CardDescription>Derniers échanges et progression des objectifs.</CardDescription>
            </div>
            {active.length > 0 && (
              <Button asChild variant="ghost" size="sm">
                <Link href="/mentorats">
                  Tout voir
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {mentorships.isPending ? (
              <div className="grid gap-3">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            ) : mentorships.isError ? (
              <ErrorState error={mentorships.error} onRetry={() => void mentorships.refetch()} />
            ) : active.length === 0 ? (
              <EmptyState
                className="border-none p-6"
                icon={Users}
                title={me.role === 'MENTOR' ? 'Aucun mentoré pour l’instant' : 'Aucun mentorat en cours'}
                description={
                  me.role === 'MENTOR'
                    ? 'Acceptez une demande pour démarrer un accompagnement.'
                    : 'Envoyez une demande motivée à un mentor qui correspond à votre objectif.'
                }
                action={
                  <Button asChild variant="secondary" size="sm">
                    <Link href={me.role === 'MENTOR' ? '/demandes' : '/mentors'}>
                      {me.role === 'MENTOR' ? 'Voir les demandes' : 'Explorer les mentors'}
                    </Link>
                  </Button>
                }
              />
            ) : (
              <ul className="grid gap-1">
                {active.slice(0, 5).map((m) => (
                  <MentorshipRow key={m.id} m={m} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Prochaines séances</CardTitle>
              <CardDescription>Heures affichées en heure de Conakry.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/seances">
                Agenda
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {dash.isPending ? (
              <div className="grid gap-3">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            ) : dash.data.upcomingSessions.length === 0 ? (
              <EmptyState
                className="border-none p-6"
                icon={CalendarDays}
                title="Aucune séance planifiée"
                description={
                  me.role === 'MENTOR'
                    ? 'Vos mentorés réservent sur vos créneaux libres.'
                    : 'Réservez un créneau depuis votre espace de mentorat.'
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {dash.data.upcomingSessions.map((s) => (
                  <SessionRow key={s.id} session={s} me={me} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
