'use client';

import { CalendarClock, MessageSquare, Search, Users } from 'lucide-react';
import Link from 'next/link';
import { EmptyState, ErrorState, PageHeader } from '@/components/feedback/states';
import { StatusBadge } from '@/components/feedback/status-badge';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress, Skeleton } from '@/components/ui/misc';
import { useMe } from '@/features/auth/api';
import { formatRange, formatRelative, fullName } from '@/lib/format';
import { useMentorships } from './api';

export function MentorshipsList() {
  const { data: me } = useMe();
  const q = useMentorships(!!me);
  if (!me) return null;
  const mentor = me.role === 'MENTOR';

  return (
    <>
      <PageHeader
        title={mentor ? 'Mes mentorés' : 'Mes mentorats'}
        description={
          mentor
            ? 'Retrouvez chaque relation d’accompagnement : conversation, objectifs et séances.'
            : 'Vos espaces d’accompagnement avec vos mentors.'
        }
      />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : q.isPending ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-52" />
          <Skeleton className="h-52" />
        </div>
      ) : q.data.length === 0 ? (
        <EmptyState
          icon={Users}
          title={mentor ? 'Aucun mentoré pour l’instant' : 'Aucun mentorat pour l’instant'}
          description={
            mentor
              ? 'Quand vous acceptez une demande, l’espace de mentorat apparaît ici.'
              : 'Quand un mentor accepte votre demande, votre espace d’accompagnement apparaît ici.'
          }
          action={
            <Button asChild variant={mentor ? 'secondary' : 'primary'}>
              <Link href={mentor ? '/demandes' : '/mentors'}>
                {!mentor && <Search aria-hidden />}
                {mentor ? 'Voir les demandes reçues' : 'Trouver un mentor'}
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {q.data.map((m) => (
            <li key={m.id}>
              <Link
                href={`/mentorats/${m.id}`}
                className="group flex h-full flex-col rounded-lg border border-border bg-surface p-5 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-teal-200 hover:border-ink-900"
              >
                <div className="flex items-start gap-3.5">
                  <Avatar person={m.counterpart} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold tracking-tight">{fullName(m.counterpart)}</h2>
                      <StatusBadge kind="mentorship" status={m.status} />
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                      {m.counterpart.mentorProfile?.headline ?? m.counterpart.menteeProfile?.goalsSummary}
                    </p>
                    {m.domain && (
                      <Badge tone="teal" className="mt-2">
                        {m.domain.name}
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="mt-4 line-clamp-2 text-sm">
                  <span className="font-semibold">Objectif : </span>
                  {m.initialGoal}
                </p>
                <div className="mt-4 grid gap-2 text-[13px] text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <CalendarClock className="size-4 shrink-0 text-teal-700" aria-hidden />
                    {m.nextSession
                      ? `Prochaine séance : ${formatRange(m.nextSession.startsAt, m.nextSession.endsAt, me.timezone)}`
                      : 'Aucune séance planifiée'}
                  </p>
                  <p className="flex min-w-0 items-center gap-2">
                    <MessageSquare className="size-4 shrink-0 text-teal-700" aria-hidden />
                    <span className="truncate">
                      {m.lastMessage
                        ? `${m.lastMessage.senderId === me.id ? 'Vous : ' : ''}${m.lastMessage.content}`
                        : 'Aucun message'}
                    </span>
                    {m.lastMessage && <span className="shrink-0">· {formatRelative(m.lastMessage.createdAt)}</span>}
                    {m.unreadCount > 0 && (
                      <span className="ml-auto inline-flex h-5 shrink-0 items-center rounded-full bg-teal-700 px-1.5 text-[11px] font-semibold text-white">
                        {m.unreadCount}
                      </span>
                    )}
                  </p>
                </div>
                <div className="mt-auto pt-5">
                  <div className="mb-1.5 flex justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">
                      {m.goalsCount > 0 ? `${m.goalsCompleted}/${m.goalsCount} objectif(s) atteint(s)` : 'Aucun objectif défini'}
                    </span>
                    {m.averageProgress !== null && (
                      <span className="text-teal-800 tabular-nums">{Math.round(m.averageProgress)} %</span>
                    )}
                  </div>
                  <Progress value={m.averageProgress ?? 0} label="Progression moyenne des objectifs" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
