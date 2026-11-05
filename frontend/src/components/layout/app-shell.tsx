'use client';

import {
  House,
  UserSearch,
  BookOpen,
  Briefcase,
  CalendarDays,
  Shapes,
  CalendarPlus,
  Inbox,
  LayoutDashboard,
  Search,
  Send,
  ShieldCheck,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Skeleton } from '@/components/ui/misc';
import { useMe } from '@/features/auth/api';
import { useDashboard } from '@/features/mentorships/api';
import type { Me } from '@/lib/types';
import { cn } from '@/lib/utils';
import { DemoBanner } from './demo-banner';
import { Logo } from './logo';
import { PublicFooter, PublicHeader } from './public-header';
import { NotificationBell } from './notification-bell';
import { UserMenu } from './user-menu';

interface NavItem {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
  badge?: 'requests' | 'messages';
  exact?: boolean;
  /** Masqué de la barre d'onglets mobile (limitée à cinq entrées). */
  desktopOnly?: boolean;
}

function navFor(me: Me): NavItem[] {
  if (me.role === 'ADMIN') {
    return [
      {
        href: '/admin',
        label: 'Vue d’ensemble',
        short: 'Synthèse',
        icon: LayoutDashboard,
        exact: true,
      },
      { href: '/admin/comptes', label: 'Comptes', short: 'Comptes', icon: UserCog },
      { href: '/admin/mentors', label: 'Mentors', short: 'Mentors', icon: ShieldCheck },
      { href: '/admin/domaines', label: 'Domaines', short: 'Domaines', icon: Shapes },
      {
        href: '/ressources',
        label: 'Ressources',
        short: 'Ressources',
        icon: BookOpen,
        desktopOnly: true,
      },
      {
        href: '/opportunites',
        label: 'Opportunités',
        short: 'Opportunités',
        icon: Briefcase,
        desktopOnly: true,
      },
    ];
  }
  if (me.role === 'MENTOR') {
    return [
      { href: '/tableau-de-bord', label: 'Tableau de bord', short: 'Accueil', icon: House },
      {
        href: '/demandes',
        label: 'Demandes reçues',
        short: 'Demandes',
        icon: Inbox,
        badge: 'requests',
      },
      {
        href: '/mentorats',
        label: 'Mes mentorés',
        short: 'Mentorés',
        icon: Users,
        badge: 'messages',
      },
      { href: '/disponibilites', label: 'Disponibilités', short: 'Créneaux', icon: CalendarPlus },
      { href: '/seances', label: 'Séances', short: 'Séances', icon: CalendarDays },
      {
        href: '/ressources',
        label: 'Ressources',
        short: 'Ressources',
        icon: BookOpen,
        desktopOnly: true,
      },
      {
        href: '/opportunites',
        label: 'Opportunités',
        short: 'Opportunités',
        icon: Briefcase,
        desktopOnly: true,
      },
    ];
  }
  return [
    { href: '/tableau-de-bord', label: 'Tableau de bord', short: 'Accueil', icon: House },
    { href: '/mentors', label: 'Trouver un mentor', short: 'Mentors', icon: UserSearch },
    { href: '/demandes', label: 'Mes demandes', short: 'Demandes', icon: Send },
    {
      href: '/mentorats',
      label: 'Mes mentorats',
      short: 'Mentorats',
      icon: Users,
      badge: 'messages',
    },
    { href: '/seances', label: 'Séances', short: 'Séances', icon: CalendarDays },
    {
      href: '/ressources',
      label: 'Ressources',
      short: 'Ressources',
      icon: BookOpen,
      desktopOnly: true,
    },
    {
      href: '/opportunites',
      label: 'Opportunités',
      short: 'Opportunités',
      icon: Briefcase,
      desktopOnly: true,
    },
  ];
}

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function useBadgeCounts(enabled: boolean) {
  const { data } = useDashboard(enabled);
  if (!enabled || !data) return { requests: 0, messages: 0 };
  return {
    requests: data.role === 'MENTOR' ? data.pendingRequests : 0,
    messages: data.unreadMessages,
  };
}

