'use client';

import {
  ArrowLeft,
  Briefcase,
  CalendarCheck2,
  CalendarClock,
  Clock,
  Hourglass,
  Info,
  Lock,
  MessagesSquare,
  Send,
  ShieldCheck,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { ErrorState } from '@/components/feedback/states';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { useMe } from '@/features/auth/api';
import { useMentor, useMentorAvailability, useMentors } from '@/features/catalog/api';
import { BookDialog, groupByDay } from '@/features/scheduling/book-dialog';
import { isApiError } from '@/lib/api';
import { formatDate, formatShortDate, formatTime, fullName } from '@/lib/format';
import { MentorCertificatesSection } from '@/features/certificates/certificates';
import { CAMPUS_FRANCE_NOTICE, isCampusFrance, modalityLabels } from '@/lib/labels';
import type { MentorDetail } from '@/lib/types';
import { cn } from '@/lib/utils';
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
          <p className="text-xs font-semibold text-muted-foreground capitalize">
            {formatShortDate(slots[0].startsAt)}
          </p>
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
              <span className="inline-flex h-8 items-center px-1 text-xs text-muted-foreground">
                +{slots.length - 4}
              </span>
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
          <p className="mt-2 text-sm text-muted-foreground">
            Il a peut-être été retiré de l’annuaire.
          </p>
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
  const section = 'rounded-lg bg-surface p-5 shadow-card ring-1 ring-border/70 sm:p-6';
  const h2 = 'font-display text-[19px] font-semibold tracking-[-0.01em] text-ink-900';

  return (
    <div className="mx-auto max-w-[1128px] animate-fade-in">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid min-w-0 gap-2">
          {/* Carte d'en-tête : couverture, avatar, identité, actions */}
          <section className="overflow-hidden rounded-lg bg-surface shadow-card ring-1 ring-border/70">
            <div className="relative isolate h-32 overflow-hidden bg-ink-900 sm:h-48">
              <div className="pattern-kente absolute inset-0 -z-10 opacity-[0.12]" aria-hidden />
              <div
                className="absolute -top-16 right-10 -z-10 size-72 rounded-full bg-amber-400/25 blur-3xl"
                aria-hidden
              />
              <div
                className="absolute -bottom-24 left-1/3 -z-10 size-64 rounded-full bg-teal-500/25 blur-3xl"
                aria-hidden
              />
              <Link
                href="/mentors"
                className="absolute top-3 left-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-black/25 px-3 text-[13px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-black/40"
              >
                <ArrowLeft className="size-4" aria-hidden />
                Annuaire
              </Link>
            </div>
            <div className="px-5 pb-6 sm:px-6">
              <Avatar
                person={mentor}
                size="xl"
                className="relative z-[1] -mt-14 size-28 text-[36px] ring-4 ring-surface sm:-mt-20 sm:size-36 sm:text-[46px]"
              />
              <div className="mt-3 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0">
                  <h1 className="flex flex-wrap items-center gap-2 font-display text-[24px] leading-tight font-semibold tracking-[-0.02em] text-ink-900 sm:text-[28px]">
                    {fullName(mentor)}
                    {mentor.verificationStatus === 'VERIFIED' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[12px] font-semibold text-[#7a4a0f] ring-1 ring-amber-100">
                        <ShieldCheck className="size-3.5" aria-hidden />
                        Profil vérifié
                      </span>
                    )}
                  </h1>
                  <p className="mt-1 text-[16px] leading-snug text-foreground">{mentor.headline}</p>
                  <p className="mt-1.5 text-[14px] text-muted-foreground">
                    {[mentor.city && `${mentor.city}, Guinée`, mentor.languages.join(', ')]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <p className="mt-1.5 text-[14px] font-semibold text-teal-700">
                    {mentor.mentoredCount === 0
                      ? 'Nouveau mentor sur la plateforme'
                      : `${mentor.mentoredCount} mentoré${mentor.mentoredCount > 1 ? 's' : ''} accompagné${mentor.mentoredCount > 1 ? 's' : ''}`}
                    {mentor.activeMentees > 0 && (
                      <span className="text-muted-foreground">
                        {' '}
                        · {mentor.activeMentees} en cours
                      </span>
                    )}
                    {mentor.certificatesCount > 0 && (
                      <a href="#certificats" className="text-muted-foreground hover:underline">
                        {' '}
                        · {mentor.certificatesCount} certificat
                        {mentor.certificatesCount > 1 ? 's' : ''}
                      </a>
                    )}
                    {mentor.rating && mentor.rating.count > 0 && mentor.rating.average !== null && (
                      <span className="text-muted-foreground">
                        {' '}
                        · ★{' '}
                        {mentor.rating.average.toLocaleString('fr-FR', {
                          maximumFractionDigits: 1,
                        })}{' '}
                        ({mentor.rating.count} avis)
                      </span>
                    )}
                  </p>
                </div>
                {(mentor.currentPosition || mentor.organization) && (
                  <div className="flex items-start gap-2.5 sm:max-w-[230px]">
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-ink-50 text-ink-800">
                      <Briefcase className="size-4" aria-hidden />
                    </span>
                    <p className="text-[13px] leading-snug font-semibold text-ink-900">
                      {mentor.currentPosition}
                      {mentor.organization && (
                        <span className="block font-normal text-muted-foreground">
                          {mentor.organization}
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>
              <div className="mt-5 max-w-[360px]">
                <ActionPanel mentor={mentor} />
              </div>
            </div>
          </section>

          {/* Infos clés */}
          <section className={section} aria-labelledby="titre-infos">
            <h2 id="titre-infos" className={h2}>
              En bref
            </h2>
            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { k: 'Expérience', v: `${mentor.yearsExperience} ans`, icon: Briefcase },
                { k: 'Durée d’une séance', v: `${mentor.sessionDurationMin} min`, icon: Clock },
                { k: 'Mentorés accompagnés', v: String(mentor.mentoredCount), icon: Users },
                {
                  k: 'Modalités',
                  v: mentor.modalities.map((m) => modalityLabels[m]).join(', '),
                  icon: MessagesSquare,
                },
              ].map(({ k, v, icon: Icon }) => (
                <div key={k} className="flex gap-3">
                  <Icon className="mt-0.5 size-5 shrink-0 text-teal-700" aria-hidden />
                  <div className="min-w-0">
                    <dt className="text-[12px] text-muted-foreground">{k}</dt>
                    <dd className="text-[14px] font-semibold text-ink-900">{v}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </section>

          <section className={section} aria-labelledby="titre-apropos">
            <h2 id="titre-apropos" className={h2}>
              À propos
            </h2>
            <p className="mt-3 max-w-[72ch] text-[15px] leading-relaxed whitespace-pre-line text-foreground">
              {mentor.bio}
            </p>
          </section>

          <section className={section} aria-labelledby="titre-competences">
            <h2 id="titre-competences" className={h2}>
              Compétences
            </h2>
            <ul className="mt-2 divide-y divide-border/70">
              {mentor.expertise.map((e) => (
                <li key={e} className="py-2.5 text-[15px] font-semibold text-ink-900">
                  {e}
                </li>
              ))}
            </ul>
          </section>

          <section className={section} aria-labelledby="titre-domaines">
            <h2 id="titre-domaines" className={h2}>
              Domaines d’accompagnement
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {mentor.domains.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/mentors?domain=${d.slug}`}
                    className="inline-flex h-9 items-center rounded-full px-4 text-[14px] font-semibold text-ink-900 ring-1 ring-border-strong ring-inset transition-colors hover:bg-background hover:ring-ink-900"
                  >
                    {d.name}
                  </Link>
                </li>
              ))}
            </ul>
            {campus && (
              <p className="mt-4 flex items-start gap-2 rounded-md bg-amber-50 px-4 py-3 text-sm text-[#7a4a0f] ring-1 ring-amber-100">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                Accompagnement Campus France : {CAMPUS_FRANCE_NOTICE.toLowerCase()}
              </p>
            )}
          </section>

          <MentorCertificatesSection mentorId={mentor.id} className={section} />

          <section className={section} aria-labelledby="titre-creneaux">
            <h2 id="titre-creneaux" className={cn(h2, 'flex items-center gap-2')}>
              <CalendarClock className="size-5 text-teal-700" aria-hidden />
              Prochains créneaux libres
            </h2>
            <div className="mt-4">
              <SlotsPreview mentorId={mentor.id} />
            </div>
            <p className="mt-3 text-[13px] text-muted-foreground">
              Réservables une fois la demande acceptée.
            </p>
          </section>
        </div>

        {/* Colonne de droite */}
        <aside className="grid gap-2 lg:sticky lg:top-[88px]">
          <section className={cn(section, 'p-5 sm:p-5')}>
            <h2 className="font-display text-[16px] font-semibold text-ink-900">
              Un cadre de confiance
            </h2>
            <ul className="mt-3 grid gap-3 text-[13px]">
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
          </section>
          <OtherMentors currentId={mentor.id} />
        </aside>
      </div>
    </div>
  );
}

function OtherMentors({ currentId }: { currentId: string }) {
  const { data } = useMentors({});
  const others = (data?.items ?? []).filter((m) => m.id !== currentId).slice(0, 4);
  if (!others.length) return null;
  return (
    <section
      className="overflow-hidden rounded-lg bg-surface shadow-card ring-1 ring-border/70"
      aria-labelledby="titre-autres"
    >
      <h2
        id="titre-autres"
        className="px-5 pt-5 font-display text-[16px] font-semibold text-ink-900"
      >
        Autres mentors
      </h2>
      <ul className="mt-2 divide-y divide-border/70">
        {others.map((m) => (
          <li key={m.id} className="flex gap-3 px-5 py-3">
            <Avatar person={m} size="md" className="size-12" />
            <div className="min-w-0 flex-1">
              <Link
                href={`/mentors/${m.id}`}
                className="block truncate text-[14px] font-semibold text-ink-900 hover:underline"
              >
                {fullName(m)}
              </Link>
              <p className="line-clamp-2 text-[12px] leading-snug text-muted-foreground">
                {m.headline}
              </p>
              <Link
                href={`/mentors/${m.id}`}
                className="mt-2 inline-flex h-8 items-center rounded-full px-3.5 text-[13px] font-semibold text-ink-900 ring-1 ring-ink-900 ring-inset transition-colors hover:bg-background"
              >
                Voir le profil
              </Link>
            </div>
          </li>
        ))}
      </ul>
      <Link
        href="/mentors"
        className="flex items-center justify-center border-t border-border/70 py-3 text-[14px] font-semibold text-muted-foreground transition-colors hover:bg-background hover:text-ink-900"
      >
        Voir tous les mentors
      </Link>
    </section>
  );
}
