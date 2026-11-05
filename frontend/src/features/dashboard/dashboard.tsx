'use client';

import {
  ArrowRight,
  Award,
  BookOpen,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  ExternalLink,
  Inbox,
  MessageSquare,
  Send,
  Target,
  UserSearch,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EmptyState, ErrorState } from '@/components/feedback/states';
import { NOTIFICATION_ICONS } from '@/components/layout/notification-bell';
import { StatusBadge } from '@/components/feedback/status-badge';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress, Skeleton } from '@/components/ui/misc';
import { useMe } from '@/features/auth/api';
import { useDashboard, useMentorships } from '@/features/mentorships/api';
import { useNotifications } from '@/features/notifications/api';
import { formatRelative, formatShortDate, formatTime, fullName } from '@/lib/format';
import type { Dashboard as DashboardData, Me, MentorshipSummary, Session } from '@/lib/types';
import { cn } from '@/lib/utils';

function SessionRow({ session, me }: { session: Session & { mentorshipId: string }; me: Me }) {
  const other = me.role === 'MENTOR' ? session.mentee : session.mentor;
  return (
    <li className="flex min-w-0 items-center gap-4 py-3.5 first:pt-0 last:pb-0">
      <div className="flex w-14 shrink-0 flex-col items-center rounded-md border border-border bg-surface-muted py-1.5 text-center">
        <span className="text-xs font-semibold text-muted-foreground first-letter:uppercase">
          {formatShortDate(session.startsAt, me.timezone).split(' ')[0]}
        </span>
        <span className="text-lg leading-tight font-semibold">
          {new Intl.DateTimeFormat('fr-FR', { day: 'numeric', timeZone: me.timezone }).format(
            new Date(session.startsAt),
          )}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-semibold">{session.topic}</p>
        <p className="text-xs text-muted-foreground">
          {formatTime(session.startsAt, me.timezone)} – {formatTime(session.endsAt, me.timezone)} ·
          avec {fullName(other)}
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
            {m.lastMessage
              ? `${m.lastMessage.content} · ${formatRelative(m.lastMessage.createdAt)}`
              : m.initialGoal}
          </p>
        </div>
        <div className="hidden w-24 shrink-0 sm:block">
          {m.averageProgress !== null ? (
            <>
              <p className="mb-1 text-right text-xs font-semibold text-muted-foreground">
                {Math.round(m.averageProgress)} %
              </p>
              <Progress
                value={m.averageProgress}
                label={`Progression des objectifs avec ${m.counterpart.firstName}`}
              />
            </>
          ) : (
            <p className="text-right text-xs text-muted-foreground">Aucun objectif</p>
          )}
        </div>
      </Link>
    </li>
  );
}

/* ── Boîte d'action (en tête du fil) ──────────────────────────────────────── */

