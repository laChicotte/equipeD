'use client';

import {
  CalendarDays,
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
import { useEffect, type ReactNode } from 'react';
import { Skeleton } from '@/components/ui/misc';
import { useMe } from '@/features/auth/api';
import { useDashboard } from '@/features/mentorships/api';
import type { Me } from '@/lib/types';
import { cn } from '@/lib/utils';
import { DemoBanner } from './demo-banner';
import { Logo } from './logo';
import { PublicFooter, PublicHeader } from './public-header';
import { UserMenu } from './user-menu';

interface NavItem {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
  badge?: 'requests' | 'messages';
  exact?: boolean;
}

function navFor(me: Me): NavItem[] {
  if (me.role === 'ADMIN') {
    return [
      { href: '/admin', label: 'Vue d’ensemble', short: 'Synthèse', icon: LayoutDashboard, exact: true },
      { href: '/admin/comptes', label: 'Comptes', short: 'Comptes', icon: UserCog },
      { href: '/admin/mentors', label: 'Mentors', short: 'Mentors', icon: ShieldCheck },
    ];
  }
  if (me.role === 'MENTOR') {
    return [
      { href: '/tableau-de-bord', label: 'Tableau de bord', short: 'Accueil', icon: LayoutDashboard },
      { href: '/demandes', label: 'Demandes reçues', short: 'Demandes', icon: Inbox, badge: 'requests' },
      { href: '/mentorats', label: 'Mes mentorés', short: 'Mentorés', icon: Users, badge: 'messages' },
      { href: '/disponibilites', label: 'Disponibilités', short: 'Créneaux', icon: CalendarPlus },
      { href: '/seances', label: 'Séances', short: 'Séances', icon: CalendarDays },
    ];
  }
  return [
    { href: '/tableau-de-bord', label: 'Tableau de bord', short: 'Accueil', icon: LayoutDashboard },
    { href: '/mentors', label: 'Trouver un mentor', short: 'Mentors', icon: Search },
    { href: '/demandes', label: 'Mes demandes', short: 'Demandes', icon: Send },
    { href: '/mentorats', label: 'Mes mentorats', short: 'Mentorats', icon: Users, badge: 'messages' },
    { href: '/seances', label: 'Séances', short: 'Séances', icon: CalendarDays },
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

function CountBadge({ value, className }: { value: number; className?: string }) {
  if (!value) return null;
  return (
    <span
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-teal-700 px-1.5 text-[11px] font-semibold tabular-nums text-white',
        className,
      )}
    >
      {value > 99 ? '99+' : value}
      <span className="sr-only"> nouveau(x)</span>
    </span>
  );
}

function Sidebar({ me, items, counts }: { me: Me; items: NavItem[]; counts: Record<string, number> }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface lg:flex">
      <div className="flex h-16 items-center px-5">
        <Logo href={me.role === 'ADMIN' ? '/admin' : '/tableau-de-bord'} />
      </div>
      <nav aria-label="Navigation de l’espace" className="flex flex-1 flex-col gap-0.5 px-3 py-4">
        <p className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          {me.role === 'ADMIN' ? 'Administration' : me.role === 'MENTOR' ? 'Espace mentor' : 'Mon parcours'}
        </p>
        {items.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors duration-150',
                active
                  ? 'bg-ink-900 text-white shadow-card'
                  : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
              )}
            >
              <Icon
                className={cn('size-[18px] shrink-0', active ? 'text-teal-200' : 'text-muted-foreground group-hover:text-foreground')}
                aria-hidden
              />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge && (
                <CountBadge
                  value={counts[item.badge] ?? 0}
                  className={active ? 'bg-white text-ink-900' : undefined}
                />
              )}
            </Link>
          );
        })}
      </nav>
      <div className="m-3 rounded-lg border border-border bg-surface-muted p-4">
        <p className="text-xs font-semibold text-foreground">Besoin d’un repère ?</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {me.role === 'MENTOR'
            ? 'Publiez des créneaux pour que vos mentorés puissent réserver une séance.'
            : me.role === 'MENTEE'
              ? 'Un objectif clair dans votre demande augmente vos chances d’être accompagné·e.'
              : 'Vérifiez les profils mentors avant leur mise en avant.'}
        </p>
      </div>
    </aside>
  );
}

function MobileTabBar({ items, counts }: { items: NavItem[]; counts: Record<string, number> }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigation de l’espace"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {items.map((item) => {
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
                {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-teal-600" aria-hidden />}
                <span className="relative">
                  <Icon className={cn('size-5', active && 'text-teal-700')} aria-hidden />
                  {count > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-700 px-1 text-[10px] text-white">
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
    <div className="flex min-h-dvh">
      <div className="hidden w-60 border-r border-border bg-surface lg:block" />
      <div className="flex-1 p-4 sm:p-8">
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
    <div className="flex min-h-dvh flex-col">
      <DemoBanner />
      <div className="flex flex-1">
        <Sidebar me={me} items={items} counts={counts} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-surface/85 px-4 backdrop-blur-md sm:px-8">
            <div className="lg:hidden">
              <Logo href={me.role === 'ADMIN' ? '/admin' : '/tableau-de-bord'} />
            </div>
            <p className="hidden text-sm text-muted-foreground lg:block">
              Bonjour <span className="font-semibold text-foreground">{me.firstName}</span>
            </p>
            <UserMenu me={me} />
          </header>
          <main id="contenu" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 sm:px-8 sm:pt-8 lg:pb-12">
            {children}
          </main>
        </div>
      </div>
      <MobileTabBar items={items} counts={counts} />
    </div>
  );
}

/** Coque de l'espace connecté : vérifie la session (`/auth/me`) et l'état du profil. */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: me, isPending, isError } = useMe();

  const needsOnboarding = !!me && me.role !== 'ADMIN' && !me.hasProfile && pathname !== '/onboarding';

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
      <main id="contenu" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8 sm:py-10">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
