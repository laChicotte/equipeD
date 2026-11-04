'use client';

import {
  ArrowLeft,
  Briefcase,
  CalendarCheck2,
  CalendarClock,
  Clock,
  Hourglass,
  Info,
  Languages,
  Lock,
  MapPin,
  MessagesSquare,
  Send,
  ShieldCheck,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { ErrorState } from '@/components/feedback/states';
import { StatusBadge } from '@/components/feedback/status-badge';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/misc';
import { useMe } from '@/features/auth/api';
import { useMentor, useMentorAvailability } from '@/features/catalog/api';
import { BookDialog, groupByDay } from '@/features/scheduling/book-dialog';
import { isApiError } from '@/lib/api';
import { formatDate, formatShortDate, formatTime, fullName } from '@/lib/format';
import { CAMPUS_FRANCE_NOTICE, isCampusFrance, modalityLabels } from '@/lib/labels';
import type { MentorDetail } from '@/lib/types';
import { modalityIcon } from './mentor-card';
import { RequestDialog } from './request-dialog';

function ActionPanel({ mentor }: { mentor: MentorDetail }) {
  const { data: me } = useMe();
  const [requestOpen, setRequestOpen] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const relation = mentor.relation;

  if (!me) {
    return (
      <Button asChild size="lg" className="w-full">
        <Link href={`/connexion?next=/mentors/${mentor.id}`}>Se connecter pour demander</Link>
      </Button>
    );
  }
  if (me.role !== 'MENTEE' || me.id === mentor.id) {
    return (
      <p className="flex gap-2 rounded-md bg-surface-muted p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        {me.id === mentor.id
          ? 'C’est votre fiche publique, telle que la voient les mentorés.'
          : 'Les demandes d’accompagnement sont réservées aux comptes mentorés.'}
      </p>
    );
  }
  if (relation?.mentorshipId) {
    return (
      <div className="grid gap-2">
        <Button asChild size="lg" className="w-full">
          <Link href={`/mentorats/${relation.mentorshipId}`}>
            <MessagesSquare aria-hidden />
            Ouvrir l’espace de mentorat
          </Link>
        </Button>
        <Button variant="secondary" size="lg" className="w-full" onClick={() => setBookOpen(true)}>
          <CalendarCheck2 aria-hidden />
          Réserver une séance
        </Button>
        <BookDialog
          mentorId={mentor.id}
          mentorFirstName={mentor.firstName}
          open={bookOpen}
          onOpenChange={setBookOpen}
          timezone={me.timezone}
        />
      </div>
    );
  }
  if (relation?.pendingRequestId) {
    return (
      <div className="grid gap-2">
        <Button size="lg" className="w-full" disabled>
          <Hourglass aria-hidden />
          Demande en attente
        </Button>
        <Button asChild variant="link" className="justify-center">
          <Link href="/demandes">Suivre ma demande</Link>
        </Button>
      </div>
    );
  }
  if (!mentor.acceptingMentees) {
    return (
      <Button size="lg" className="w-full" disabled>
        <Users aria-hidden />
        Ce mentor est complet
      </Button>
    );
  }
  return (
    <div className="grid gap-2">
      <Button size="lg" className="w-full" onClick={() => setRequestOpen(true)}>
        <Send aria-hidden />
        Demander un accompagnement
      </Button>
      {relation?.lastDeclinedAt && (
        <p className="text-center text-xs text-muted-foreground">
          Une précédente demande a été déclinée le {formatDate(relation.lastDeclinedAt)}.
        </p>
      )}
      <RequestDialog mentor={mentor} open={requestOpen} onOpenChange={setRequestOpen} />
    </div>
  );
}

