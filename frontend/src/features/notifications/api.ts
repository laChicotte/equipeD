'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AppNotification } from '@/lib/types';

const key = ['notifications'] as const;

/** Compteur léger pour le badge de la cloche (rafraîchi toutes les 30 s). */
export function useUnreadCount(enabled = true) {
  return useQuery({
    queryKey: [...key, 'unread-count'],
    queryFn: () => api<{ count: number }>('/notifications/unread-count'),
    refetchInterval: 30_000,
    enabled,
  });
}

export function useNotifications(enabled: boolean) {
  return useQuery({
    queryKey: [...key, 'list'],
    queryFn: () => api<AppNotification[]>('/notifications', { query: { limit: 20 } }),
    enabled,
  });
}

export function useNotificationMutations() {
  const qc = useQueryClient();
  const invalidate = () => void qc.invalidateQueries({ queryKey: key });
  return {
    markRead: useMutation({
      mutationFn: (id: string) =>
        api<unknown>(`/notifications/${id}/read`, { method: 'POST', body: {} }),
      onSuccess: invalidate,
    }),
    markAll: useMutation({
      mutationFn: () =>
        api<{ updated: number }>('/notifications/read-all', { method: 'POST', body: {} }),
      onSuccess: invalidate,
    }),
  };
}
