'use client';

import { useState } from 'react';
import { useDataSaver } from '@/lib/data-saver';
import { initials } from '@/lib/format';
import { cn } from '@/lib/utils';

const sizes = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-lg',
  xl: 'size-20 text-2xl',
} as const;

const tones = [
  'bg-teal-50 text-teal-800 ring-teal-100',
  'bg-ink-50 text-ink-900 ring-ink-100',
  'bg-amber-50 text-[#7a4a0f] ring-amber-100',
] as const;

function toneFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return tones[h % tones.length];
}

export interface AvatarPerson {
  id?: string;
  firstName: string;
  lastName: string;
  avatarUpdatedAt?: string | null;
}

/** URL de la photo, versionnée par sa date : le navigateur peut la garder en cache sans risque. */
export function avatarSrc(person: AvatarPerson): string | null {
  if (!person.id || !person.avatarUpdatedAt) return null;
  return `/api/v1/users/${person.id}/avatar?v=${new Date(person.avatarUpdatedAt).getTime()}`;
}

/** Photo de profil de la personne, ou ses initiales si elle n'en a pas (jamais de photo inventée). */
export function Avatar({
  person,
  size = 'md',
  className,
}: {
  person: AvatarPerson;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const src = avatarSrc(person);
  const [failed, setFailed] = useState<string | null>(null);
  const saver = useDataSaver();
  const showPhoto = src !== null && failed !== src && !saver;

  return (
    <span
      aria-hidden
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[30%] font-display font-semibold tracking-tight select-none',
        sizes[size],
        showPhoto
          ? 'bg-surface-muted'
          : ['ring-1 ring-inset', toneFor(person.id ?? `${person.firstName}${person.lastName}`)],
        className,
      )}
    >
      {showPhoto ? (
        // Image servie par l'API (même origine, mise en cache longue) : pas d'optimisation next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(src)}
          className="size-full object-cover"
        />
      ) : (
        initials(person)
      )}
    </span>
  );
}
