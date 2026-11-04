import { ArrowUpRight, BadgeCheck, CalendarClock, Globe2, MapPin, MonitorSmartphone, Users } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/tooltip';
import { formatShortDate, formatTime, fullName } from '@/lib/format';
import { modalityLabels } from '@/lib/labels';
import type { MentorCard as MentorCardData, Modality } from '@/lib/types';
import { cn } from '@/lib/utils';

export const modalityIcon: Record<Modality, typeof MapPin> = {
  REMOTE: MonitorSmartphone,
  IN_PERSON: MapPin,
  HYBRID: Globe2,
};

export function VerifiedBadge({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <Tooltip content="Profil vérifié par l’équipe de la plateforme">
        <span className="inline-flex text-amber-500" aria-label="Profil vérifié" role="img">
          <BadgeCheck className="size-[18px] fill-amber-400 text-white" aria-hidden />
        </span>
      </Tooltip>
    );
  }
  return (
    <Badge tone="verified">
      <BadgeCheck aria-hidden />
      Profil vérifié
    </Badge>
  );
}

export function Availability({ iso, className }: { iso: string | null; className?: string }) {
  if (!iso) {
    return <span className={cn('text-muted-foreground', className)}>Aucun créneau publié</span>;
  }
  return (
    <span className={cn('font-medium text-teal-800', className)}>
      Disponible {formatShortDate(iso)} à {formatTime(iso)}
    </span>
  );
}

export function MentorCard({ mentor, footer }: { mentor: MentorCardData; footer?: ReactNode }) {
  const full = !mentor.acceptingMentees;
  return (
    <article className="group relative flex h-full flex-col rounded-lg border border-border bg-surface p-5 transition-[border-color,box-shadow,transform] duration-200 focus-within:border-accent hover:-translate-y-0.5 hover:border-teal-200 hover:border-ink-900">
      <div className="flex items-start gap-3.5">
        <Avatar person={mentor} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate font-semibold tracking-tight">
              <Link
                href={`/mentors/${mentor.id}`}
                className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none"
              >
                {fullName(mentor)}
              </Link>
            </h3>
            {mentor.verificationStatus === 'VERIFIED' && <VerifiedBadge compact />}
          </div>
          <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-muted-foreground">{mentor.headline}</p>
        </div>
        <ArrowUpRight
          className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {mentor.domains.slice(0, 3).map((d) => (
          <Badge key={d.id} tone="teal">
            {d.name}
          </Badge>
        ))}
      </div>

      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-foreground/85">{mentor.bio}</p>

      <dl className="mt-4 grid gap-2 text-[13px] text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <dt className="sr-only">Modalités</dt>
          {mentor.modalities.map((m) => {
            const Icon = modalityIcon[m];
            return (
              <dd key={m} className="inline-flex items-center gap-1.5">
                <Icon className="size-3.5" aria-hidden />
                {modalityLabels[m]}
              </dd>
            );
          })}
          {mentor.city && (
            <>
              <dt className="sr-only">Ville</dt>
              <dd className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" aria-hidden />
                {mentor.city}
              </dd>
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Expérience</dt>
          <dd>
            {mentor.yearsExperience} ans d’expérience · {mentor.languages.join(', ')}
          </dd>
        </div>
      </dl>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4 text-[13px]">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <CalendarClock className="size-3.5 shrink-0 text-teal-700" aria-hidden />
          <Availability iso={mentor.nextAvailableAt} className="truncate" />
        </span>
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1 font-medium tabular-nums',
            full ? 'text-warning-700' : 'text-muted-foreground',
          )}
        >
          <Users className="size-3.5" aria-hidden />
          {full ? 'Complet' : `${mentor.activeMentees}/${mentor.maxMentees}`}
          <span className="sr-only"> mentorés accompagnés</span>
        </span>
      </div>
      {footer && <div className="relative z-10 mt-4">{footer}</div>}
    </article>
  );
}

export function MentorCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex gap-3.5">
        <div className="size-14 animate-pulse rounded-full bg-ink-100/70" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/2 animate-pulse rounded bg-ink-100/70" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-ink-100/70" />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <div className="h-5 w-24 animate-pulse rounded bg-ink-100/70" />
        <div className="h-5 w-20 animate-pulse rounded bg-ink-100/70" />
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-3 animate-pulse rounded bg-ink-100/70" />
        <div className="h-3 animate-pulse rounded bg-ink-100/70" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-ink-100/70" />
      </div>
      <div className="mt-6 h-4 w-1/2 animate-pulse rounded bg-ink-100/70" />
    </div>
  );
}
