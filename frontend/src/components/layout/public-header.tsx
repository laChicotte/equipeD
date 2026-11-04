'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { homeFor, useMe } from '@/features/auth/api';
import { cn } from '@/lib/utils';
import { Logo } from './logo';
import { UserMenu } from './user-menu';

const links = [
  { href: '/mentors', label: 'Trouver un mentor' },
  { href: '/#fonctionnement', label: 'Fonctionnement' },
  { href: '/#domaines', label: 'Domaines' },
];

export function PublicHeader() {
  const pathname = usePathname();
  const { data: me, isPending } = useMe();

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-surface/80 backdrop-blur-md supports-[backdrop-filter]:bg-surface/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-8">
        <div className="flex items-center gap-8">
          <Logo />
          <nav aria-label="Navigation principale" className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground',
                  pathname.startsWith(l.href) && l.href !== '/' && 'text-foreground',
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {isPending ? (
            <Skeleton className="h-9 w-32" />
          ) : me ? (
            <>
              <Button asChild variant="secondary" size="sm" className="hidden sm:inline-flex">
                <Link href={homeFor(me)}>Mon espace</Link>
              </Button>
              <UserMenu me={me} compact />
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/connexion">Se connecter</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/inscription">Créer un compte</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-8">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Prototype réalisé pour le hackathon « Talents connectés » — Salon international du livre
            de jeunesse de Conakry, Mois du Numérique 2026.
          </p>
        </div>
        <nav aria-label="Liens de pied de page" className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm">
          <Link className="text-muted-foreground hover:text-foreground" href="/mentors">
            Trouver un mentor
          </Link>
          <Link className="text-muted-foreground hover:text-foreground" href="/inscription?role=MENTOR">
            Devenir mentor
          </Link>
          <Link className="text-muted-foreground hover:text-foreground" href="/connexion">
            Se connecter
          </Link>
          <Link className="text-muted-foreground hover:text-foreground" href="/#domaines">
            Domaines
          </Link>
        </nav>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted-foreground sm:px-8">
          « Talents Connectés » est un nom provisoire. Le domaine Campus France relève du conseil et
          de l’orientation, sans garantie d’admission ni de visa.
        </p>
      </div>
    </footer>
  );
}
