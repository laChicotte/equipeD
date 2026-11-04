import Image from 'next/image';
import type { ReactNode } from 'react';
import type { Photo } from '@/lib/photos';
import { cn } from '@/lib/utils';

/** Bandeau d'en-tête sombre des pages de découverte (annuaire, ressources, opportunités). */
export function PageBand({
  title,
  description,
  photo,
  photoPosition = 'object-[50%_35%]',
  actions,
  children,
  className,
}: {
  title: string;
  description: ReactNode;
  photo?: Photo;
  photoPosition?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('relative isolate mb-10 overflow-hidden bg-ink-950 text-white', className)}>
      {photo && (
        <div className="absolute inset-y-0 right-0 -z-10 hidden w-[46%] lg:block">
          <Image src={photo.src} alt="" fill sizes="46vw" priority className={cn('photo object-cover', photoPosition)} />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(14_27_48),rgb(14_27_48/0.35)_45%,rgb(14_27_48/0.1))]" />
        </div>
      )}
      <div className="px-6 pt-10 pb-8 sm:px-10 sm:pt-14 lg:max-w-[62%]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="font-display text-[clamp(2.25rem,1.5rem+2.4vw,3.5rem)] leading-[1] font-semibold tracking-[-0.035em]">
            {title}
          </h1>
          {actions}
        </div>
        <p className="mt-4 max-w-[52ch] text-[17px] leading-relaxed text-ink-100">{description}</p>
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  );
}

/** Chip de filtre sur fond sombre. */
export function BandChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-10 items-center gap-2 px-4 text-[14px] font-semibold whitespace-nowrap transition-colors',
        active ? 'bg-teal-600 text-white' : 'bg-white/10 text-white hover:bg-white/20',
      )}
    >
      {children}
    </button>
  );
}
