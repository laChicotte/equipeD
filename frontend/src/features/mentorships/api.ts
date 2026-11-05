'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { poll } from '@/lib/data-saver';
import type { Dashboard, Goal, GuidedPath, Message, MentorshipSummary } from '@/lib/types';

export function useDashboard(enabled = true) {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<Dashboard>('/dashboard/me'),
    refetchInterval: () => poll(30_000),
    enabled,
  });
}

export function useMentorships(enabled = true) {
  return useQuery({
    queryKey: ['mentorships', 'me'],
    queryFn: () => api<MentorshipSummary[]>('/mentorships/me'),
    enabled,
    refetchInterval: () => poll(30_000),
  });
}

export function useMentorship(id: string) {
  return useQuery({
    queryKey: ['mentorships', id],
    queryFn: () => api<MentorshipSummary>(`/mentorships/${id}`),
  });
}

/* ── Messagerie : polling maîtrisé, en pause quand l'onglet est caché ─── */

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

export function useMessages(mentorshipId: string) {
  const visible = usePageVisible();
  return useQuery({
    queryKey: ['mentorships', mentorshipId, 'messages'],
    queryFn: () =>
      api<Message[]>(`/mentorships/${mentorshipId}/messages`, { query: { limit: 100 } }),
    refetchInterval: () => (visible ? poll(4_000) : false),
    refetchIntervalInBackground: false,
  });
}

export function useSendMessage(mentorshipId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { content: string; clientId: string }) =>
      api<Message>(`/mentorships/${mentorshipId}/messages`, { method: 'POST', body }),
    onSuccess: (message) => {
      qc.setQueryData<Message[]>(['mentorships', mentorshipId, 'messages'], (old) =>
        old && !old.some((m) => m.id === message.id) ? [...old, message] : old,
      );
      void qc.invalidateQueries({ queryKey: ['mentorships', mentorshipId, 'messages'] });
      void qc.invalidateQueries({ queryKey: ['mentorships', 'me'] });
    },
  });
}

/** Envoi d'une pièce jointe (document ou photo) avec légende facultative. */
export function useSendFileMessage(mentorshipId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, content }: { file: File; content?: string }) => {
      const form = new FormData();
      if (content) form.append('content', content);
      form.append('file', file);
      return api<Message>(`/mentorships/${mentorshipId}/messages/upload`, {
        method: 'POST',
        body: form,
      });
    },
    onSuccess: (message) => {
      qc.setQueryData<Message[]>(['mentorships', mentorshipId, 'messages'], (old) =>
        old && !old.some((m) => m.id === message.id) ? [...old, message] : old,
      );
      void qc.invalidateQueries({ queryKey: ['mentorships', 'me'] });
    },
  });
}

export function useMarkRead(mentorshipId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ updated: number }>(`/mentorships/${mentorshipId}/messages/read`, {
        method: 'POST',
        body: {},
      }),
    onSuccess: (res) => {
      if (res.updated > 0) {
        void qc.invalidateQueries({ queryKey: ['mentorships'] });
        void qc.invalidateQueries({ queryKey: ['dashboard'] });
      }
    },
  });
}

/* ── Objectifs et jalons ─────────────────────────────────────────────── */

export function useGoals(mentorshipId: string) {
  return useQuery({
    queryKey: ['mentorships', mentorshipId, 'goals'],
    queryFn: () => api<Goal[]>(`/mentorships/${mentorshipId}/goals`),
  });
}

export interface GoalPatch {
  title?: string;
  description?: string;
  status?: Goal['status'];
  progress?: number;
  dueDate?: string | null;
  mentorFeedback?: string;
}

export function useGoalMutations(mentorshipId: string) {
  const qc = useQueryClient();
  const key = ['mentorships', mentorshipId, 'goals'];
  const replace = (goal: Goal) => {
    qc.setQueryData<Goal[]>(key, (old) => old?.map((g) => (g.id === goal.id ? goal : g)));
    void qc.invalidateQueries({ queryKey: ['mentorships', 'me'] });
    void qc.invalidateQueries({ queryKey: ['mentorships', mentorshipId], exact: true });
    void qc.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const refetch = () => {
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ['mentorships', 'me'] });
    void qc.invalidateQueries({ queryKey: ['mentorships', mentorshipId], exact: true });
    void qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  return {
    create: useMutation({
      mutationFn: (input: {
        title: string;
        description?: string;
        dueDate?: string;
        milestones?: string[];
      }) => api<Goal>(`/mentorships/${mentorshipId}/goals`, { method: 'POST', body: input }),
      onSuccess: refetch,
    }),
    update: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: GoalPatch }) =>
        api<Goal>(`/goals/${id}`, { method: 'PATCH', body: patch }),
      onSuccess: replace,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api<unknown>(`/goals/${id}`, { method: 'DELETE' }),
      onSuccess: refetch,
    }),
    addMilestone: useMutation({
      mutationFn: ({ goalId, title }: { goalId: string; title: string }) =>
        api<Goal>(`/goals/${goalId}/milestones`, { method: 'POST', body: { title } }),
      onSuccess: replace,
    }),
    toggleMilestone: useMutation({
      mutationFn: ({ id, isDone }: { id: string; isDone: boolean }) =>
        api<Goal>(`/milestones/${id}`, { method: 'PATCH', body: { isDone } }),
      onSuccess: replace,
    }),
    removeMilestone: useMutation({
      mutationFn: (id: string) => api<Goal>(`/milestones/${id}`, { method: 'DELETE' }),
      onSuccess: replace,
    }),
  };
}

export function useCompleteMentorship(mentorshipId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (note?: string) =>
      api<MentorshipSummary>(`/mentorships/${mentorshipId}/complete`, {
        method: 'POST',
        body: { note },
      }),
    onSuccess: (data) => {
      qc.setQueryData(['mentorships', mentorshipId], data);
      void qc.invalidateQueries({ queryKey: ['mentorships'] });
      void qc.invalidateQueries({ queryKey: ['sessions'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/* ── Parcours guidés ─────────────────────────────────────────────────── */

export function useGuidedPaths(enabled = true) {
  return useQuery({
    queryKey: ['guided-paths'],
    queryFn: () => api<GuidedPath[]>('/guided-paths'),
    staleTime: 10 * 60_000,
    enabled,
  });
}

export function useApplyGuidedPath(mentorshipId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pathKey, goalKeys }: { pathKey: string; goalKeys: string[] }) =>
      api<{ created: Goal[]; skipped: string[] }>(
        `/mentorships/${mentorshipId}/guided-paths/${pathKey}`,
        { method: 'POST', body: { goalKeys } },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['mentorships', mentorshipId, 'goals'] });
      void qc.invalidateQueries({ queryKey: ['mentorships', 'me'] });
      void qc.invalidateQueries({ queryKey: ['mentorships', mentorshipId], exact: true });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
