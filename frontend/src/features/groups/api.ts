'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type {
  GroupCandidate,
  GroupDetail,
  GroupMessage,
  GroupSummary,
  Modality,
  Workshop,
} from '@/lib/types';

function usePageVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === 'visible');
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return visible;
}

export function useGroups(enabled = true) {
  return useQuery({
    queryKey: ['groups', 'me'],
    queryFn: () => api<GroupSummary[]>('/groups/me'),
    enabled,
    refetchInterval: 30_000,
  });
}

export function useGroup(id: string | null) {
  return useQuery({
    queryKey: ['groups', id],
    queryFn: () => api<GroupDetail>(`/groups/${id}`),
    enabled: !!id,
  });
}

/** Personnes ajoutables : à un nouveau groupe (groupId null) ou à un groupe existant. */
export function useGroupCandidates(groupId: string | null, q: string, enabled = true) {
  return useQuery({
    queryKey: ['groups', 'candidates', groupId, q],
    queryFn: () =>
      api<GroupCandidate[]>(groupId ? `/groups/${groupId}/candidates` : '/groups/candidates', {
        query: q ? { q } : undefined,
      }),
    enabled,
    placeholderData: (previous) => previous,
  });
}

export function useGroupMessages(groupId: string) {
  const visible = usePageVisible();
  return useQuery({
    queryKey: ['groups', groupId, 'messages'],
    queryFn: () => api<GroupMessage[]>(`/groups/${groupId}/messages`, { query: { limit: 100 } }),
    refetchInterval: visible ? 4_000 : false,
    refetchIntervalInBackground: false,
  });
}

export function useSendGroupMessage(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      api<GroupMessage>(`/groups/${groupId}/messages`, { method: 'POST', body: { content } }),
    onSuccess: (message) => {
      qc.setQueryData<GroupMessage[]>(['groups', groupId, 'messages'], (old) =>
        old && !old.some((m) => m.id === message.id) ? [...old, message] : old,
      );
      void qc.invalidateQueries({ queryKey: ['groups', groupId, 'messages'] });
      void qc.invalidateQueries({ queryKey: ['groups', 'me'] });
    },
  });
}

export function useSendGroupFile(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, content }: { file: File; content?: string }) => {
      const form = new FormData();
      if (content) form.append('content', content);
      form.append('file', file);
      return api<GroupMessage>(`/groups/${groupId}/messages/upload`, {
        method: 'POST',
        body: form,
      });
    },
    onSuccess: (message) => {
      qc.setQueryData<GroupMessage[]>(['groups', groupId, 'messages'], (old) =>
        old && !old.some((m) => m.id === message.id) ? [...old, message] : old,
      );
      void qc.invalidateQueries({ queryKey: ['groups', 'me'] });
    },
  });
}

export function useMarkGroupRead(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ ok: true }>(`/groups/${groupId}/read`, { method: 'POST', body: {} }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['groups', 'me'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useGroupMutations() {
  const qc = useQueryClient();
  const refresh = (id?: string) => {
    void qc.invalidateQueries({ queryKey: ['groups', 'me'] });
    void qc.invalidateQueries({ queryKey: ['groups', 'candidates'] });
    if (id) void qc.invalidateQueries({ queryKey: ['groups', id], exact: true });
  };
  const setDetail = (group: GroupDetail) => {
    qc.setQueryData(['groups', group.id], group);
    refresh(group.id);
  };

  return {
    create: useMutation({
      mutationFn: (body: { name: string; description?: string; memberIds: string[] }) =>
        api<GroupDetail>('/groups', { method: 'POST', body }),
      onSuccess: setDetail,
    }),
    update: useMutation({
      mutationFn: ({ id, ...body }: { id: string; name?: string; description?: string }) =>
        api<GroupDetail>(`/groups/${id}`, { method: 'PATCH', body }),
      onSuccess: setDetail,
    }),
    addMembers: useMutation({
      mutationFn: ({ id, userIds }: { id: string; userIds: string[] }) =>
        api<GroupDetail>(`/groups/${id}/members`, { method: 'POST', body: { userIds } }),
      onSuccess: setDetail,
    }),
    removeMember: useMutation({
      mutationFn: ({ id, userId }: { id: string; userId: string }) =>
        api<void>(`/groups/${id}/members/${userId}`, { method: 'DELETE' }),
      onSuccess: (_r, v) => refresh(v.id),
    }),
    remove: useMutation({
      mutationFn: (id: string) => api<void>(`/groups/${id}`, { method: 'DELETE' }),
      onSuccess: (_r, id) => {
        qc.removeQueries({ queryKey: ['groups', id] });
        refresh();
      },
    }),
  };
}

/* ── Ateliers ────────────────────────────────────────────────────────── */

export type WorkshopScope = 'upcoming' | 'past' | 'all';

export function useMyWorkshops(scope: WorkshopScope = 'upcoming') {
  return useQuery({
    queryKey: ['workshops', 'me', scope],
    queryFn: () => api<Workshop[]>('/workshops/me', { query: { scope } }),
    refetchInterval: 60_000,
  });
}

export function useGroupWorkshops(groupId: string | null, scope: WorkshopScope = 'upcoming') {
  return useQuery({
    queryKey: ['workshops', 'group', groupId, scope],
    queryFn: () => api<Workshop[]>(`/groups/${groupId}/workshops`, { query: { scope } }),
    enabled: !!groupId,
  });
}

export interface WorkshopInput {
  title: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  modality: Modality;
  location?: string;
  meetingUrl?: string;
}

function useInvalidateWorkshops() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['workshops'] });
    void qc.invalidateQueries({ queryKey: ['dashboard'] });
  };
}

export function useCreateWorkshop(groupId: string) {
  const invalidate = useInvalidateWorkshops();
  return useMutation({
    mutationFn: (input: WorkshopInput) =>
      api<Workshop>(`/groups/${groupId}/workshops`, { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
}

export function useWorkshopActions() {
  const invalidate = useInvalidateWorkshops();
  return {
    respond: useMutation({
      mutationFn: ({ id, going }: { id: string; going: boolean }) =>
        api<Workshop>(`/workshops/${id}/attendance`, { method: 'PUT', body: { going } }),
      onSuccess: invalidate,
    }),
    cancel: useMutation({
      mutationFn: (id: string) =>
        api<Workshop>(`/workshops/${id}/cancel`, { method: 'POST', body: {} }),
      onSuccess: invalidate,
    }),
  };
}
