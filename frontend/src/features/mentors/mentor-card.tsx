import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  CalendarClock,
  Globe2,
  Languages,
  MapPin,
  MonitorSmartphone,
  Star,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/tooltip';
import { formatShortDate, formatTime, fullName, initials } from '@/lib/format';
import { modalityLabels } from '@/lib/labels';
import type { MentorCard as MentorCardData, Modality } from '@/lib/types';
import { cn } from '@/lib/utils';

export const modalityIcon: Record<Modality, typeof MapPin> = {
  REMOTE: MonitorSmartphone,
  IN_PERSON: MapPin,
  HYBRID: Globe2,
};

/** Couleur d'identité stable par personne (pâle, jamais une donnée). */
const IDENTITIES = [
  { band: 'bg-ink-900', avatar: 'bg-teal-100 text-teal-800' },
  { band: 'bg-teal-700', avatar: 'bg-amber-100 text-[#7a4a0f]' },
  { band: 'bg-ink-700', avatar: 'bg-ink-100 text-ink-900' },
  { band: 'bg-teal-800', avatar: 'bg-teal-50 text-teal-800' },
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

export function MentorCard({ mentor, footer }: { mentor: MentorCardData; footer?: ReactNode }) {
  const full = !mentor.acceptingMentees;
  const id = identityFor(mentor.id);
  const places = mentor.maxMentees - mentor.activeMentees;

  return (
    <article className="group relative flex h-full flex-col overflow-hidden bg-surface ring-1 ring-border transition-[transform,box-shadow] duration-300 ease-out focus-within:ring-2 focus-within:ring-teal-600 hover:-translate-y-1 hover:shadow-raised">
      {/* Bandeau d'identité */}
      <div className={cn('relative h-20', id.band)}>
        {mentor.verificationStatus === 'VERIFIED' && (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 bg-white/15 px-2 py-1 text-[12px] font-semibold text-white">
            <BadgeCheck className="size-3.5 text-amber-400" aria-hidden />
            Profil vérifié
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-6 pb-6">
        <span
          aria-hidden
          className={cn(
            'relative z-[1] -mt-9 inline-flex size-[72px] items-center justify-center rounded-full font-display text-[22px] font-semibold ring-4 ring-surface',
            id.avatar,
          )}
        >
          {initials(mentor)}
        </span>

        <h3 className="mt-4 font-display text-[20px] leading-tight font-semibold tracking-[-0.02em] text-ink-900">
          <Link
            href={`/mentors/${mentor.id}`}
            className="after:absolute after:inset-0 focus-visible:outline-none"
          >
            {fullName(mentor)}
          </Link>
        </h3>
        <p className="mt-1.5 line-clamp-2 text-[15px] leading-snug text-foreground">{mentor.headline}</p>
        {mentor.rating && mentor.rating.count > 0 && mentor.rating.average !== null && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-[14px] font-semibold text-ink-900">
            <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden />
            {mentor.rating.average.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}
            <span className="font-normal text-muted-foreground">
              ({mentor.rating.count} avis de séance{mentor.rating.count > 1 ? 's' : ''})
            </span>
          </p>
        )}

        <ul className="mt-4 grid gap-1.5 text-[14px] text-muted-foreground">
          <li className="flex items-center gap-2">
            <Briefcase className="size-4 shrink-0" aria-hidden />
            {mentor.yearsExperience} ans d’expérience
            {mentor.city && <span className="truncate">· {mentor.city}</span>}
          </li>
          <li className="flex items-center gap-2">
            <Languages className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{mentor.languages.join(', ')}</span>
          </li>
          <li className="flex items-center gap-2">
            {(() => {
              const Icon = modalityIcon[mentor.modalities[0] ?? 'REMOTE'];
              return <Icon className="size-4 shrink-0" aria-hidden />;
            })()}
            <span className="truncate">{mentor.modalities.map((m) => modalityLabels[m]).join(' · ')}</span>
          </li>
        </ul>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {mentor.domains.slice(0, 2).map((d) => (
            <Badge key={d.id} tone="teal" className="max-w-full truncate">
              {d.name}
            </Badge>
          ))}
          {mentor.domains.length > 2 && <Badge tone="neutral">+{mentor.domains.length - 2}</Badge>}
        </div>

        <div className="mt-auto pt-6">
          <div className="flex items-center justify-between gap-3 bg-background px-3 py-2.5">
            <span className="inline-flex min-w-0 items-center gap-2.5">
              <CalendarClock className="size-5 shrink-0 text-teal-700" aria-hidden />
              <span className="grid min-w-0 leading-tight">
                <span className="text-[12px] text-muted-foreground">Prochain créneau</span>
                <Availability iso={mentor.nextAvailableAt} className="truncate text-[14px]" />
              </span>
            </span>
            <span className={cn('shrink-0 text-[13px] font-semibold tabular-nums', full ? 'text-warning-700' : 'text-muted-foreground')}>
              {full ? 'Complet' : `${places} place${places > 1 ? 's' : ''}`}
            </span>
          </div>
          <span className="mt-4 inline-flex items-center gap-2 text-[15px] font-semibold text-teal-700">
            Voir le profil
            <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
          </span>
        </div>
      </div>
      {footer && <div className="relative z-10 border-t border-border px-6 py-4">{footer}</div>}
    </article>
  );
}

export function MentorCardSkeleton() {
  return (
    <div className="overflow-hidden bg-surface ring-1 ring-border">
      <div className="h-20 animate-pulse bg-ink-100/70" />
      <div className="px-6 pb-6">
        <div className="-mt-9 size-[72px] animate-pulse rounded-full bg-ink-100 ring-4 ring-surface" />
        <div className="mt-4 h-5 w-1/2 animate-pulse bg-ink-100/70" />
        <div className="mt-2 h-4 w-5/6 animate-pulse bg-ink-100/70" />
        <div className="mt-5 space-y-2">
          <div className="h-3 animate-pulse bg-ink-100/70" />
          <div className="h-3 w-2/3 animate-pulse bg-ink-100/70" />
        </div>
        <div className="mt-8 h-10 animate-pulse bg-ink-100/50" />
      </div>
    </div>
  );
}
