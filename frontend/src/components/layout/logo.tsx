import Link from 'next/link';
import { cn } from '@/lib/utils';

/** Monogramme « TC » pour les espaces réduits (barre latérale de l'application). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8', className)} aria-hidden>
      <rect width="32" height="32" rx="3" className="fill-ink-900" />
      <rect x="18" y="18" width="14" height="14" className="fill-teal-600" />
      <text x="5" y="21" className="fill-white" style={{ font: '800 14px var(--font-schibsted)' }}>
        TC
      </text>
    </svg>
  );
}

/** Marque provisoire « Talents Connectés » (nom remplaçable, non déposé). Sur mobile, le monogramme seul. */
export function Logo({
  href = '/',
  inverted = false,
  className,
  compactOnMobile = true,
}: {
  href?: string;
  inverted?: boolean;
  className?: string;
  compactOnMobile?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex shrink-0 items-center gap-2 text-[18px] leading-none font-extrabold tracking-[-0.04em] whitespace-nowrap focus-visible:outline-offset-4',
        inverted ? 'text-white' : 'text-current',
        className,
      )}
      aria-label="Talents Connectés, accueil"
    >
      <LogoMark className="size-8" />
      <span className={cn(compactOnMobile && 'hidden sm:inline')}>Talents Connectés</span>
    </Link>
  );
}
