'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  Paginated,
  Resource,
  ResourceDetail,
  ResourceReview,
  ResourceThread,
  ResourceKind,
  ResourceLicense,
  ResourceStatus,
} from '@/lib/types';

export interface ResourceInput {
  title: string;
  description?: string;
  url?: string;
  kind?: ResourceKind;
  domainId?: string;
  workAuthor?: string;
  language?: string;
  license?: ResourceLicense;
  rightsConfirmed?: boolean;
  /** Document joint : envoyé en multipart vers la route /upload. */
  file?: File;
  /** Couverture (image déjà réduite par le navigateur). */
  cover?: Blob;
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
    mutationFn: ({ file, cover, ...input }: ResourceInput) => {
      const base = mentorshipId ? `/mentorships/${mentorshipId}/resources` : '/resources';
      if (!file && !cover) return api<Resource>(base, { method: 'POST', body: input });
      const form = new FormData();
      for (const [key, value] of Object.entries(input)) {
        if (value !== undefined && value !== '') form.append(key, String(value));
      }
      if (file) form.append('file', file);
      if (cover && !mentorshipId) form.append('cover', cover, 'couverture.jpg');
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

/** Mes publications dans la bibliothèque (avec leur statut de validation). */
export function useMyResources(enabled: boolean) {
  return useQuery({
    queryKey: ['resources', 'mine'],
    queryFn: () => api<Resource[]>('/resources/mine'),
    enabled,
  });
}

/** File de validation de l'équipe. */
export function useResourceReview(status: ResourceStatus, page: number) {
  return useQuery({
    queryKey: ['resources', 'review', status, page],
    queryFn: () =>
      api<Paginated<Resource & { rightsConfirmed: boolean }>>('/admin/resources', {
        query: { status, page, pageSize: 10 },
      }),
    placeholderData: keepPreviousData,
  });
}

export function useResourceDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approve, note }: { id: string; approve: boolean; note?: string }) =>
      api<Resource>(`/admin/resources/${id}/${approve ? 'approve' : 'reject'}`, {
        method: 'POST',
        body: approve ? {} : { note },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['resources'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'overview'] });
    },
  });
}

export const resourceCoverUrl = (r: Pick<Resource, 'id' | 'cover'>) =>
  r.cover ? `/api/v1/resources/${r.id}/cover?v=${encodeURIComponent(r.cover.createdAt)}` : null;

export const resourceKey = (id: string) => ['resources', 'detail', id] as const;

export function useResource(id: string) {
  return useQuery({
    queryKey: resourceKey(id),
    queryFn: () => api<ResourceDetail>(`/resources/${id}`),
  });
}

export function useResourceReviews(id: string) {
  return useQuery({
    queryKey: ['resources', 'reviews', id],
    queryFn: () => api<ResourceReview[]>(`/resources/${id}/reviews`),
  });
}

export function useResourceComments(id: string) {
  return useQuery({
    queryKey: ['resources', 'comments', id],
    queryFn: () => api<ResourceThread[]>(`/resources/${id}/comments`),
  });
}

export function useRateResource(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { rating: number; comment?: string }) =>
      api<ResourceDetail>(`/resources/${id}/review`, { method: 'PUT', body }),
    onSuccess: (detail) => {
      qc.setQueryData(resourceKey(id), detail);
      void qc.invalidateQueries({ queryKey: ['resources', 'reviews', id] });
      void qc.invalidateQueries({ queryKey: ['resources', 'library'] });
    },
  });
}

export function useResourceDiscussion(id: string) {
  const qc = useQueryClient();
  const refresh = () => void qc.invalidateQueries({ queryKey: ['resources', 'comments', id] });
  return {
    post: useMutation({
      mutationFn: (body: { content: string; parentId?: string }) =>
        api(`/resources/${id}/comments`, { method: 'POST', body }),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (commentId: string) =>
        api(`/resource-comments/${commentId}`, { method: 'DELETE' }),
      onSuccess: refresh,
    }),
  };
}

export function useSetCover(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cover: Blob | null) => {
      const form = new FormData();
      if (cover) form.append('cover', cover, 'couverture.jpg');
      return api(`/resources/${id}/cover`, { method: 'PUT', body: form });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['resources'] }),
  });
}

export const resourceViewUrl = (id: string) => `/api/v1/resources/${id}/view`;

/** Lecture dans la plateforme : PDF et images. */
export const isReadable = (file: { mimeType: string } | null) =>
  !!file && (file.mimeType === 'application/pdf' || file.mimeType.startsWith('image/'));
