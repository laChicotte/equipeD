'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Modality, OwnSlot, Session, Slot } from '@/lib/types';

export function useMyAvailability(enabled = true) {
  return useQuery({
    queryKey: ['availability', 'me'],
    queryFn: () => api<OwnSlot[]>('/availability/me'),
    enabled,
  });
}

export function useSessions(scope: 'upcoming' | 'past' | 'all' = 'upcoming') {
  return useQuery({
    queryKey: ['sessions', scope],
    queryFn: () => api<Session[]>('/sessions/me', { query: { scope } }),
    refetchInterval: 30_000,
  });
}

function useInvalidateScheduling() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['availability'] });
    void qc.invalidateQueries({ queryKey: ['sessions'] });
    void qc.invalidateQueries({ queryKey: ['dashboard'] });
    void qc.invalidateQueries({ queryKey: ['mentorships'] });
    void qc.invalidateQueries({ queryKey: ['mentor'] });
    void qc.invalidateQueries({ queryKey: ['mentors'] });
  };
}

export function useCreateSlot() {
  const invalidate = useInvalidateScheduling();
  return useMutation({
    mutationFn: (input: { startsAt: string; endsAt: string; timezone?: string }) =>
      api<Slot>('/availability', { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
}

export function useDeleteSlot() {
  const invalidate = useInvalidateScheduling();
  return useMutation({
    mutationFn: (id: string) => api<unknown>(`/availability/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useBookSession() {
  const invalidate = useInvalidateScheduling();
  return useMutation({
    mutationFn: (input: { slotId: string; topic: string; modality?: Modality }) =>
      api<Session>('/sessions', { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
}

export function useSessionAction() {
  const invalidate = useInvalidateScheduling();
  return useMutation({
    mutationFn: ({
      id,
      action,
      body,
    }: {
      id: string;
      action: 'confirm' | 'cancel' | 'complete';
      body?: { meetingUrl?: string; location?: string };
    }) => api<Session>(`/sessions/${id}/${action}`, { method: 'POST', body: body ?? {} }),
    onSuccess: invalidate,
  });
}

export function useSessionFeedback() {
  const invalidate = useInvalidateScheduling();
  return useMutation({
    mutationFn: ({ id, rating, comment }: { id: string; rating: number; comment?: string }) =>
      api<Session>(`/sessions/${id}/feedback`, { method: 'POST', body: { rating, comment } }),
    onSuccess: invalidate,
  });
}
