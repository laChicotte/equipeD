'use client';

import {
  House,
  UserSearch,
  BookOpen,
  Briefcase,
  CalendarDays,
  CalendarPlus,
  Inbox,
  MessageSquareText,
  Search,
  GraduationCap,
  Menu,
  Send,
  Settings,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/misc';
import { roleLabels } from '@/lib/labels';
import { AssistantWidget, PublicAssistant } from '@/features/ai/assistant-widget';
import { homeFor, useMe } from '@/features/auth/api';
import { useDashboard } from '@/features/mentorships/api';
import { OfflineBanner } from '@/features/offline/offline-banner';
import type { Me } from '@/lib/types';
import { cn, isStaff } from '@/lib/utils';
import { AdminShell } from './admin-shell';
import { PushPrompt } from '@/features/notifications/push-settings';
import { VerifyEmailBanner } from '@/features/auth/components/verify-email';
import { usePushSync } from '@/lib/push';
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
        href: '/messages',
        label: 'Messagerie',
        short: 'Messages',
        icon: MessageSquareText,
        badge: 'messages',
      },
      { href: '/mentorats', label: 'Mes mentorés', short: 'Mentorés', icon: Users },
      { href: '/disponibilites', label: 'Disponibilités', short: 'Créneaux', icon: CalendarPlus },
      {
        href: '/seances',
        label: 'Séances',
        short: 'Séances',
        icon: CalendarDays,
        desktopOnly: true,
      },
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
      href: '/messages',
      label: 'Messagerie',
      short: 'Messages',
      icon: MessageSquareText,
      badge: 'messages',
    },
    { href: '/mentorats', label: 'Mes mentorats', short: 'Mentorats', icon: Users },
    { href: '/seances', label: 'Séances', short: 'Séances', icon: CalendarDays, desktopOnly: true },
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

/** Sections de la barre latérale : l'espace de travail, puis la découverte. */
function sectionsFor(me: Me, items: NavItem[]) {
  const discover = ['/mentors', '/ressources', '/opportunites'];
  const work = items.filter((i) => !discover.includes(i.href));
  const explore = items.filter((i) => discover.includes(i.href));
  return [
    { title: 'Mon espace', items: work },
    { title: me.role === 'MENTOR' ? 'Partager' : 'Découvrir', items: explore },
  ];
}

function SidebarNav({
  me,
  items,
  counts,
  onNavigate,
}: {
  me: Me;
  items: NavItem[];
  counts: Record<string, number>;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const link = (item: NavItem) => {
    const active = isActive(pathname, item);
    const Icon = item.icon;
    const count = item.badge ? (counts[item.badge] ?? 0) : 0;
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onClick={onNavigate}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'group relative flex h-10 items-center gap-3 rounded-lg px-3 text-[14px] font-medium transition-colors',
            active ? 'bg-white/10 text-white' : 'text-ink-100/85 hover:bg-white/5 hover:text-white',
          )}
        >
          {active && (
            <span
              className="absolute top-2 bottom-2 left-0 w-[3px] rounded-r-full bg-amber-400"
              aria-hidden
            />
          )}
          <Icon
            className={cn(
              'size-[18px] shrink-0 transition-colors',
              active ? 'text-amber-400' : 'text-ink-100/60 group-hover:text-ink-100',
            )}
            aria-hidden
          />
          <span className="flex-1 truncate">{item.label}</span>
          {count > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-teal-600 px-1.5 text-[11px] font-semibold text-white tabular-nums">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </Link>
      </li>
    );
  };
  return (
    <nav aria-label="Navigation de l’espace" className="flex-1 overflow-y-auto px-3 py-5">
      {sectionsFor(me, items).map((section) =>
        section.items.length ? (
          <div key={section.title} className="mb-6 last:mb-0">
            <p className="px-3 pb-2 text-[11px] font-semibold tracking-[0.08em] text-ink-100/50 uppercase">
              {section.title}
            </p>
            <ul className="space-y-0.5">{section.items.map(link)}</ul>
          </div>
        ) : null,
      )}
      <div className="mt-6 border-t border-white/10 pt-5">
        <ul className="space-y-0.5">
          {link({ href: '/compte', label: 'Mon compte', short: 'Compte', icon: Settings })}
          {me.role === 'MENTEE' &&
            link({
              href: '/devenir-mentor',
              label: 'Devenir mentor',
              short: 'Mentor',
              icon: GraduationCap,
            })}
        </ul>
      </div>
    </nav>
  );
}

function SidebarBrand({ me, action }: { me: Me; action?: ReactNode }) {
  return (
    <div className="flex h-16 shrink-0 items-center gap-2 border-b border-white/10 px-4">
      <span className="rounded-lg bg-white px-2 py-1">
        <Logo href={homeFor(me)} className="text-ink-900" />
      </span>
      {action && <span className="ml-auto">{action}</span>}
    </div>
  );
}

