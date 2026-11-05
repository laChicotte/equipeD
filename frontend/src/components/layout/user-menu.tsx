'use client';

import {
  ChevronDown,
  Download,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Settings,
  UserRound,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/misc';
import { homeFor, useLogout } from '@/features/auth/api';
import { useInstallPrompt } from '@/lib/pwa';
import { roleLabels } from '@/lib/labels';
import type { Me } from '@/lib/types';
import { cn, isStaff } from '@/lib/utils';

export function UserMenu({
  me,
  compact = false,
  variant = 'default',
}: {
  me: Me;
  compact?: boolean;
  variant?: 'default' | 'nav';
}) {
  const router = useRouter();
  const logout = useLogout();
  const install = useInstallPrompt();

  const onLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => {
        toast.success('Vous êtes déconnecté·e.');
        router.replace('/connexion');
      },
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          variant === 'nav'
            ? 'inline-flex h-[60px] min-w-11 lg:min-w-[64px] flex-col items-center justify-center gap-0.5 px-2 text-[12px] text-muted-foreground transition-colors hover:text-ink-900 data-[state=open]:text-ink-900'
            : 'inline-flex h-11 items-center gap-2.5 rounded-md pr-2 pl-1.5 text-left transition-colors hover:bg-surface-muted data-[state=open]:bg-surface-muted',
        )}
        aria-label="Menu du compte"
      >
        {variant === 'nav' ? (
          <>
            <Avatar person={me} size="sm" className="size-8 text-[11px] lg:size-6 lg:text-[10px]" />
            <span className="hidden items-center gap-0.5 xl:inline-flex">
              Moi <ChevronDown className="size-3.5" aria-hidden />
            </span>
          </>
        ) : (
          <Avatar person={me} size="sm" />
        )}
        {variant !== 'nav' && !compact && (
          <span className="hidden min-w-0 flex-col leading-tight md:flex">
            <span className="truncate text-sm font-semibold">{me.firstName}</span>
            <span className="truncate text-xs text-muted-foreground">{roleLabels[me.role]}</span>
          </span>
        )}
        {variant !== 'nav' && <ChevronDown className="size-4 text-muted-foreground" aria-hidden />}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>
          <p className="text-sm font-semibold">
            {me.firstName} {me.lastName}
          </p>
          <p className="truncate text-xs text-muted-foreground">{me.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push(homeFor(me))}>
          <LayoutDashboard aria-hidden />
          {isStaff(me.role) ? 'Administration' : 'Tableau de bord'}
        </DropdownMenuItem>
        {!isStaff(me.role) && (
          <DropdownMenuItem onSelect={() => router.push('/onboarding')}>
            <UserRound aria-hidden />
            Modifier mon profil
          </DropdownMenuItem>
        )}
        {me.role === 'MENTEE' && (
          <DropdownMenuItem onSelect={() => router.push('/devenir-mentor')}>
            <GraduationCap aria-hidden />
            Devenir mentor
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => router.push('/compte')}>
          <Settings aria-hidden />
          Mon compte
        </DropdownMenuItem>
        {install && (
          <DropdownMenuItem
            onSelect={() =>
              void install().then((ok) => ok && toast.success('Application installée.'))
            }
          >
            <Download aria-hidden />
            Installer l’application
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onLogout} className="text-danger-700 [&_svg]:text-danger-700">
          <LogOut aria-hidden />
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
