'use client';

import { ChevronDown, LayoutDashboard, LogOut, Settings, UserRound } from 'lucide-react';
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
import { roleLabels } from '@/lib/labels';
import type { Me } from '@/lib/types';
import { cn } from '@/lib/utils';

export function UserMenu({ me, compact = false }: { me: Me; compact?: boolean }) {
  const router = useRouter();
  const logout = useLogout();

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
          'inline-flex h-11 items-center gap-2.5 rounded-md pr-2 pl-1.5 text-left transition-colors hover:bg-surface-muted data-[state=open]:bg-surface-muted',
        )}
        aria-label="Menu du compte"
      >
        <Avatar person={me} size="sm" />
        {!compact && (
          <span className="hidden min-w-0 flex-col leading-tight md:flex">
            <span className="truncate text-sm font-semibold">{me.firstName}</span>
            <span className="truncate text-xs text-muted-foreground">{roleLabels[me.role]}</span>
          </span>
        )}
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
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
          {me.role === 'ADMIN' ? 'Administration' : 'Tableau de bord'}
        </DropdownMenuItem>
        {me.role !== 'ADMIN' && (
          <DropdownMenuItem onSelect={() => router.push('/onboarding')}>
            <UserRound aria-hidden />
            Modifier mon profil
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => router.push('/compte')}>
          <Settings aria-hidden />
          Mon compte
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onLogout} className="text-danger-700 [&_svg]:text-danger-700">
          <LogOut aria-hidden />
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
