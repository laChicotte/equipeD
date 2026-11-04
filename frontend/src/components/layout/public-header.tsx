'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { homeFor, useMe } from '@/features/auth/api';
import { allPhotos } from '@/lib/photos';
import { cn } from '@/lib/utils';
import { Logo } from './logo';
import { UserMenu } from './user-menu';

const links = [
  { href: '/mentors', label: 'Trouver un mentor' },
  { href: '/#domaines', label: 'Domaines' },
  { href: '/#fonctionnement', label: 'Fonctionnement' },
];

/** Barre simple : marque à gauche, liens sur l'axe éditorial (42 %), action à droite. */
export function PublicHeader() {
  const pathname = usePathname();
  const { data: me, isPending } = useMe();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-background">
      <div className="page-frame grid h-16 grid-cols-[1fr_auto] items-center gap-4 lg:grid-cols-[var(--axis)_1fr_auto]">
        <Logo />
        <nav aria-label="Navigation principale" className="hidden items-center gap-7 lg:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                'ed-link text-[17px] font-semibold text-ink-900',
                pathname.startsWith(l.href) && l.href !== '/' && 'text-teal-700',
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 sm:gap-4">
          {isPending ? (
            <Skeleton className="h-10 w-36" />
          ) : me ? (
            <>
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link href={homeFor(me)}>Mon espace</Link>
              </Button>
              <UserMenu me={me} compact />
            </>
          ) : (
            <>
              <Link href="/connexion" className="ed-link hidden text-[17px] font-semibold text-ink-900 sm:inline">
                Se connecter
              </Link>
              <Button asChild size="sm" className="h-10 px-4">
                <Link href="/inscription">Créer un compte</Link>
              </Button>
            </>
          )}
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center text-ink-900 lg:hidden"
            aria-expanded={open}
            aria-controls="menu-mobile"
            aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="menu-mobile" aria-label="Navigation mobile" className="page-frame animate-slide-up grid gap-1 bg-background pb-6 lg:hidden">
          {[...links, ...(me ? [] : [{ href: '/connexion', label: 'Se connecter' }])].map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="py-3 text-xl font-semibold text-ink-900">
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

/** Pied de page : encre et papier inversés, colonnes en haut, la marque à pleine largeur en bas. */
export function PublicFooter() {
  const pathname = usePathname();
  const isHome = pathname === '/';
  return (
    <footer
      className={cn(
        'grid grid-rows-[auto_1fr_auto] bg-ink-950 pt-12 text-ink-100',
        isHome ? 'min-h-svh' : 'min-h-[70svh]',
      )}
    >
      <div className="page-frame grid grid-cols-2 gap-x-6 gap-y-10 text-sm leading-relaxed lg:grid-cols-12">
        <div className="lg:col-span-3">
          <p className="font-semibold text-white">Le programme</p>
          <p className="mt-2 max-w-[30ch]">
            Hackathon « Talents connectés », Salon international du livre de jeunesse de Conakry,
            Mois du Numérique. Centre culturel franco-guinéen, 4–7 novembre 2026.
          </p>
        </div>
        <nav aria-label="Liens de pied de page" className="lg:col-span-2 lg:col-start-5">
          <p className="font-semibold text-white">Plateforme</p>
          <ul className="mt-2 grid gap-1">
            <li>
              <Link className="ed-link" href="/mentors">
                Trouver un mentor
              </Link>
            </li>
            <li>
              <Link className="ed-link" href="/inscription?role=MENTOR">
                Devenir mentor
              </Link>
            </li>
            <li>
              <Link className="ed-link" href="/connexion">
                Se connecter
              </Link>
            </li>
          </ul>
        </nav>
        <div className="lg:col-span-3">
          <p className="font-semibold text-white">À savoir</p>
          <p className="mt-2 max-w-[34ch]">
            « Talents Connectés » est un nom provisoire. L’accompagnement Campus France relève du
            conseil et de l’orientation, sans garantie d’admission ni de visa.
          </p>
        </div>
        <div className="col-span-2 lg:col-span-3">
          <p className="font-semibold text-white">Photographies</p>
          <ul className="mt-2 grid gap-1">
            {allPhotos.map((p) => (
              <li key={p.src}>
                <a href={p.page} target="_blank" rel="noopener noreferrer" className="ed-link">
                  {p.caption}
                </a>{' '}
                · {p.creator}, {p.license}, Wikimedia Commons
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div aria-hidden />
      <div className="page-frame pb-5">
        <p aria-hidden className="text-[19.5vw] leading-[0.86] font-extrabold tracking-[-0.055em] text-white sm:hidden">
          Talents
          <br />
          Connectés
        </p>
        <svg viewBox="0 0 1000 116" className="hidden w-full text-white sm:block" role="img" aria-label="Talents Connectés">
          <text
            x="0"
            y="96"
            textLength="1000"
            lengthAdjust="spacingAndGlyphs"
            fill="currentColor"
            style={{ font: '800 118px var(--font-schibsted)', letterSpacing: '-0.05em' }}
          >
            Talents Connectés
          </text>
        </svg>
        <p className="mt-4 text-[13px] text-ink-100/80">
          Prototype de démonstration réalisé pendant le hackathon. Données et profils fictifs.
        </p>
      </div>
    </footer>
  );
}
