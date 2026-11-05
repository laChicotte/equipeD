import {
  ArrowUpRight,
  Award,
  BadgeCheck,
  CalendarClock,
  Globe2,
  MapPin,
  MonitorSmartphone,
  Star,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/tooltip';
import { formatShortDate, formatTime, fullName } from '@/lib/format';
import type { MentorCard as MentorCardData, Modality } from '@/lib/types';
import { cn } from '@/lib/utils';

export const modalityIcon: Record<Modality, typeof MapPin> = {
  REMOTE: MonitorSmartphone,
  IN_PERSON: MapPin,
  HYBRID: Globe2,
};

/** Couleur d'identité stable par personne (pâle, jamais une donnée). */
const IDENTITIES = [
  { band: 'bg-ink-900', avatar: 'bg-ink-100 text-ink-900' },
  { band: 'bg-teal-700', avatar: 'bg-teal-100 text-teal-800' },
  { band: 'bg-ink-700', avatar: 'bg-amber-100 text-[#7a4a0f]' },
  { band: 'bg-teal-800', avatar: 'bg-[#e4ecdf] text-[#2f5130]' },
] as const;

export function identityFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return IDENTITIES[h % IDENTITIES.length];
}

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

/** « N mentorés accompagnés » : personnes distinctes, tous domaines confondus. */
export function MentoredLabel({
  mentor,
  className,
}: {
  mentor: MentorCardData;
  className?: string;
}) {
  const n = mentor.mentoredCount;
  return (
    <span className={className}>
      {n === 0 ? 'Nouveau mentor' : `${n} mentoré${n > 1 ? 's' : ''} accompagné${n > 1 ? 's' : ''}`}
    </span>
  );
}

export function CertificatesBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[12px] font-semibold text-[#7a4a0f] ring-1 ring-amber-100">
      <Award className="size-3.5" aria-hidden />
      {count} certificat{count > 1 ? 's' : ''}
    </span>
  );
}

export function Availability({ iso, className }: { iso: string | null; className?: string }) {
  if (!iso) {
    return <span className={cn('text-muted-foreground', className)}>Aucun créneau publié</span>;
  }
  return (
    <span className={cn('font-semibold text-teal-800', className)}>
      {formatShortDate(iso)}, {formatTime(iso)}
    </span>
  );
}

function Rating({ mentor }: { mentor: MentorCardData }) {
  if (!mentor.rating || mentor.rating.count === 0 || mentor.rating.average === null) return null;
  return (
    <span className="inline-flex items-center gap-1">
      <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
      <span className="font-semibold text-ink-900">
        {mentor.rating.average.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}
      </span>
      ({mentor.rating.count} avis)
    </span>
  );
}

/** Carte mentor « place de marché » : identité, compétences, disponibilité. */
export function MentorCard({ mentor, footer }: { mentor: MentorCardData; footer?: ReactNode }) {
  const id = identityFor(mentor.id);
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-lg bg-surface shadow-card ring-1 ring-border/70 transition-[transform,box-shadow] duration-300 ease-out focus-within:ring-2 focus-within:ring-teal-600 hover:-translate-y-1 hover:shadow-raised">
      <div className="flex gap-4 p-5 pb-4">
        <Avatar
          person={mentor}
          className={cn('size-16 text-[20px] ring-0', !mentor.avatarUpdatedAt && id.avatar)}
        />
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-1.5 font-display text-[18px] leading-tight font-semibold tracking-[-0.01em] text-ink-900">
            <Link
              href={`/mentors/${mentor.id}`}
              className="truncate after:absolute after:inset-0 focus-visible:outline-none"
            >
              {fullName(mentor)}
            </Link>
            {mentor.verificationStatus === 'VERIFIED' && <VerifiedBadge compact />}
          </h3>
          <p className="mt-1 line-clamp-2 text-[14px] leading-snug text-foreground">
            {mentor.headline}
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
            {mentor.city && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden />
                {mentor.city}
              </span>
            )}
            <span>{mentor.yearsExperience} ans d’expérience</span>
            <Rating mentor={mentor} />
          </p>
        </div>
      </div>

      <ul className="flex flex-wrap gap-1.5 px-5">
        {mentor.expertise.slice(0, 3).map((e) => (
          <li
            key={e}
            className="rounded-sm bg-surface-muted px-2 py-1 text-[12px] font-medium text-ink-800"
          >
            {e}
          </li>
        ))}
        {mentor.expertise.length > 3 && (
          <li className="px-1 py-1 text-[12px] font-medium text-muted-foreground">
            +{mentor.expertise.length - 3}
          </li>
        )}
      </ul>
      <p className="mt-3 truncate px-5 text-[13px] text-muted-foreground">
        {mentor.languages.join(' · ')} · {mentor.modalities.map((m) => modalityShort[m]).join(', ')}
      </p>

      <div className="mt-auto pt-4">
        <div className="flex items-center justify-between gap-3 border-t border-border/70 bg-background/60 px-5 py-3">
          <span className="inline-flex min-w-0 items-center gap-2 text-[13px]">
            <CalendarClock className="size-4 shrink-0 text-teal-700" aria-hidden />
            <Availability iso={mentor.nextAvailableAt} className="truncate" />
          </span>
          <span className="inline-flex shrink-0 items-center gap-3">
            <MentoredLabel
              mentor={mentor}
              className="text-[12px] font-semibold text-muted-foreground"
            />
            <ArrowUpRight
              className="size-[18px] text-teal-700 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              aria-hidden
            />
          </span>
        </div>
      </div>
      {footer && <div className="relative z-10 border-t border-border/70 px-5 py-4">{footer}</div>}
    </article>
  );
}

