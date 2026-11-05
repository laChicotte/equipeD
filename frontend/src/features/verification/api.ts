'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  AdminVerification,
  MyVerification,
  VerificationDocumentMeta,
  VerificationKind,
  VerificationRequest,
  VerificationRequestStatus,
} from '@/lib/types';

/** Justificatifs : PDF ou image, 10 Mo, 3 au plus (mêmes règles que l'API). */
export const PROOF_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp';
export const PROOF_MAX = 3;
export const PROOF_MAX_BYTES = 10 * 1024 * 1024;

export function useMyVerification(enabled = true) {
  return useQuery({
    queryKey: ['verification', 'me'],
    queryFn: () => api<MyVerification>('/verification/me'),
    enabled,
  });
}

async function uploadProofs(requestId: string, files: File[]) {
  const failed: string[] = [];
  for (const file of files) {
    const form = new FormData();
    form.append('file', file);
    try {
      await api<VerificationDocumentMeta>(`/verification/${requestId}/documents`, {
        method: 'POST',
        body: form,
      });
    } catch {
      failed.push(file.name);
    }
  }
  return failed;
}

export interface MentorVerificationInput {
  message: string;
  profileUrl?: string;
  files: File[];
}

export function useVerificationMutations() {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['verification'] });
    void qc.invalidateQueries({ queryKey: ['profile'] });
    void qc.invalidateQueries({ queryKey: ['auth', 'me'] });
  };
  return {
    /** Demande de vérification (mentor), puis envoi des justificatifs un par un. */
    requestVerification: useMutation({
      mutationFn: async ({ files, ...body }: MentorVerificationInput) => {
        const request = await api<VerificationRequest>('/verification/mentor', {
          method: 'POST',
          body,
        });
        return { request, failed: await uploadProofs(request.id, files) };
      },
      onSettled: refresh,
    }),
    /** Candidature d'un mentoré : profil mentor complet, motivation, justificatifs. */
    apply: useMutation({
      mutationFn: async ({
        files,
        ...body
      }: Record<string, unknown> & { message: string; files: File[] }) => {
        const request = await api<VerificationRequest>('/verification/mentor-application', {
          method: 'POST',
          body,
        });
        return { request, failed: await uploadProofs(request.id, files) };
      },
      onSettled: refresh,
    }),
    addProof: useMutation({
      mutationFn: ({ requestId, file }: { requestId: string; file: File }) =>
        uploadProofs(requestId, [file]).then((failed) => {
          if (failed.length) throw new Error('Le justificatif n’a pas pu être envoyé.');
        }),
      onSettled: refresh,
    }),
    withdraw: useMutation({
      mutationFn: (id: string) => api<{ ok: true }>(`/verification/${id}`, { method: 'DELETE' }),
      onSettled: refresh,
    }),
  };
}

export const documentUrl = (id: string) => `/api/v1/verification/documents/${id}`;

/* ── Équipe d'administration ─────────────────────────────────────────── */

export function useAdminVerifications(status: VerificationRequestStatus, kind?: VerificationKind) {
  return useQuery({
    queryKey: ['verification', 'admin', status, kind ?? 'all'],
    queryFn: () => api<AdminVerification[]>('/admin/verifications', { query: { status, kind } }),
  });
}

export function useDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      decision,
      note,
    }: {
      id: string;
      decision: 'approve' | 'reject';
      note?: string;
    }) =>
      api<{ ok: true }>(`/admin/verifications/${id}/${decision}`, {
        method: 'POST',
        body: note ? { note } : {},
      }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['verification'] });
      void qc.invalidateQueries({ queryKey: ['admin'] });
    },
  });
}