function Composer({ me }: { me: Me }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const actions =
    me.role === 'MENTOR'
      ? [
          {
            href: '/disponibilites',
            label: 'Ajouter des créneaux',
            icon: CalendarPlus,
            tone: 'text-teal-600',
          },
          { href: '/demandes', label: 'Demandes reçues', icon: Inbox, tone: 'text-amber-500' },
          {
            href: '/ressources',
            label: 'Publier une ressource',
            icon: BookOpen,
            tone: 'text-ink-700',
          },
        ]
      : [
          { href: '/mentors', label: 'Trouver un mentor', icon: UserSearch, tone: 'text-teal-600' },
          { href: '/seances', label: 'Mes séances', icon: CalendarDays, tone: 'text-amber-500' },
          { href: '/ressources', label: 'Ressources', icon: BookOpen, tone: 'text-ink-700' },
        ];
  return (
    <section className={feedCard} aria-label="Actions rapides">
      <div className="flex items-center gap-3 px-4 pt-4">
        <Avatar person={me} size="lg" className="size-12" />
        <form
          role="search"
          className="min-w-0 flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(q.trim() ? `/mentors?q=${encodeURIComponent(q.trim())}` : '/mentors');
          }}
        >
          <label htmlFor="recherche-fil" className="sr-only">
            Rechercher un mentor
          </label>
          <input
            id="recherche-fil"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`${me.firstName}, quelle compétence voulez-vous développer ?`}
            className="h-12 w-full rounded-full border border-border-strong bg-surface px-5 text-[14px] font-medium text-ink-900 outline-none placeholder:text-muted-foreground hover:bg-background focus:border-teal-600 focus:ring-3 focus:ring-teal-600/15"
          />
        </form>
      </div>
      <div className="mt-2 grid grid-cols-3 px-2 pb-1.5">
        {actions.map(({ href, label, icon: Icon, tone }) => (
          <Link
            key={href}
            href={href}
            className="flex h-12 items-center justify-center gap-2 rounded-md px-2 text-[14px] font-semibold text-muted-foreground transition-colors hover:bg-background hover:text-ink-900"
          >
            <Icon className={cn('size-5 shrink-0', tone)} aria-hidden />
            <span className="truncate">{label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ── Chiffres compacts, en une carte ──────────────────────────────────────── */

function StatsCard({ data, me }: { data: DashboardData; me: Me }) {
  const items =
    me.role === 'MENTOR'
      ? [
          {
            label: 'Demandes à traiter',
            value: data.pendingRequests,
            href: '/demandes',
            icon: Inbox,
          },
          {
            label: 'Mentorés en cours',
            value: data.activeMentorships,
            href: '/mentorats',
            icon: Users,
          },
          {
            label: 'Séances à confirmer',
            value: data.sessionsAwaitingConfirmation,
            href: '/seances',
            icon: CalendarClock,
          },
          {
            label: 'Certificats obtenus',
            value: data.mentor?.certificates ?? 0,
            href: `/mentors/${me.id}#certificats`,
            icon: Award,
          },
        ]
      : [
          {
            label: 'Mentorats en cours',
            value: data.activeMentorships,
            href: '/mentorats',
            icon: Users,
          },
          {
            label: 'Demandes en attente',
            value: data.pendingRequests,
            href: '/demandes',
            icon: Send,
          },
          {
            label: 'Messages non lus',
            value: data.unreadMessages,
            href: '/mentorats',
            icon: MessageSquare,
          },
          {
            label: 'Objectifs atteints',
            value:
              data.goals.averageProgress === null
                ? '—'
                : `${Math.round(data.goals.averageProgress)} %`,
            href: '/mentorats',
            icon: Target,
          },
        ];
  return (
    <section className={feedCard} aria-labelledby="titre-activite">
      <div className="flex items-baseline justify-between px-4 pt-4">
        <h2 id="titre-activite" className="font-display text-[17px] font-semibold text-ink-900">
          Votre activité
        </h2>
        <span className="text-[12px] text-muted-foreground">Données en temps réel</span>
      </div>
      <ul className="mt-2 grid grid-cols-2 sm:grid-cols-4">
        {items.map(({ label, value, href, icon: Icon }, i) => (
          <li
            key={label}
            className={cn(
              'border-border/70',
              i > 0 && 'sm:border-l',
              i % 2 === 1 && 'border-l',
              i >= 2 && 'border-t sm:border-t-0',
            )}
          >
            <Link href={href} className="block px-4 py-3.5 transition-colors hover:bg-background">
              <Icon className="size-4 text-teal-700" aria-hidden />
              <span className="mt-2 block font-display text-[26px] leading-none font-semibold text-ink-900 tabular-nums">
                {value}
              </span>
              <span className="mt-1 block text-[12px] leading-snug text-muted-foreground">
                {label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── Fil d'activité (notifications réelles) ───────────────────────────────── */

function ActivityFeed() {
  const list = useNotifications(true);
  const items = list.data?.slice(0, 6) ?? [];
  if (list.isPending) return <Skeleton className="h-40" />;
  if (items.length === 0) return null;
  return (
    <>
      <div className="flex items-center gap-3 px-1" aria-hidden>
        <span className="h-px flex-1 bg-border-strong/70" />
        <span className="text-[12px] font-medium text-muted-foreground">
          Fil d’activité · le plus récent
        </span>
      </div>
      <ul className="grid gap-2">
        {items.map((n) => {
          const Icon = NOTIFICATION_ICONS[n.type];
          return (
            <li key={n.id} className={feedCard}>
              <article className="px-4 py-3.5">
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      'inline-flex size-11 shrink-0 items-center justify-center rounded-[30%]',
                      n.readAt ? 'bg-surface-muted text-ink-800' : 'bg-teal-50 text-teal-700',
                    )}
                    aria-hidden
                  >
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] leading-snug font-semibold text-ink-900">{n.title}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {formatRelative(n.createdAt)}
                      {!n.readAt && (
                        <span className="ml-1.5 font-semibold text-teal-700">· nouveau</span>
                      )}
                    </p>
                  </div>
                </div>
                {n.body && (
                  <p className="mt-2.5 text-[14px] leading-relaxed text-foreground">{n.body}</p>
                )}
                {n.link && (
                  <div className="mt-2 -mb-1 border-t border-border/70 pt-1">
                    <Link
                      href={n.link}
                      className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-background hover:text-ink-900"
                    >
                      <ArrowRight className="size-4" aria-hidden />
                      Ouvrir
                    </Link>
                  </div>
                )}
              </article>
            </li>
          );
        })}
      </ul>
    </>
  );
}

const feedCard = 'overflow-hidden rounded-lg bg-surface shadow-card ring-1 ring-border/70';

export function Dashboard() {
  const { data: me } = useMe();
  const dash = useDashboard(!!me);
  const mentorships = useMentorships(!!me);

  if (!me) return null;
  if (dash.isError) return <ErrorState error={dash.error} onRetry={() => void dash.refetch()} />;

  const active = mentorships.data?.filter((m) => m.status === 'ACTIVE') ?? [];

  return (
    <div className="grid gap-3">
      <h1 className="sr-only">Accueil de {me.firstName}</h1>
      <Composer me={me} />
      {dash.isPending ? <Skeleton className="h-[128px]" /> : <StatsCard data={dash.data} me={me} />}

      <div className="grid gap-3">
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
                title={
                  me.role === 'MENTOR' ? 'Aucun mentoré pour l’instant' : 'Aucun mentorat en cours'
                }
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
      <ActivityFeed />
    </div>
  );
}
