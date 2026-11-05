'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Certificate, CertificateVerification } from '@/lib/types';

/** Certificats valides affichés sur la fiche publique d'un mentor. */
export function useMentorCertificates(mentorId: string) {
  return useQuery({
    queryKey: ['certificates', 'mentor', mentorId],
    queryFn: () => api<Certificate[]>(`/mentors/${mentorId}/certificates`),
  });
}

/** Vérification publique d'un certificat par son code. */
export function useCertificate(code: string) {
  return useQuery({
    queryKey: ['certificates', 'code', code],
    queryFn: () => api<CertificateVerification>(`/certificates/${encodeURIComponent(code)}`),
    retry: false,
  });
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}