function TopNav({
  me,
  items,
  counts,
}: {
  me: Me;
  items: NavItem[];
  counts: Record<string, number>;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState('');
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 print:hidden bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-3 px-4 sm:px-6">
        <Logo href={me.role === 'ADMIN' ? '/admin' : '/tableau-de-bord'} className="text-ink-900" />

        {/* Navigation centrale en pastilles */}
        <nav aria-label="Navigation de l’espace" className="mx-auto hidden min-w-0 lg:block">
          <ul className="scrollbar-none flex items-center gap-1 overflow-x-auto rounded-lg bg-surface-muted/70 p-1">
            {items.map((item) => {
              const active = isActive(pathname, item);
              const Icon = item.icon;
              const count = item.badge ? (counts[item.badge] ?? 0) : 0;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    aria-label={item.label}
                    title={item.label}
                    className={cn(
                      'relative inline-flex h-10 items-center gap-2 rounded-md px-3 text-[14px] font-semibold whitespace-nowrap transition-colors',
                      active
                        ? 'bg-ink-900 text-white shadow-card'
                        : 'text-muted-foreground hover:bg-surface hover:text-ink-900',
                    )}
                  >
                    <Icon
                      className={cn('size-[18px] shrink-0', active && 'text-amber-400')}
                      aria-hidden
                    />
                    {active && <span>{item.short}</span>}
                    {count > 0 && (
                      <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-teal-600 px-1 text-[10px] font-semibold text-white tabular-nums">
                        {count > 9 ? '9+' : count}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Recherche à droite */}
        <form
          role="search"
          className="relative ml-auto min-w-0 flex-1 lg:ml-0 lg:w-[220px] lg:flex-none xl:w-[260px]"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(q.trim() ? `/mentors?q=${encodeURIComponent(q.trim())}` : '/mentors');
          }}
        >
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <label htmlFor="recherche-globale" className="sr-only">
            Rechercher un mentor
          </label>
          <input
            id="recherche-globale"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un mentor…"
            className="h-10 w-full rounded-md border border-border bg-background pr-3 pl-9 text-[14px] text-ink-900 outline-none placeholder:text-muted-foreground focus:border-teal-600 focus:bg-surface focus:ring-3 focus:ring-teal-600/15"
          />
        </form>
        <div className="flex shrink-0 items-center gap-0.5">
          {me.role !== 'ADMIN' && <NotificationBell />}
          <UserMenu me={me} compact />
        </div>
      </div>
    </header>
  );
}

function MobileTabBar({ items, counts }: { items: NavItem[]; counts: Record<string, number> }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigation de l’espace"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 print:hidden bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {items
          .filter((i) => !i.desktopOnly)
          .map((item) => {
            const active = isActive(pathname, item);
            const Icon = item.icon;
            const count = item.badge ? (counts[item.badge] ?? 0) : 0;
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors',
                    active ? 'text-ink-900' : 'text-muted-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'relative inline-flex h-7 w-12 items-center justify-center rounded-md transition-colors',
                      active && 'bg-ink-900 text-amber-400',
                    )}
                  >
                    <Icon className="size-[18px]" aria-hidden />
                    {count > 0 && (
                      <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-600 px-1 text-[10px] text-white ring-2 ring-surface">
                        {count > 9 ? '9+' : count}
                      </span>
                    )}
                  </span>
                  {item.short}
                </Link>
              </li>
            );
          })}
      </ul>
    </nav>
  );
}

export function ShellSkeleton() {
  return (
    <div className="min-h-dvh bg-background">
      <div className="h-16 border-b border-border/70 bg-surface" />
      <div className="mx-auto max-w-[1240px] p-4 sm:p-8">
        <Skeleton className="mb-3 h-8 w-64" />
        <Skeleton className="mb-8 h-4 w-96 max-w-full" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      </div>
    </div>
  );
}

function AuthenticatedLayout({ me, children }: { me: Me; children: ReactNode }) {
  const items = navFor(me);
  const counts = useBadgeCounts(me.role !== 'ADMIN' && me.hasProfile);
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <DemoBanner />
      <TopNav me={me} items={items} counts={counts} />
      <main
        id="contenu"
        className="mx-auto w-full max-w-[1240px] flex-1 px-4 pt-6 pb-28 sm:px-6 lg:pb-12"
      >
        {children}
      </main>
      <MobileTabBar items={items} counts={counts} />
    </div>
  );
}

/** Coque de l'espace connecté : vérifie la session (`/auth/me`) et l'état du profil. */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: me, isPending, isError } = useMe();

  const needsOnboarding =
    !!me && me.role !== 'ADMIN' && !me.hasProfile && pathname !== '/onboarding';

  useEffect(() => {
    if (isPending) return;
    if (me === null) router.replace(`/connexion?next=${encodeURIComponent(pathname)}`);
    else if (needsOnboarding) router.replace('/onboarding');
  }, [isPending, me, needsOnboarding, pathname, router]);

  if (isError) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Impossible de joindre le serveur. Vérifiez que l’API est démarrée puis rechargez la page.
        </p>
      </div>
    );
  }
  if (isPending || !me || needsOnboarding) return <ShellSkeleton />;

  if (pathname === '/onboarding') {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <DemoBanner />
        <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-4 sm:px-8">
          <Logo href="/" />
          <UserMenu me={me} />
        </header>
        <main id="contenu" className="flex-1 px-4 py-8 sm:py-12">
          {children}
        </main>
      </div>
    );
  }

  return <AuthenticatedLayout me={me}>{children}</AuthenticatedLayout>;
}

/** Pages publiques consultables connecté ou non (annuaire, fiche mentor). */
export function AdaptiveShell({ children }: { children: ReactNode }) {
  const { data: me, isPending } = useMe();
  if (isPending) return <ShellSkeleton />;
  if (me && (me.role === 'ADMIN' || me.hasProfile)) {
    return <AuthenticatedLayout me={me}>{children}</AuthenticatedLayout>;
  }
  return (
    <div className="flex min-h-dvh flex-col">
      <DemoBanner />
      <PublicHeader />
      <main
        id="contenu"
        className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
      >
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
