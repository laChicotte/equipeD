'use client';

import {
  Award,
  ArrowLeft,
  BookOpen,
  CalendarCheck2,
  CalendarDays,
  Flag,
  MessagesSquare,
  Target,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/input';
import { MentorshipResources } from '@/features/resources/mentorship-resources';
import { errorMessage } from '@/lib/api';
import { EmptyState, ErrorState } from '@/components/feedback/states';
import { StatusBadge } from '@/components/feedback/status-badge';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { useMe } from '@/features/auth/api';
import { useSessions } from '@/features/scheduling/api';
import { BookDialog } from '@/features/scheduling/book-dialog';
import { SessionCard } from '@/features/scheduling/session-card';
import { formatDate, formatRange, fullName } from '@/lib/format';
import { situationLabels } from '@/lib/labels';
import type { Me, MentorshipSummary } from '@/lib/types';
import { useCompleteMentorship, useMentorship } from './api';
import { Conversation } from './conversation';
import { GoalsPanel } from './goals';

function SessionsPanel({ mentorship, me }: { mentorship: MentorshipSummary; me: Me }) {
  const sessions = useSessions('all');
  const [booking, setBooking] = useState(false);
  const isMentee = mentorship.myRole === 'MENTEE';
  const active = mentorship.status === 'ACTIVE';

  if (sessions.isError)
    return <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} />;
  if (sessions.isPending) return <Skeleton className="h-32" />;

  const items = sessions.data
    .filter((s) => s.mentorshipId === mentorship.id)
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());

  return (
    <div className="grid gap-4">
      {isMentee && active && items.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={() => setBooking(true)}>
            <CalendarCheck2 aria-hidden />
            Réserver une séance
          </Button>
        </div>
      )}
      {items.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Aucune séance planifiée"
          description={
            isMentee
              ? `Choisissez un créneau libre de ${mentorship.mentor.firstName}.`
              : `${mentorship.mentee.firstName} peut réserver l’un de vos créneaux libres.`
          }
          action={
            isMentee && active ? (
              <Button onClick={() => setBooking(true)}>
                <CalendarCheck2 aria-hidden />
                Réserver une séance
              </Button>
            ) : !isMentee ? (
              <Button asChild variant="secondary">
                <Link href="/disponibilites">Gérer mes créneaux</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-3">
          {items.map((s) => (
            <li key={s.id}>
              <SessionCard session={s} me={me} showMentorshipLink={false} />
            </li>
          ))}
        </ul>
      )}
      {isMentee && (
        <BookDialog
          mentorId={mentorship.mentor.id}
          mentorFirstName={mentorship.mentor.firstName}
          open={booking}
          onOpenChange={setBooking}
          timezone={me.timezone}
        />
      )}
    </div>
  );
}

