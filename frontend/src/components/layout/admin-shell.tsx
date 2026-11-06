'use client';

import {
  Award,
  BadgeCheck,
  ChartColumn,
  Flag,
  LayoutDashboard,
  Menu,
  ScrollText,
  Settings,
  Shapes,
  ShieldCheck,
  UserCog,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { AssistantWidget } from '@/features/ai/assistant-widget';
import { OfflineBanner } from '@/features/offline/offline-banner';
import type { Me } from '@/lib/types';
import { cn } from '@/lib/utils';
import { DemoBanner } from './demo-banner';
import { Logo } from './logo';
import { UserMenu } from './user-menu';

interface AdminLink {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

/** Uniquement les fonctions de l'équipe de la plateforme : rien du parcours mentor ou mentoré. */
const SECTIONS: { title: string; links: AdminLink[] }[] = [
  {
    title: 'Suivi',
    links: [
      { href: '/admin', label: 'Tableau de bord', icon: LayoutDashboard, exact: true },
      { href: '/admin/pilotage', label: 'Pilotage', icon: ChartColumn },
    ],
  },
  {
    title: 'Modération',
    links: [
      { href: '/admin/verifications', label: 'Vérifications', icon: BadgeCheck },
      { href: '/admin/comptes', label: 'Comptes', icon: UserCog },
      { href: '/admin/mentors', label: 'Mentors', icon: ShieldCheck },
      { href: '/admin/contenus', label: 'Contenus', icon: Flag },
      { href: '/admin/certificats', label: 'Certificats', icon: Award },
    ],
  },
  {
    title: 'Configuration',
    links: [
      { href: '/admin/domaines', label: 'Domaines', icon: Shapes },
      { href: '/admin/equipe', label: 'Équipe', icon: UsersRound },
      { href: '/admin/journal', label: 'Journal d’audit', icon: ScrollText },
      { href: '/compte', label: 'Mon compte', icon: Settings },
    ],
  },
];

const isActive = (pathname: string, link: AdminLink) =>
  link.exact
    ? pathname === link.href
    : pathname === link.href || pathname.startsWith(`${link.href}/`);

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Administration" className="flex-1 overflow-y-auto px-3 py-4">
      {SECTIONS.map((section) => (
        <div key={section.title} className="mb-5 last:mb-0">
          <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-wider text-ink-100/60 uppercase">
            {section.title}
          </p>
          <ul className="space-y-0.5">
            {section.links.map((link) => {
              const active = isActive(pathname, link);
              const Icon = link.icon;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex h-10 items-center gap-3 rounded-md px-3 text-[14px] font-medium transition-colors',
                      active
                        ? 'bg-white/10 text-white'
                        : 'text-ink-100 hover:bg-white/5 hover:text-white',
                    )}
                  >
                    <Icon
                      className={cn(
                        'size-[18px] shrink-0',
                        active ? 'text-amber-400' : 'text-ink-100/70',
                      )}
                      aria-hidden
                    />
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarBrand({ action }: { action?: ReactNode }) {
  return (
    <div className="flex h-16 shrink-0 items-center gap-2 border-b border-white/10 px-5">
      <span className="rounded-md bg-white px-2 py-1">
        <Logo href="/admin" className="text-ink-900" />
      </span>
      <span className="text-[11px] font-semibold tracking-wider text-amber-400 uppercase">
        Admin
      </span>
      {action && <span className="ml-auto">{action}</span>}
    </div>
  );
}

/** Coque de l'espace d'administration : barre latérale fixe sur ordinateur, tiroir sur mobile. */
export function AdminShell({ me, children }: { me: Me; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  // Le tiroir se referme quand on choisit une page (onNavigate) et avec Échap.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <DemoBanner />
      <OfflineBanner />
      <div className="flex flex-1">
        {/* Barre latérale (ordinateur) */}
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-ink-950 lg:flex print:hidden">
          <SidebarBrand />
          <SidebarNav />
        </aside>

        {/* Tiroir (mobile et tablette) */}
        {open && (
          <div
            className="fixed inset-0 z-50 lg:hidden"
            role="dialog"
            aria-label="Menu d’administration"
          >
            <button
              type="button"
              aria-label="Fermer le menu"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-ink-950/50"
            />
            <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-ink-950 shadow-raised">
              <SidebarBrand
                action={
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Fermer le menu"
                    className="-mr-2 inline-flex size-10 items-center justify-center rounded-md text-ink-100 hover:bg-white/10"
                  >
                    <X className="size-5" aria-hidden />
                  </button>
                }
              />
              <SidebarNav onNavigate={() => setOpen(false)} />
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/70 bg-surface/90 px-4 backdrop-blur-md sm:px-6 print:hidden">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Ouvrir le menu d’administration"
              className="inline-flex size-10 items-center justify-center rounded-md text-ink-900 hover:bg-surface-muted lg:hidden"
            >
              <Menu className="size-5" aria-hidden />
            </button>
            <span className="lg:hidden">
              <Logo href="/admin" className="text-ink-900" />
            </span>
            <p className="hidden text-sm text-muted-foreground lg:block">
              Espace d’administration de la plateforme
            </p>
            <div className="ml-auto">
              <UserMenu me={me} />
            </div>
          </header>
          <main
            id="contenu"
            className="mx-auto w-full max-w-[1200px] flex-1 px-4 pt-6 pb-24 sm:px-6 lg:px-8 lg:pb-12"
          >
            {children}
          </main>
        </div>
      </div>
      <AssistantWidget role={me.role} />
    </div>
  );
}
