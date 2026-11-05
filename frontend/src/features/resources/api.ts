'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Paginated, Resource, ResourceKind } from '@/lib/types';

export interface ResourceInput {
  title: string;
  description?: string;
  url?: string;
  kind?: ResourceKind;
  domainId?: string;
  /** Document joint : envoyé en multipart vers la route /upload. */
  file?: File;
}

export interface LibraryFilters {
  q?: string;
  domain?: string;
  kind?: ResourceKind | '';
  page?: number;
}

export function useLibrary(filters: LibraryFilters) {
  return useQuery({
    queryKey: ['resources', 'library', filters],
    queryFn: () =>
      api<Paginated<Resource>>('/resources', {
        query: {
          q: filters.q,
          domain: filters.domain,
          kind: filters.kind,
          page: filters.page ?? 1,
          pageSize: 12,
        },
      }),
    placeholderData: keepPreviousData,
  });
}

export function useMentorshipResources(mentorshipId: string) {
  return useQuery({
    queryKey: ['resources', 'mentorship', mentorshipId],
    queryFn: () => api<Resource[]>(`/mentorships/${mentorshipId}/resources`),
  });
}

/** Publication dans la bibliothèque (sans mentorat) ou partage privé dans un mentorat. */
export function useCreateResource(mentorshipId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, ...input }: ResourceInput) => {
      const base = mentorshipId ? `/mentorships/${mentorshipId}/resources` : '/resources';
      if (!file) return api<Resource>(base, { method: 'POST', body: input });
      const form = new FormData();
      for (const [key, value] of Object.entries(input)) {
        if (value !== undefined && value !== '') form.append(key, value);
      }
      form.append('file', file);
      return api<Resource>(`${base}/upload`, { method: 'POST', body: form });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['resources'] }),
  });
}

export function useDeleteResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<unknown>(`/resources/${id}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['resources'] }),
  });
}