function CompleteDialog({
  mentorship,
  open,
  onOpenChange,
}: {
  mentorship: MentorshipSummary;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const complete = useCompleteMentorship(mentorship.id);
  const [note, setNote] = useState('');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Clôturer le mentorat"
        description={`Le mentorat avec ${mentorship.counterpart.firstName} passera en lecture seule (vous pourrez toujours échanger par message). Les séances à venir seront annulées et ${mentorship.counterpart.firstName} sera prévenu·e. Si au moins une séance a été réalisée, le mentor reçoit un certificat d’accompagnement vérifiable.`}
      >
        <Field
          label="Bilan de l’accompagnement"
          optional
          counter={{ value: note.length, max: 1000 }}
          hint="Ce qui a été accompli, les prochaines étapes conseillées."
        >
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
        </Field>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            loading={complete.isPending}
            onClick={() =>
              complete.mutate(note.trim() || undefined, {
                onSuccess: (closed) => {
                  toast.success('Mentorat clôturé', {
                    description: closed.certificate
                      ? `Certificat d’accompagnement délivré : ${closed.certificate.code}.`
                      : 'Merci pour cet accompagnement.',
                  });
                  onOpenChange(false);
                },
                onError: (e) => toast.error(errorMessage(e)),
              })
            }
          >
            <Flag aria-hidden />
            Clôturer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Workspace() {
  const { id } = useParams<{ id: string }>();
  const { data: me } = useMe();
  const q = useMentorship(id);
  const [closing, setClosing] = useState(false);

  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (q.isPending || !me)
    return (
      <div className="grid gap-6">
        <Skeleton className="h-36" />
        <Skeleton className="h-96" />
      </div>
    );

  const m = q.data;
  const other = m.counterpart;
  const subtitle =
    m.myRole === 'MENTEE'
      ? other.mentorProfile?.headline
      : other.menteeProfile
        ? `${situationLabels[other.menteeProfile.situation]} · ${other.menteeProfile.goalsSummary}`
        : undefined;

  return (
    <div className="animate-fade-in">
      <Link
        href="/mentorats"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {m.myRole === 'MENTOR' ? 'Mes mentorés' : 'Mes mentorats'}
      </Link>

      <Card className="mb-6 p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <Avatar person={other} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-display font-semibold tracking-[-0.03em] text-ink-900 sm:text-3xl">
                  {fullName(other)}
                </h1>
                <StatusBadge kind="mentorship" status={m.status} />
              </div>
              {subtitle && (
                <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{subtitle}</p>
              )}
              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge tone="ink">
                  {m.myRole === 'MENTOR' ? 'Vous êtes son mentor' : 'Votre mentor'}
                </Badge>
                {m.domain && <Badge tone="teal">{m.domain.name}</Badge>}
                <span>Depuis le {formatDate(m.startedAt)}</span>
              </div>
            </div>
          </div>
          <dl className="grid shrink-0 grid-cols-2 gap-4 border-t border-border pt-4 lg:w-[380px] lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
            <div className="col-span-2">
              <dt className="text-xs font-medium text-muted-foreground">Objectif initial</dt>
              <dd className="mt-0.5 line-clamp-2 text-sm font-semibold">{m.initialGoal}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Prochaine séance</dt>
              <dd className="mt-0.5 text-sm font-semibold">
                {m.nextSession
                  ? formatRange(m.nextSession.startsAt, m.nextSession.endsAt, me.timezone)
                  : 'Aucune'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                Objectifs {m.goalsCount > 0 && `(${m.goalsCompleted}/${m.goalsCount})`}
              </dt>
              <dd className="mt-1.5">
                {m.averageProgress !== null ? (
                  <div className="flex items-center gap-2">
                    <Progress
                      value={m.averageProgress}
                      className="flex-1"
                      label="Progression moyenne"
                    />
                    <span className="text-xs font-semibold tabular-nums">
                      {Math.round(m.averageProgress)} %
                    </span>
                  </div>
                ) : (
                  <span className="text-sm font-semibold">—</span>
                )}
              </dd>
            </div>
          </dl>
        </div>
      </Card>

      {m.status !== 'ACTIVE' ? (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg bg-ink-900 px-5 py-4 text-white">
          <Flag className="mt-0.5 size-5 shrink-0 text-amber-400" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              Mentorat {m.status === 'COMPLETED' ? 'clôturé' : 'interrompu'}
              {m.endedAt && <> le {formatDate(m.endedAt)}</>} : il reste consultable
              {m.status === 'COMPLETED'
                ? ', et vous pouvez toujours échanger par message.'
                : ' en lecture seule.'}
            </p>
            {m.endNote && <p className="mt-1 text-[15px] text-ink-100">Bilan : « {m.endNote} »</p>}
          </div>
          {m.certificate && (
            <Link
              href={`/certificats/${m.certificate.code}`}
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-amber-400 px-4 text-[14px] font-semibold text-ink-950 transition-colors hover:bg-amber-500"
            >
              <Award className="size-4" aria-hidden />
              Certificat d’accompagnement
            </Link>
          )}
        </div>
      ) : (
        <div className="mb-4 flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => setClosing(true)}>
            <Flag aria-hidden />
            Clôturer le mentorat
          </Button>
        </div>
      )}
      <CompleteDialog mentorship={m} open={closing} onOpenChange={setClosing} />

      <Tabs defaultValue="conversation">
        <TabsList>
          <TabsTrigger value="conversation">
            <MessagesSquare aria-hidden />
            Conversation
            {m.unreadCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-teal-700 px-1.5 text-[11px] text-white">
                {m.unreadCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="goals">
            <Target aria-hidden />
            Objectifs
          </TabsTrigger>
          <TabsTrigger value="sessions">
            <CalendarDays aria-hidden />
            Séances
          </TabsTrigger>
          <TabsTrigger value="resources">
            <BookOpen aria-hidden />
            Ressources
          </TabsTrigger>
        </TabsList>
        <TabsContent value="conversation">
          <Conversation mentorship={m} me={me} />
        </TabsContent>
        <TabsContent value="goals">
          <GoalsPanel mentorship={m} me={me} />
        </TabsContent>
        <TabsContent value="sessions">
          <SessionsPanel mentorship={m} me={me} />
        </TabsContent>
        <TabsContent value="resources">
          <MentorshipResources mentorship={m} me={me} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
