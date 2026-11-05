import type { ReactNode } from 'react';
import type { Photo } from '@/lib/photos';
import { cn } from '@/lib/utils';

/** Bandeau d'en-tête vert forêt à motif de losanges : la signature des pages de découverte. */
export function PageBand({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description: ReactNode;
  /** Conservé pour compatibilité ; le bandeau n'affiche plus de photo. */
  photo?: Photo;
  photoPosition?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'relative isolate mb-6 overflow-hidden rounded-xl bg-ink-900 px-5 py-7 text-white sm:px-8 sm:py-9',
        className,
      )}
    >
      <div className="pattern-kente absolute inset-0 -z-10 opacity-[0.09]" aria-hidden />
      <div
        className="absolute -top-28 -right-20 -z-10 size-80 rounded-full bg-amber-400/20 blur-3xl"
        aria-hidden
      />
      <div
        className="absolute -bottom-32 left-1/4 -z-10 size-72 rounded-full bg-teal-500/20 blur-3xl"
        aria-hidden
      />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-[clamp(1.75rem,1.3rem+1.6vw,2.5rem)] leading-[1.05] font-semibold tracking-[-0.03em]">
            {title}
          </h1>
          <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-ink-100/85">
            {description}
          </p>
        </div>
        {actions}
      </div>
      {children && <div className="mt-6">{children}</div>}
    </section>
  );
}

/** Filtre en pastille, sur le bandeau sombre. */
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
        'inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-[14px] font-semibold whitespace-nowrap transition-colors',
        active ? 'bg-amber-400 text-ink-950' : 'bg-white/10 text-white hover:bg-white/15',
      )}
    >
      {children}
    </button>
  );
}

/** Champ de recherche blanc, posé sur le bandeau. */
export function BandSearch({
  id,
  label,
  value,
  onChange,
  placeholder,
  icon,
  trailing,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  icon: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex max-w-2xl items-stretch rounded-lg bg-surface text-ink-900 shadow-raised focus-within:ring-3 focus-within:ring-amber-400/60">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <span className="flex items-center pl-4 text-muted-foreground" aria-hidden>
        {icon}
      </span>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-13 min-w-0 flex-1 bg-transparent px-3 text-[16px] outline-none placeholder:text-muted-foreground"
      />
      {trailing}
    </div>
  );
}
