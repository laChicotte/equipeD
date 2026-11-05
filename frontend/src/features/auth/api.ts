'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, isApiError } from '@/lib/api';
import type { Me, Role } from '@/lib/types';

export const meKey = ['auth', 'me'] as const;

/** Utilisateur connecté, ou `null` si la session est absente (401). */
export function useMe() {
  return useQuery({
    queryKey: meKey,
    queryFn: async () => {
      try {
        return await api<Me>('/auth/me');
      } catch (error) {
        if (isApiError(error) && error.statusCode === 401) return null;
        throw error;
      }
    },
    staleTime: 60_000,
  });
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Exclude<Role, 'ADMIN' | 'SUPER_ADMIN'>;
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      api<{ ok: true }>('/auth/login', { method: 'POST', body: input }),
    onSuccess: async () => {
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'domains' });
      await qc.fetchQuery({ queryKey: meKey, queryFn: () => api<Me>('/auth/me') });
    },
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      api<{ ok: true }>('/auth/register', { method: 'POST', body: input }),
    onSuccess: async () => {
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'domains' });
      await qc.fetchQuery({ queryKey: meKey, queryFn: () => api<Me>('/auth/me') });
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ ok: true }>('/auth/logout', { method: 'POST' }),
    onSettled: () => {
      qc.setQueryData(meKey, null);
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'domains' && q.queryKey !== meKey });
    },
  });
}

/** Page d'arrivée après connexion, selon le rôle et l'état du profil. */
export function homeFor(me: Me): string {
  if (me.role === 'SUPER_ADMIN') return '/admin/pilotage';
  if (me.role === 'ADMIN') return '/admin';
  if (!me.hasProfile) return '/onboarding';
  return '/tableau-de-bord';
}