function SlotsPreview({ mentorId }: { mentorId: string }) {
  const { data, isPending } = useMentorAvailability(mentorId);
  if (isPending) return <Skeleton className="h-24" />;
  if (!data?.length) {
    return <p className="text-sm text-muted-foreground">Aucun créneau publié pour le moment.</p>;
  }
  const days = groupByDay(data).slice(0, 3);
  return (
    <ul className="grid gap-3">
      {days.map(([day, slots]) => (
        <li key={day}>
          <p className="text-xs font-semibold text-muted-foreground capitalize">{formatShortDate(slots[0].startsAt)}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {slots.slice(0, 4).map((s) => (
              <span
                key={s.id}
                className="inline-flex h-8 items-center rounded-sm border border-teal-100 bg-teal-50 px-2.5 text-xs font-semibold text-teal-800 tabular-nums"
              >
                {formatTime(s.startsAt)}
              </span>
            ))}
            {slots.length > 4 && (
              <span className="inline-flex h-8 items-center px-1 text-xs text-muted-foreground">+{slots.length - 4}</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function MentorProfile() {
  const { id } = useParams<{ id: string }>();
  const { data: mentor, isPending, isError, error, refetch } = useMentor(id);

  if (isError) {
    if (isApiError(error) && error.statusCode === 404) {
      return (
        <div className="py-16 text-center">
          <h1 className="text-xl font-semibold">Ce profil n’est pas disponible</h1>
          <p className="mt-2 text-sm text-muted-foreground">Il a peut-être été retiré de l’annuaire.</p>
          <Button asChild variant="secondary" className="mt-6">
            <Link href="/mentors">Retour à l’annuaire</Link>
          </Button>
        </div>
      );
    }
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  }

  if (isPending) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Skeleton className="h-96" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  const campus = mentor.domains.some((d) => isCampusFrance(d.slug));

  return (
    <div className="animate-fade-in">
      <Link
        href="/mentors"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Annuaire des mentors
      </Link>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-6">
          <Card className="overflow-hidden">
            <div className="px-5 pt-6 pb-6 sm:px-8 sm:pt-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <Avatar person={mentor} size="xl" />
                <div className="flex flex-wrap gap-2">
                  {mentor.verificationStatus === 'VERIFIED' && (
                    <StatusBadge kind="verification" status="VERIFIED" />
                  )}
                  {!mentor.acceptingMentees && <Badge tone="warning">Complet</Badge>}
                </div>
              </div>
              <h1 className="mt-5 text-3xl font-display font-semibold tracking-[-0.03em] text-ink-900 sm:text-[44px] sm:leading-none">{fullName(mentor)}</h1>
              <p className="mt-3 max-w-[60ch] text-[17px] leading-relaxed text-foreground">{mentor.headline}</p>
              {mentor.rating && mentor.rating.count > 0 && mentor.rating.average !== null && (
                <p className="mt-3 inline-flex items-center gap-1.5 text-[15px] font-semibold text-ink-900">
                  <span className="inline-flex" aria-hidden>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <svg key={n} viewBox="0 0 24 24" className={n <= Math.round(mentor.rating!.average!) ? 'size-4 fill-amber-400' : 'size-4 fill-ink-100'}>
                        <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />
                      </svg>
                    ))}
                  </span>
                  {mentor.rating.average.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} / 5
                  <span className="font-normal text-muted-foreground">
                    · {mentor.rating.count} avis de mentoré{mentor.rating.count > 1 ? 's' : ''} après séance
                  </span>
                </p>
              )}
              <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-foreground/85">
                {(mentor.currentPosition || mentor.organization) && (
                  <li className="inline-flex items-center gap-1.5">
                    <Briefcase className="size-4 text-muted-foreground" aria-hidden />
                    {[mentor.currentPosition, mentor.organization].filter(Boolean).join(' · ')}
                  </li>
                )}
                {mentor.city && (
                  <li className="inline-flex items-center gap-1.5">
                    <MapPin className="size-4 text-muted-foreground" aria-hidden />
                    {mentor.city}
                  </li>
                )}
                <li className="inline-flex items-center gap-1.5">
                  <Languages className="size-4 text-muted-foreground" aria-hidden />
                  {mentor.languages.join(', ')}
                </li>
              </ul>
            </div>
            <dl className="grid grid-cols-2 border-t border-border sm:grid-cols-4">
              {[
                { k: 'Expérience', v: `${mentor.yearsExperience} ans` },
                { k: 'Séance', v: `${mentor.sessionDurationMin} min` },
                { k: 'Accompagnés', v: `${mentor.activeMentees}/${mentor.maxMentees}` },
                {
                  k: 'Modalités',
                  v: mentor.modalities.length === 1 ? modalityLabels[mentor.modalities[0]] : `${mentor.modalities.length} options`,
                },
              ].map((s, i) => (
                <div
                  key={s.k}
                  className={`px-5 py-4 sm:px-6 ${i % 2 === 1 ? 'border-l' : ''} ${i >= 2 ? 'border-t sm:border-t-0' : ''} ${i === 2 ? 'sm:border-l' : ''} border-border`}
                >
                  <dt className="text-xs font-medium text-muted-foreground">{s.k}</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums">{s.v}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card className="p-5 sm:p-8">
            <h2 className="text-lg font-semibold tracking-tight">À propos</h2>
            <p className="mt-3 max-w-[70ch] text-[15px] leading-relaxed whitespace-pre-line text-foreground/90">
              {mentor.bio}
            </p>

            <h2 className="mt-8 text-lg font-semibold tracking-tight">Compétences</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {mentor.expertise.map((e) => (
                <li key={e}>
                  <Badge tone="ink" className="h-8 px-3 text-[13px]">
                    {e}
                  </Badge>
                </li>
              ))}
            </ul>

            <h2 className="mt-8 text-lg font-semibold tracking-tight">Domaines d’accompagnement</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {mentor.domains.map((d) => (
                <li key={d.id}>
                  <Link href={`/mentors?domain=${d.slug}`}>
                    <Badge tone="teal" className="h-8 px-3 text-[13px] hover:border-teal-200">
                      {d.name}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
            {campus && (
              <p className="mt-4 flex items-start gap-2 rounded-md border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-[#7a4a0f]">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                Accompagnement Campus France : {CAMPUS_FRANCE_NOTICE.toLowerCase()}
              </p>
            )}

            <h2 className="mt-8 text-lg font-semibold tracking-tight">Modalités</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {mentor.modalities.map((m) => {
                const Icon = modalityIcon[m];
                return (
                  <li
                    key={m}
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium"
                  >
                    <Icon className="size-4 text-teal-700" aria-hidden />
                    {modalityLabels[m]}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <aside className="grid gap-4 lg:sticky lg:top-24">
          <Card className="p-5">
            <ActionPanel mentor={mentor} />
            <div className="mt-5 border-t border-border pt-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <CalendarClock className="size-4 text-teal-700" aria-hidden />
                Prochains créneaux libres
              </h2>
              <div className="mt-3">
                <SlotsPreview mentorId={mentor.id} />
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3.5" aria-hidden />
                Réservables une fois la demande acceptée.
              </p>
            </div>
          </Card>
          <Card className="p-5">
            <ul className="grid gap-3 text-sm">
              <li className="flex gap-2.5">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal-700" aria-hidden />
                <span className="text-muted-foreground">
                  {mentor.verificationStatus === 'VERIFIED'
                    ? 'Profil vérifié manuellement par l’équipe de la plateforme.'
                    : 'Vérification du profil par l’équipe en cours ou à venir.'}
                </span>
              </li>
              <li className="flex gap-2.5">
                <Lock className="mt-0.5 size-4 shrink-0 text-teal-700" aria-hidden />
                <span className="text-muted-foreground">
                  Coordonnées jamais affichées. Les échanges ont lieu dans la conversation privée.
                </span>
              </li>
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
