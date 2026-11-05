'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  AdminDomain,
  MentorshipRequestStatus,
  Role,
  SessionStatus,
  UserStatus,
  VerificationStatus,
} from '@/lib/types';

export interface AdminOverview {
  users: number;
  mentors: number;
  mentees: number;
  pendingVerification: number;
  activeMentorships: number;
  requestsByStatus: Partial<Record<MentorshipRequestStatus, number>>;
  sessionsByStatus: Partial<Record<SessionStatus, number>>;
}

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
  onboardedAt: string | null;
  mentorProfile: {
    headline: string;
    verificationStatus: VerificationStatus;
    isPublished: boolean;
    city: string | null;
  } | null;
}

export function useAdminOverview() {
  return useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: () => api<AdminOverview>('/admin/overview'),
  });
}

export function useAdminUsers(role?: Role) {
  return useQuery({
    queryKey: ['admin', 'users', role ?? 'all'],
    queryFn: () => api<AdminUser[]>('/admin/users', { query: { role } }),
  });
}

export function useAdminMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['admin'] });
    void qc.invalidateQueries({ queryKey: ['mentors'] });
  };
  return {
    setStatus: useMutation({
      mutationFn: ({ id, status }: { id: string; status: UserStatus }) =>
        api<unknown>(`/admin/users/${id}/status`, { method: 'PATCH', body: { status } }),
      onSuccess: invalidate,
    }),
    /** `id` = identifiant utilisateur du mentor. */
    updateMentor: useMutation({
      mutationFn: ({
        id,
        patch,
      }: {
        id: string;
        patch: { verificationStatus?: VerificationStatus; isPublished?: boolean };
      }) => api<unknown>(`/admin/mentors/${id}`, { method: 'PATCH', body: patch }),
      onSuccess: invalidate,
    }),
  };
}

export interface DomainInput {
  slug?: string;
  name?: string;
  description?: string;
  icon?: string;
  topics?: string[];
  isActive?: boolean;
}

export function useAdminDomains() {
  return useQuery({
    queryKey: ['admin', 'domains'],
    queryFn: () => api<AdminDomain[]>('/admin/domains'),
  });
}

export function useAdminDomainMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'domains'] });
    void qc.invalidateQueries({ queryKey: ['domains'] });
  };
  return {
    create: useMutation({
      mutationFn: (input: DomainInput) =>
        api<AdminDomain>('/admin/domains', { method: 'POST', body: input }),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: DomainInput }) =>
        api<AdminDomain>(`/admin/domains/${id}`, { method: 'PATCH', body: patch }),
      onSuccess: invalidate,
    }),
  };
}
