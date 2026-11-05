'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useOnline } from '@/lib/connectivity';

export interface OrientationResult {
  summary: string;
  domains: { id: string; slug: string; name: string; reason: string }[];
  skills: string[];
}

export interface MentorExplanation {
  score: number;
  reasons: string[];
  text: string | null;
  source: 'ai' | 'rules';
}

export interface PathProposal {
  goals: { title: string; description: string; milestones: string[] }[];
}

/** Disponible seulement avec une clé côté serveur et du réseau : sinon rien n'est proposé. */
export function useAiAvailable(enabled = true) {
  const online = useOnline();
  const status = useQuery({
    queryKey: ['ai', 'status'],
    queryFn: () =>
      api<{ enabled: boolean; remainingToday: number; assistantRemainingToday?: number }>(
        '/ai/status',
      ),
    staleTime: 5 * 60_000,
    enabled,
  });
  return online && status.data?.enabled === true;
}

export function useOrientation() {
  return useMutation({
    mutationFn: (need: string) =>
      api<OrientationResult>('/ai/orientation', { method: 'POST', body: { need } }),
  });
}

export function useMentorExplanation(mentorId: string) {
  return useMutation({
    mutationFn: () =>
      api<MentorExplanation>(`/ai/mentors/${mentorId}/explanation`, { method: 'POST', body: {} }),
  });
}

export function usePathProposal(mentorshipId: string) {
  return useMutation({
    mutationFn: (focus: string) =>
      api<PathProposal>(`/ai/mentorships/${mentorshipId}/path-proposal`, {
        method: 'POST',
        body: focus ? { focus } : {},
      }),
  });
}

export interface AssistantTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantAnswer {
  answer: string;
  links: { href: string; label: string }[];
}

/** Questions sur le fonctionnement de la plateforme ; le serveur ne garde pas la conversation. */
export function useAssistant() {
  return useMutation({
    mutationFn: (body: { question: string; history: AssistantTurn[]; page: string }) =>
      api<AssistantAnswer>('/ai/assistant', { method: 'POST', body }),
  });
}
