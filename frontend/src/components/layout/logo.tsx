import Link from 'next/link';
import { cn } from '@/lib/utils';

/** Marque provisoire « Talents Connectés » (nom remplaçable, non déposé). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8', className)} aria-hidden>
      <rect width="32" height="32" rx="9" className="fill-ink-900" />
      <circle cx="11.5" cy="12" r="3.6" className="fill-teal-500" />
      <circle cx="20.5" cy="20" r="3.6" className="fill-amber-400" />
      <path
        d="M13.8 14.6 18.2 17.4"
        strokeWidth="2.4"
        strokeLinecap="round"
        className="stroke-white/85"
        fill="none"
      />
    </svg>
  );
}

export function Logo({ href = '/', inverted = false }: { href?: string; inverted?: boolean }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-2.5 rounded-md focus-visible:outline-offset-4"
      aria-label="Talents Connectés — accueil"
    >
      <LogoMark />
      <span
        className={cn(
          'text-[17px] font-semibold tracking-tight',
          inverted ? 'text-white' : 'text-ink-900',
        )}
      >
        Talents<span className={inverted ? 'text-teal-200' : 'text-teal-700'}> Connectés</span>
      </span>
    </Link>
  );
}
