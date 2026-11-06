'use client';

import { ArrowRight, BookOpen, Briefcase, CalendarDays, Settings } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/misc';
import { useMe } from '@/features/auth/api';
import { useMentors, useProfile, useSuggestions } from '@/features/catalog/api';
import { useDashboard } from '@/features/mentorships/api';
import { EditableAvatar } from '@/features/account/avatar-editor';
import { useOpportunities } from '@/features/opportunities/api';
import { formatDate, fullName } from '@/lib/format';
import { opportunityTypeLabels, roleLabels, situationLabels } from '@/lib/labels';
import type { MentorCard } from '@/lib/types';
import { cn, isStaff } from '@/lib/utils';

const panel = 'overflow-hidden rounded-lg bg-surface shadow-card ring-1 ring-border/70';

function ProfileCard() {
  const { data: me } = useMe();
  const profile = useProfile(!!me);
  const dash = useDashboard(!!me && !isStaff(me.role));
  if (!me) return null;

  const subtitle =
    profile.data?.mentorProfile?.headline ??
    (profile.data?.menteeProfile
      ? situationLabels[profile.data.menteeProfile.situation]
      : roleLabels[me.role]);
  const city = profile.data?.mentorProfile?.city ?? profile.data?.menteeProfile?.city ?? null;
  const profileHref = me.role === 'MENTOR' ? `/mentors/${me.id}` : '/onboarding';
  const stats =
    me.role === 'MENTOR'
      ? [
          { label: 'Demandes à traiter', value: dash.data?.pendingRequests, href: '/demandes' },
          {
            label: 'Mentorés accompagnés',
            value: dash.data?.activeMentorships,
            href: '/mentorats',
          },
          {
            label: 'Créneaux libres',
            value: dash.data?.mentor?.freeUpcomingSlots,
            href: '/disponibilites',
          },
        ]
      : [
          { label: 'Mentorats en cours', value: dash.data?.activeMentorships, href: '/mentorats' },
          { label: 'Demandes en attente', value: dash.data?.pendingRequests, href: '/demandes' },
          { label: 'Messages non lus', value: dash.data?.unreadMessages, href: '/mentorats' },
        ];

  return (
    <div className="grid gap-2">
      <section className={panel} aria-label="Mon profil">
        <div className="relative isolate h-[58px] overflow-hidden bg-ink-900">
          <div className="pattern-kente absolute inset-0 -z-10 opacity-[0.16]" aria-hidden />
          <div
            className="absolute -top-8 right-0 -z-10 size-28 rounded-full bg-amber-400/35 blur-2xl"
            aria-hidden
          />
        </div>
        <div className="px-4 pb-4">
          <EditableAvatar className="relative z-[1] -mt-9" />
          <Link
            href={profileHref}
            className="mt-3 block font-display text-[18px] leading-tight font-semibold text-ink-900 hover:underline"
          >
            {fullName(me)}
          </Link>
          <p className="mt-1 text-[13px] leading-snug text-foreground">{subtitle}</p>
          {city && <p className="mt-1 text-[12px] text-muted-foreground">{city}, Guinée</p>}
        </div>
        <ul className="border-t border-border/70 py-2">
          {stats.map((st) => (
            <li key={st.label}>
              <Link
                href={st.href}
                className="flex items-center justify-between gap-2 px-4 py-1.5 text-[12px] transition-colors hover:bg-background"
              >
                <span className="font-semibold text-muted-foreground">{st.label}</span>
                <span className="font-semibold text-teal-700 tabular-nums">{st.value ?? '—'}</span>
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href="/compte"
          className="flex items-center gap-2 border-t border-border/70 px-4 py-3 text-[12px] font-semibold text-ink-900 transition-colors hover:bg-background"
        >
          <Settings className="size-4 text-muted-foreground" aria-hidden />
          Mon compte
        </Link>
      </section>

      <nav className={cn(panel, 'py-2')} aria-label="Raccourcis">
        {[
          { href: '/ressources', label: 'Ressources et conseils', icon: BookOpen },
          { href: '/opportunites', label: 'Opportunités', icon: Briefcase },
          { href: '/seances', label: 'Mes séances', icon: CalendarDays },
        ].map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2.5 px-4 py-2 text-[12px] font-semibold text-ink-900 transition-colors hover:bg-background"
          >
            <Icon className="size-4 text-muted-foreground" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function MentorRow({ m, reason }: { m: MentorCard; reason?: string }) {
  return (
    <li className="flex gap-3 px-4 py-3">
      <Avatar person={m} size="md" />
      <div className="min-w-0 flex-1">
        <Link
          href={`/mentors/${m.id}`}
          className="block truncate text-[14px] font-semibold text-ink-900 hover:underline"
        >
          {fullName(m)}
        </Link>
        <p className="line-clamp-2 text-[13px] leading-snug text-muted-foreground">
          {reason ?? m.headline}
        </p>
        <Link
          href={`/mentors/${m.id}`}
          className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-md bg-teal-50 px-3 text-[13px] font-semibold text-teal-800 transition-colors hover:bg-teal-100"
        >
          Voir le profil
        </Link>
      </div>
    </li>
  );
}

function Discover() {
  const { data: me } = useMe();
  const isMentee = me?.role === 'MENTEE';
  const suggestions = useSuggestions(isMentee);
  const mentors = useMentors({});
  const opportunities = useOpportunities({});

  const people: { m: MentorCard; reason?: string }[] =
    isMentee &&
    suggestions.data &&
    !suggestions.data.profileRequired &&
    suggestions.data.items.length
      ? suggestions.data.items.slice(0, 3).map((s) => ({ m: s.mentor, reason: s.reasons[0] }))
      : (mentors.data?.items ?? [])
          .filter((m) => m.id !== me?.id)
          .slice(0, 3)
          .map((m) => ({ m }));

  return (
    <div className="grid gap-2">
      <section className={panel} aria-labelledby="decouvrir-titre">
        <h2
          id="decouvrir-titre"
          className="px-4 pt-4 font-display text-[16px] font-semibold text-ink-900"
        >
          {isMentee ? 'Mentors pour vous' : 'Mentors du réseau'}
        </h2>
        {mentors.isPending && !people.length ? (
          <div className="grid gap-3 p-4">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : (
          <ul>
            {people.map(({ m, reason }) => (
              <MentorRow key={m.id} m={m} reason={reason} />
            ))}
          </ul>
        )}
        <Link
          href="/mentors"
          className="flex items-center justify-center gap-1.5 border-t border-border py-3 text-[14px] font-semibold text-muted-foreground transition-colors hover:bg-background hover:text-ink-900"
        >
          Voir tous les mentors <ArrowRight className="size-4" aria-hidden />
        </Link>
      </section>

      <section className={panel} aria-labelledby="opportunites-titre">
        <h2
          id="opportunites-titre"
          className="px-4 pt-4 font-display text-[16px] font-semibold text-ink-900"
        >
          Opportunités récentes
        </h2>
        <ul className="py-2">
          {(opportunities.data?.items ?? []).slice(0, 3).map((o) => (
            <li key={o.id}>
              <Link
                href="/opportunites"
                className="block px-4 py-2 transition-colors hover:bg-background"
              >
                <p className="line-clamp-2 text-[14px] leading-snug font-semibold text-ink-900">
                  {o.title}
                </p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {opportunityTypeLabels[o.type]} · {o.organization}
                  {o.deadline && <> · avant le {formatDate(o.deadline)}</>}
                </p>
              </Link>
            </li>
          ))}
          {opportunities.data && opportunities.data.items.length === 0 && (
            <li className="px-4 py-2 text-[13px] text-muted-foreground">
              Aucune opportunité ouverte.
            </li>
          )}
        </ul>
      </section>

      <p className="px-2 text-center text-[12px] leading-relaxed text-muted-foreground">
        TalentsConnect · Hackathon « Talents connectés », Conakry 2026 · Données de démonstration
      </p>
    </div>
  );
}

/** Accueil en trois colonnes, au format réseau professionnel : profil, fil d'activité, suggestions. */
export function HomeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-[1128px] items-start gap-6 md:grid-cols-[225px_minmax(0,1fr)] lg:grid-cols-[225px_minmax(0,1fr)_300px]">
      <aside className="hidden md:sticky md:top-[88px] md:block">
        <ProfileCard />
      </aside>
      <div className="min-w-0">{children}</div>
      <aside className="hidden lg:sticky lg:top-[88px] lg:block">
        <Discover />
      </aside>
    </div>
  );
}
