'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Role, UserStatus } from '@/lib/types';

export interface DailyPoint {
  day: string;
  count: number;
}

export interface Metrics {
  generatedAt: string;
  users: {
    byRole: Partial<Record<Role, number>>;
    byStatus: Partial<Record<UserStatus, number>>;
    new7d: number;
  };
  mentors: { total: number; published: number; verified: number; toReview: number };
  requests: {
    byStatus: Partial<Record<'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED', number>>;
    acceptanceRate: number | null;
    medianResponseHours: number | null;
  };
  mentorships: Partial<Record<'ACTIVE' | 'COMPLETED' | 'CANCELLED', number>>;
  sessions: {
    byStatus: Partial<Record<'REQUESTED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED', number>>;
    completedHours: number;
  };
  feedback: { average: number | null; count: number };
  certificates: { valid: number; revoked: number };
  messages: { total: number; last7d: number };
  goals: { total: number; completed: number; inProgress: number };
  workshops: { held: number; upcoming: number; hours: number; participations: number };
  calls: { audio: number; video: number; audioMinutes: number; videoMinutes: number };
  domains: {
    id: string;
    name: string;
    isActive: boolean;
    mentors: number;
    menteeInterests: number;
    requests: number;
  }[];
  activity: {
    from: string;
    signups: DailyPoint[];
    requests: DailyPoint[];
    sessions: DailyPoint[];
    messages: DailyPoint[];
  };
}

export interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  status: UserStatus;
  avatarUpdatedAt: string | null;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  actorId: string | null;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string | null;
  summary: string;
  createdAt: string;
}

export interface AdminCertificate {
  code: string;
  mentorId: string;
  mentorName: string;
  menteeName: string;
  domainName: string;
  completedSessions: number;
  totalMinutes: number;
  averageRating: number | null;
  issuedAt: string;
  revokedAt: string | null;
  revokedReason: string | null;
}

export const auditActionLabels: Record<string, string> = {
  USER_SUSPENDED: 'Compte suspendu',
  USER_REACTIVATED: 'Compte réactivé',
  ROLE_CHANGED: 'Rôle modifié',
  MENTOR_MODERATED: 'Mentor modéré',
  DOMAIN_CREATED: 'Domaine créé',
  DOMAIN_UPDATED: 'Domaine modifié',
  CERTIFICATE_REVOKED: 'Certificat révoqué',
  RESOURCE_REMOVED: 'Ressource retirée',
  OPPORTUNITY_ARCHIVED: 'Opportunité archivée',
};

export function useMetrics() {
  return useQuery({
    queryKey: ['platform', 'metrics'],
    queryFn: () => api<Metrics>('/admin/metrics'),
    refetchInterval: 60_000,
  });
}

export function useTeam() {
  return useQuery({
    queryKey: ['platform', 'team'],
    queryFn: () => api<TeamMember[]>('/admin/team'),
  });
}

export function useAudit(action: string, page: number) {
  return useQuery({
    queryKey: ['platform', 'audit', action, page],
    queryFn: () =>
      api<{ items: AuditEntry[]; total: number; page: number; totalPages: number }>(
        '/admin/audit',
        {
          query: { action, page, pageSize: 30 },
        },
      ),
  });
}

export function useAdminCertificates() {
  return useQuery({
    queryKey: ['platform', 'certificates'],
    queryFn: () => api<AdminCertificate[]>('/admin/certificates'),
  });
}

export function usePlatformMutations() {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['platform'] });
    void qc.invalidateQueries({ queryKey: ['admin'] });
  };
  return {
    changeRole: useMutation({
      mutationFn: ({ id, role }: { id: string; role: 'ADMIN' | 'MENTOR' | 'MENTEE' }) =>
        api<{ id: string; role: Role }>(`/admin/users/${id}/role`, {
          method: 'PATCH',
          body: { role },
        }),
      onSuccess: refresh,
    }),
    revokeCertificate: useMutation({
      mutationFn: ({ code, reason }: { code: string; reason: string }) =>
        api<unknown>(`/admin/certificates/${code}/revoke`, {
          method: 'POST',
          body: { reason },
        }),
      onSuccess: () => {
        refresh();
        void qc.invalidateQueries({ queryKey: ['certificates'] });
        void qc.invalidateQueries({ queryKey: ['mentors'] });
      },
    }),
  };
}