const modalityShort: Record<Modality, string> = {
  REMOTE: 'à distance',
  IN_PERSON: 'en présentiel',
  HYBRID: 'hybride',
};

export function MentorCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg bg-surface ring-1 ring-border/70">
      <div className="flex gap-4 p-5">
        <div className="size-16 shrink-0 animate-pulse rounded-[30%] bg-ink-100" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-4 w-1/2 animate-pulse rounded bg-ink-100/70" />
          <div className="h-3.5 w-5/6 animate-pulse rounded bg-ink-100/70" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-ink-100/60" />
        </div>
      </div>
      <div className="mx-5 h-6 w-2/3 animate-pulse rounded bg-ink-100/50" />
      <div className="mt-6 h-12 animate-pulse bg-ink-100/40" />
    </div>
  );
}

/** Ligne de résultat, au format annuaire professionnel. */
export function MentorResult({ mentor, aside }: { mentor: MentorCardData; aside?: ReactNode }) {
  const id = identityFor(mentor.id);
  return (
    <article className="relative flex gap-3 px-4 py-4 transition-colors hover:bg-background/70 sm:gap-4 sm:px-6">
      <Avatar
        person={mentor}
        className={cn(
          'size-14 text-[18px] ring-0 sm:size-16 sm:text-[20px]',
          !mentor.avatarUpdatedAt && id.avatar,
        )}
      />
      <div className="min-w-0 flex-1">
        <h3 className="flex items-center gap-1.5 text-[16px] leading-tight font-semibold text-ink-900">
          <Link
            href={`/mentors/${mentor.id}`}
            className="truncate after:absolute after:inset-0 hover:underline focus-visible:outline-none"
          >
            {fullName(mentor)}
          </Link>
          {mentor.verificationStatus === 'VERIFIED' && <VerifiedBadge compact />}
        </h3>
        <p className="mt-0.5 line-clamp-2 text-[14px] leading-snug text-foreground">
          {mentor.headline}
        </p>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {[mentor.city, `${mentor.yearsExperience} ans d’expérience`, mentor.languages.join(', ')]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="size-3.5 text-teal-700" aria-hidden />
            <Availability iso={mentor.nextAvailableAt} className="font-medium" />
          </span>
          <MentoredLabel mentor={mentor} />
          <CertificatesBadge count={mentor.certificatesCount} />
          <Rating mentor={mentor} />
        </p>
        <p className="mt-1 line-clamp-1 text-[12px] text-muted-foreground">
          <span className="font-semibold text-ink-800">Compétences :</span>{' '}
          {mentor.expertise.slice(0, 5).join(' · ')}
        </p>
        {aside && <div className="relative z-10 mt-2">{aside}</div>}
      </div>
      <span className="hidden h-8 shrink-0 items-center self-center rounded-full px-4 text-[14px] font-semibold text-ink-900 ring-1 ring-ink-900 ring-inset sm:inline-flex">
        Voir le profil
      </span>
    </article>
  );
}

export function MentorResultSkeleton() {
  return (
    <div className="flex gap-4 px-6 py-4">
      <div className="size-16 shrink-0 animate-pulse rounded-[30%] bg-ink-100" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-4 w-1/3 animate-pulse rounded bg-ink-100/70" />
        <div className="h-3.5 w-3/4 animate-pulse rounded bg-ink-100/70" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-ink-100/60" />
      </div>
    </div>
  );
}
