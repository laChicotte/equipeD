'use client';

import { useSyncExternalStore } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { disablePushOnThisDevice } from '@/lib/push';
import { api, isApiError } from '@/lib/api';
import type { Me, Role } from '@/lib/types';

export const meKey = ['auth', 'me'] as const;

const noSubscription = () => () => undefined;

/** Requête de session, partagée par `useMe` et par l'observateur passif de la racine. */
export const meQuery = {
  queryKey: meKey,
  queryFn: async (): Promise<Me | null> => {
    try {
      return await api<Me>('/auth/me');
    } catch (error) {
      if (isApiError(error) && error.statusCode === 401) return null;
      throw error;
    }
  },
  staleTime: 60_000,
};

/** Utilisateur connecté, ou `null` si la session est absente (401). */
export function useMe() {
  const query = useQuery(meQuery);
  // Pendant l'hydratation, même rendu que le serveur : le cache restauré depuis l'appareil peut
  // connaître la session avant que les zones Suspense soient hydratées.
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  if (hydrated) return query;
  return {
    ...query,
    data: undefined,
    isPending: true,
    isError: false,
    fetchStatus: 'idle' as const,
  };
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Exclude<Role, 'ADMIN'>;
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
    mutationFn: async () => {
      // Avant la fin de session : la suppression de l'abonnement exige d'être connecté.
      await disablePushOnThisDevice();
      return api<{ ok: true }>('/auth/logout', { method: 'POST' });
    },
    onSettled: () => {
      qc.setQueryData(meKey, null);
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'domains' && q.queryKey !== meKey });
    },
  });
}

/** Page d'arrivée après connexion, selon le rôle et l'état du profil. */
export function homeFor(me: Me): string {
  if (me.role === 'ADMIN') return '/admin';
  if (!me.hasProfile) return '/onboarding';
  return '/tableau-de-bord';
}
