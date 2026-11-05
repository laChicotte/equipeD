import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/** Symbole seul, pour les petits espaces (mobile, certificat, page introuvable). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src="/logo-mark.png"
      alt=""
      width={271}
      height={228}
      priority
      className={cn('size-8 object-contain', className)}
    />
  );
}

/** Logo de la plateforme. Sur mobile, le symbole seul lorsque la place manque. */
export function Logo({
  href = '/',
  className,
  compactOnMobile = true,
  onDark = false,
}: {
  href?: string;
  className?: string;
  compactOnMobile?: boolean;
  /** Sur fond sombre : pastille blanche, le bleu marine du logo y serait illisible. */
  onDark?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex shrink-0 items-center focus-visible:outline-offset-4',
        onDark && 'rounded-md bg-white px-2 py-1',
        className,
      )}
      aria-label="Talents Connectés, accueil"
    >
      <LogoMark className={cn('size-9', compactOnMobile ? 'sm:hidden' : 'hidden')} />
      <Image
        src="/logo.png"
        alt=""
        width={1032}
        height={228}
        priority
        className={cn('h-9 w-auto', compactOnMobile && 'hidden sm:block')}
      />
    </Link>
  );
}
