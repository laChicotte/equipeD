'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { MentorshipRequest, MentorshipRequestStatus } from '@/lib/types';

export function useRequests(
  box: 'inbox' | 'sent',
  enabled = true,
  status?: MentorshipRequestStatus,
) {
  return useQuery({
    queryKey: ['requests', box, status ?? 'all'],
    queryFn: () => api<MentorshipRequest[]>(`/mentorship-requests/${box}`, { query: { status } }),
    enabled,
    refetchInterval: 30_000,
  });
}

function useInvalidateAll() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['requests'] });
    void qc.invalidateQueries({ queryKey: ['mentorships'] });
    void qc.invalidateQueries({ queryKey: ['dashboard'] });
    void qc.invalidateQueries({ queryKey: ['mentor'] });
    void qc.invalidateQueries({ queryKey: ['mentors'] });
  };
}

export function useCreateRequest() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: { mentorId: string; domainId?: string; goal: string; message: string }) =>
      api<MentorshipRequest>('/mentorship-requests', { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
}

export function useDecideRequest() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({
      id,
      action,
      note,
    }: {
      id: string;
      action: 'accept' | 'decline';
      note?: string;
    }) =>
      api<MentorshipRequest>(`/mentorship-requests/${id}/${action}`, {
        method: 'POST',
        body: note ? { note } : {},
      }),
    onSuccess: invalidate,
  });
}

export function useCancelRequest() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) =>
      api<MentorshipRequest>(`/mentorship-requests/${id}/cancel`, { method: 'POST', body: {} }),
    onSuccess: invalidate,
  });
}
