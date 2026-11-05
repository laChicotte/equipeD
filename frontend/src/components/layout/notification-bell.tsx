'use client';

import {
  Award,
  BadgeCheck,
  Bell,
  CalendarCheck2,
  CalendarX2,
  CheckCheck,
  FileText,
  Flag,
  Inbox,
  MessageSquareText,
  Presentation,
  ThumbsDown,
  ShieldX,
  ThumbsUp,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Popover } from 'radix-ui';
import { Skeleton } from '@/components/ui/misc';
import {
  useNotificationMutations,
  useNotifications,
  useUnreadCount,
} from '@/features/notifications/api';
import { formatRelative } from '@/lib/format';
import type { AppNotification, NotificationType } from '@/lib/types';
import { cn } from '@/lib/utils';

export const NOTIFICATION_ICONS: Record<NotificationType, LucideIcon> = {
  REQUEST_RECEIVED: Inbox,
  REQUEST_ACCEPTED: ThumbsUp,
  REQUEST_DECLINED: ThumbsDown,
  SESSION_REQUESTED: CalendarCheck2,
  SESSION_CONFIRMED: CalendarCheck2,
  SESSION_CANCELLED: CalendarX2,
  GOAL_FEEDBACK: MessageSquareText,
  RESOURCE_SHARED: FileText,
  MENTORSHIP_COMPLETED: Flag,
  CERTIFICATE_ISSUED: Award,
  GROUP_ADDED: UsersRound,
  WORKSHOP_SCHEDULED: Presentation,
  WORKSHOP_CANCELLED: CalendarX2,
  VERIFICATION_APPROVED: BadgeCheck,
  VERIFICATION_REJECTED: ShieldX,
};

/** Cloche de notifications in-app : badge des non-lus, liste, navigation vers l'écran concerné. */
export function NotificationBell({
  tone = 'light',
  labeled = false,
}: {
  tone?: 'light' | 'dark';
  labeled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const unread = useUnreadCount();
  const list = useNotifications(open);
  const { markRead, markAll } = useNotificationMutations();
  const count = unread.data?.count ?? 0;

  const openItem = (n: AppNotification) => {
    if (!n.readAt) markRead.mutate(n.id);
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className={cn(
          'relative inline-flex items-center justify-center rounded-md transition-colors',
          labeled
            ? 'h-[60px] min-w-11 flex-col lg:min-w-[64px] gap-0.5 px-2 text-[12px] text-muted-foreground hover:text-ink-900 data-[state=open]:text-ink-900 xl:min-w-[76px]'
            : 'size-11',
          !labeled &&
            (tone === 'dark'
              ? 'text-white hover:bg-white/10'
              : 'text-ink-900 hover:bg-surface-muted'),
        )}
        aria-label={
          count > 0 ? `Notifications : ${count} non lue${count > 1 ? 's' : ''}` : 'Notifications'
        }
      >
        <span className="relative">
          <Bell className={labeled ? 'size-[22px]' : 'size-5'} aria-hidden />
          {labeled && count > 0 && (
            <span className="absolute -top-1.5 -right-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-600 px-1 text-[10px] font-semibold text-white ring-2 ring-surface">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </span>
        {labeled && <span className="hidden xl:block">Notifications</span>}
        {!labeled && count > 0 && (
          <span className="absolute top-1.5 right-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-teal-600 px-1 text-[11px] font-semibold text-white tabular-nums ring-2 ring-surface">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[min(92vw,400px)] overflow-hidden rounded-lg border border-border bg-surface shadow-raised data-[state=open]:animate-scale-in"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <p className="font-display text-[17px] font-semibold text-ink-900">Notifications</p>
            {count > 0 && (
              <button
                type="button"
                onClick={() => markAll.mutate()}
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-teal-700 hover:text-teal-800"
              >
                <CheckCheck className="size-4" aria-hidden />
                Tout marquer comme lu
              </button>
            )}
          </div>
          <div className="scrollbar-thin max-h-[60vh] overflow-y-auto">
            {list.isPending ? (
              <div className="grid gap-2 p-4">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : !list.data || list.data.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <Bell className="mx-auto size-6 text-muted-foreground" aria-hidden />
                <p className="mt-3 text-[15px] font-semibold text-ink-900">Rien de nouveau</p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Demandes, séances et retours de votre mentor apparaîtront ici.
                </p>
              </div>
            ) : (
              <ul>
                {list.data.map((n) => {
                  const Icon = NOTIFICATION_ICONS[n.type];
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => openItem(n)}
                        className={cn(
                          'flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-background',
                          !n.readAt && 'bg-teal-50/60',
                        )}
                      >
                        <span
                          className={cn(
                            'mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full',
                            n.readAt
                              ? 'bg-surface-muted text-muted-foreground'
                              : 'bg-teal-600 text-white',
                          )}
                        >
                          <Icon className="size-4" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              'block text-[14px] leading-snug text-ink-900',
                              !n.readAt && 'font-semibold',
                            )}
                          >
                            {n.title}
                          </span>
                          {n.body && (
                            <span className="mt-0.5 line-clamp-2 block text-[13px] text-muted-foreground">
                              {n.body}
                            </span>
                          )}
                          <span className="mt-1 block text-[12px] text-muted-foreground">
                            {formatRelative(n.createdAt)}
                          </span>
                        </span>
                        {!n.readAt && (
                          <span
                            className="mt-2 size-2 shrink-0 rounded-full bg-teal-600"
                            aria-label="Non lue"
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
