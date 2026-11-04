'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ProfileMe } from '@/lib/types';
import { meKey } from '@/features/auth/api';

export function useAccountMutations() {
  const qc = useQueryClient();
  return {
    updateAccount: useMutation({
      mutationFn: (input: { firstName?: string; lastName?: string; timezone?: string }) =>
        api<ProfileMe>('/profile/me', { method: 'PATCH', body: input }),
      onSuccess: (data) => {
        qc.setQueryData(['profile', 'me'], data);
        void qc.invalidateQueries({ queryKey: meKey });
        void qc.invalidateQueries({ queryKey: ['mentors'] });
      },
    }),
    changePassword: useMutation({
      mutationFn: (input: { currentPassword: string; newPassword: string }) =>
        api<{ revokedSessions: number }>('/auth/password', { method: 'POST', body: input }),
    }),
    logoutAll: useMutation({
      mutationFn: () => api<{ ok: boolean; revokedSessions: number }>('/auth/logout-all', { method: 'POST', body: {} }),
      onSuccess: () => qc.clear(),
    }),
    deleteAccount: useMutation({
      mutationFn: (input: { password: string; confirmation: string }) =>
        api<{ ok: boolean; closedMentorships: number }>('/profile/me', { method: 'DELETE', body: input }),
      onSuccess: () => qc.clear(),
    }),
  };
}
