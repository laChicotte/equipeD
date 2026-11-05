'use client';

import {
  ArrowUpRight,
  FileText,
  Lightbulb,
  PlayCircle,
  Trash2,
  Wrench,
  LayoutTemplate,
  Shapes,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { ConfirmButton } from '@/components/ui/confirm';
import { errorMessage } from '@/lib/api';
import { formatDate, fullName } from '@/lib/format';
import { resourceKindLabels } from '@/lib/labels';
import type { Me, Resource, ResourceKind } from '@/lib/types';
import { useDeleteResource } from './api';
import { isStaff } from '@/lib/utils';

const KIND_ICONS: Record<ResourceKind, LucideIcon> = {
  ARTICLE: FileText,
  VIDEO: PlayCircle,
  TEMPLATE: LayoutTemplate,
  TOOL: Wrench,
  ADVICE: Lightbulb,
  OTHER: Shapes,
};

export function ResourceCard({ resource, me }: { resource: Resource; me?: Me | null }) {
  const remove = useDeleteResource();
  const Icon = KIND_ICONS[resource.kind];
  const canDelete =
    !!me && (me.id === resource.author.id || (isStaff(me.role) && !resource.mentorshipId));

  return (
    <article className="flex h-full flex-col rounded-lg bg-surface p-5 ring-1 ring-border transition-shadow duration-300 hover:shadow-raised">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-teal-800">
          <span className="inline-flex size-9 items-center justify-center bg-ink-900 text-amber-400">
            <Icon className="size-4" aria-hidden />
          </span>
          {resourceKindLabels[resource.kind]}
        </span>
        {resource.domain && (
          <Badge tone="teal" className="max-w-[55%] truncate">
            {resource.domain.name}
          </Badge>
        )}
      </div>
      <h3 className="mt-5 font-display text-[19px] leading-snug font-semibold tracking-[-0.02em] text-ink-900">
        {resource.title}
      </h3>
      {resource.description && (
        <p className="mt-2 line-clamp-4 text-[15px] leading-relaxed whitespace-pre-line text-foreground">
          {resource.description}
        </p>
      )}
      <div className="mt-auto pt-6">
        <p className="text-[13px] text-muted-foreground">
          Par <span className="font-semibold text-ink-900">{fullName(resource.author)}</span> ·{' '}
          {formatDate(resource.createdAt)}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {resource.url ? (
            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-teal-700 hover:text-teal-800"
            >
              Ouvrir la ressource
              <ArrowUpRight className="size-4" aria-hidden />
              <span className="sr-only">(nouvel onglet)</span>
            </a>
          ) : (
            <span className="text-[13px] text-muted-foreground">Conseil rédigé</span>
          )}
          {canDelete && (
            <ConfirmButton
              title="Supprimer cette ressource ?"
              description={`« ${resource.title} » sera retirée définitivement.`}
              confirmLabel="Supprimer"
              loading={remove.isPending}
              onConfirm={() =>
                remove.mutate(resource.id, {
                  onSuccess: () => toast.success('Ressource supprimée'),
                  onError: (e) => toast.error(errorMessage(e)),
                })
              }
            >
              <Trash2 aria-hidden />
              Supprimer
            </ConfirmButton>
          )}
        </div>
      </div>
    </article>
  );
}
