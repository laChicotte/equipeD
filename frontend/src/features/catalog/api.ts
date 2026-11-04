'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  Domain,
  MentorCard,
  MentorDetail,
  Modality,
  Paginated,
  ProfileMe,
  Slot,
  Suggestions,
} from '@/lib/types';
import { meKey } from '@/features/auth/api';

export function useDomains() {
  return useQuery({
    queryKey: ['domains'],
    queryFn: () => api<Domain[]>('/domains'),
    staleTime: 5 * 60_000,
  });
}

export interface MentorFilters {
  q?: string;
  domain?: string;
  modality?: Modality | '';
  language?: string;
  available?: boolean;
  page?: number;
}

export function useMentors(filters: MentorFilters) {
  return useQuery({
    queryKey: ['mentors', filters],
    queryFn: ({ signal }) =>
      api<Paginated<MentorCard>>('/mentors', {
        query: {
          q: filters.q,
          domain: filters.domain,
          modality: filters.modality,
          language: filters.language,
          available: filters.available ? 'true' : undefined,
          page: filters.page ?? 1,
          pageSize: 12,
        },
        signal,
      }),
    placeholderData: keepPreviousData,
  });
}

export function useSuggestions(enabled: boolean) {
  return useQuery({
    queryKey: ['mentors', 'suggestions'],
    queryFn: () => api<Suggestions>('/mentors/suggestions'),
    enabled,
  });
}

export function useMentor(id: string) {
  return useQuery({
    queryKey: ['mentor', id],
    queryFn: () => api<MentorDetail>(`/mentors/${id}`),
  });
}

export function useMentorAvailability(id: string, enabled = true) {
  return useQuery({
    queryKey: ['mentor', id, 'availability'],
    queryFn: () => api<Slot[]>(`/mentors/${id}/availability`),
    enabled,
  });
}

/* ── Profil ─────────────────────────────────────────────────────────── */

export function useProfile(enabled = true) {
  return useQuery({
    queryKey: ['profile', 'me'],
    queryFn: () => api<ProfileMe>('/profile/me'),
    enabled,
  });
}

export interface MentorProfileInput {
  headline: string;
  bio: string;
  currentPosition?: string;
  organization?: string;
  yearsExperience: number;
  expertise: string[];
  languages: string[];
  modalities: Modality[];
  city?: string;
  domainIds: string[];
  sessionDurationMin: 30 | 45 | 60 | 90;
  maxMentees: number;
}

export interface MenteeProfileInput {
  situation: string;
  goalsSummary: string;
  desiredSkills: string[];
  preferredModality: Modality;
  city?: string;
  interestDomainIds: string[];
}

export function useSaveProfile(role: 'MENTOR' | 'MENTEE') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MentorProfileInput | MenteeProfileInput) =>
      api<ProfileMe>(role === 'MENTOR' ? '/profile/mentor' : '/profile/mentee', {
        method: 'PUT',
        body: input,
      }),
    onSuccess: (data) => {
      qc.setQueryData(['profile', 'me'], data);
      void qc.invalidateQueries({ queryKey: meKey });
      void qc.invalidateQueries({ queryKey: ['mentors'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