/** Carte du compte en bas de la barre latérale. */
function SidebarAccount({ me }: { me: Me }) {
  return (
    <div className="border-t border-white/10 p-3">
      <Link
        href="/compte"
        className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-white/5"
      >
        <Avatar person={me} size="sm" className="ring-2 ring-white/10" />
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold text-white">
            {me.firstName} {me.lastName}
          </span>
          <span className="block truncate text-[12px] text-ink-100/60">{roleLabels[me.role]}</span>
        </span>
      </Link>
    </div>
  );
}

function HeaderSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');
  return (
    <form
      role="search"
      className="relative hidden w-full max-w-md md:block"
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
        placeholder="Rechercher un mentor, une compétence…"
        className="h-10 w-full rounded-lg border border-border bg-background pr-3 pl-9 text-[14px] text-ink-900 outline-none placeholder:text-muted-foreground focus:border-teal-600 focus:bg-surface focus:ring-3 focus:ring-teal-600/15"
      />
    </form>
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
  if (isStaff(me.role)) return <AdminShell me={me}>{children}</AdminShell>;
  return <MemberLayout me={me}>{children}</MemberLayout>;
}

function MemberLayout({ me, children }: { me: Me; children: ReactNode }) {
  const items = navFor(me);
  usePushSync(true);
  const counts = useBadgeCounts(!isStaff(me.role) && me.hasProfile);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <OfflineBanner />
      <div className="flex flex-1">
        {/* Barre latérale (ordinateur) */}
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-ink-950 lg:flex print:hidden">
          <SidebarBrand me={me} />
          <SidebarNav me={me} items={items} counts={counts} />
          <SidebarAccount me={me} />
        </aside>

        {/* Tiroir (mobile et tablette) */}
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-label="Menu">
            <button
              type="button"
              aria-label="Fermer le menu"
              onClick={() => setOpen(false)}
              className="absolute inset-0 animate-fade-in bg-ink-950/50"
            />
            <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] animate-slide-up flex-col bg-ink-950 shadow-raised">
              <SidebarBrand
                me={me}
                action={
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Fermer le menu"
                    className="-mr-1 inline-flex size-10 items-center justify-center rounded-md text-ink-100 hover:bg-white/10"
                  >
                    <X className="size-5" aria-hidden />
                  </button>
                }
              />
              <SidebarNav me={me} items={items} counts={counts} onNavigate={() => setOpen(false)} />
              <SidebarAccount me={me} />
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/70 bg-surface/90 px-4 backdrop-blur-md sm:px-6 print:hidden">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Ouvrir le menu"
              className="inline-flex size-10 items-center justify-center rounded-md text-ink-900 hover:bg-surface-muted lg:hidden"
            >
              <Menu className="size-5" aria-hidden />
            </button>
            <span className="lg:hidden">
              <Logo href={homeFor(me)} className="text-ink-900" />
            </span>
            <HeaderSearch />
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <NotificationBell />
              <UserMenu me={me} compact />
            </div>
          </header>
          <main
            id="contenu"
            className="mx-auto w-full max-w-[1240px] flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-8 lg:pb-12"
          >
            <VerifyEmailBanner me={me} />
            <PushPrompt />
            {children}
          </main>
        </div>
      </div>
      <MobileTabBar items={items} counts={counts} />
      <AssistantWidget role={me.role} />
    </div>
  );
}

/** Coque de l'espace connecté : vérifie la session (`/auth/me`) et l'état du profil. */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: me, isPending, isError, fetchStatus } = useMe();

  const needsOnboarding = !!me && !isStaff(me.role) && !me.hasProfile && pathname !== '/onboarding';
  // L'administrateur n'a ni demandes, ni mentorats, ni séances : seulement /admin et son compte.
  const adminOutside =
    !!me && isStaff(me.role) && !pathname.startsWith('/admin') && !pathname.startsWith('/compte');

  useEffect(() => {
    if (isPending) return;
    if (me === null) router.replace(`/connexion?next=${encodeURIComponent(pathname)}`);
    else if (needsOnboarding) router.replace('/onboarding');
    else if (adminOutside) router.replace('/admin');
  }, [isPending, me, needsOnboarding, adminOutside, pathname, router]);

  // Sans réseau et sans session gardée sur l'appareil : rien à afficher, on le dit.
  if (isPending && fetchStatus === 'paused') {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Vous êtes hors ligne. Connectez-vous une première fois avec du réseau pour retrouver vos
          messages et vos séances sur cet appareil.
        </p>
      </div>
    );
  }
  if (isError && !me) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Impossible de joindre le serveur. Vérifiez que l’API est démarrée puis rechargez la page.
        </p>
      </div>
    );
  }
  if (isPending || !me || needsOnboarding || adminOutside) return <ShellSkeleton />;

  if (pathname === '/onboarding') {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
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
  if (me && (isStaff(me.role) || me.hasProfile)) {
    return <AuthenticatedLayout me={me}>{children}</AuthenticatedLayout>;
  }
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main
        id="contenu"
        className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
      >
        {children}
      </main>
      <PublicFooter />
      <PublicAssistant />
    </div>
  );
}
