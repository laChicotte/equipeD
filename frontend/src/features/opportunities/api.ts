'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Opportunity, OpportunityType, Paginated } from '@/lib/types';

export interface OpportunityFilters {
  q?: string;
  type?: OpportunityType | '';
  domain?: string;
  remote?: boolean;
  page?: number;
}

export interface OpportunityInput {
  type: OpportunityType;
  title: string;
  organization: string;
  description: string;
  location?: string;
  isRemote?: boolean;
  url?: string;
  deadline?: string;
  domainId?: string;
}

export function useOpportunities(filters: OpportunityFilters) {
  return useQuery({
    queryKey: ['opportunities', 'list', filters],
    queryFn: () =>
      api<Paginated<Opportunity>>('/opportunities', {
        query: {
          q: filters.q,
          type: filters.type,
          domain: filters.domain,
          remote: filters.remote ? 'true' : undefined,
          page: filters.page ?? 1,
          pageSize: 12,
        },
      }),
    placeholderData: keepPreviousData,
  });
}

export function useMyOpportunities(enabled: boolean) {
  return useQuery({
    queryKey: ['opportunities', 'mine'],
    queryFn: () => api<Opportunity[]>('/opportunities/mine'),
    enabled,
  });
}

export function useOpportunityMutations() {
  const qc = useQueryClient();
  const invalidate = () => void qc.invalidateQueries({ queryKey: ['opportunities'] });
  return {
    create: useMutation({
      mutationFn: (input: OpportunityInput) =>
        api<Opportunity>('/opportunities', { method: 'POST', body: input }),
      onSuccess: invalidate,
    }),
    setArchived: useMutation({
      mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
        api<Opportunity>(`/opportunities/${id}`, { method: 'PATCH', body: { archived } }),
      onSuccess: invalidate,
    }),
  };
}
