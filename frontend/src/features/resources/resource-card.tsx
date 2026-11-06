'use client';

import {
  ArrowUpRight,
  BookOpen,
  Compass,
  Download,
  FileText,
  Headphones,
  Hourglass,
  LayoutTemplate,
  Lightbulb,
  PlayCircle,
  Shapes,
  ShieldX,
  Trash2,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { ConfirmButton } from '@/components/ui/confirm';
import { errorMessage } from '@/lib/api';
import { formatDate, fullName } from '@/lib/format';
import { resourceKindLabels, resourceLicensePublicLabels } from '@/lib/labels';
import type { Me, Resource, ResourceKind } from '@/lib/types';
import { cn, isStaff } from '@/lib/utils';
import { resourceCoverUrl, useDeleteResource } from './api';
import { fileKindLabel, formatFileSize, resourceFileUrl } from './files';

export const KIND_ICONS: Record<ResourceKind, LucideIcon> = {
  BOOK: BookOpen,
  GUIDE: Compass,
  PODCAST: Headphones,
  ARTICLE: FileText,
  VIDEO: PlayCircle,
  TEMPLATE: LayoutTemplate,
  TOOL: Wrench,
  ADVICE: Lightbulb,
  OTHER: Shapes,
};

/** Couverture : l'image envoyée, sinon une couverture générée (type et titre). */
export function ResourceCover({
  resource,
  className,
}: {
  resource: Pick<Resource, 'id' | 'cover' | 'kind' | 'title' | 'workAuthor'>;
  className?: string;
}) {
  const url = resourceCoverUrl(resource);
  const Icon = KIND_ICONS[resource.kind];
  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden bg-surface-muted',
        className,
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-[88%] w-auto max-w-[80%] rounded-[3px] object-contain shadow-[0_10px_24px_-8px_rgba(11,32,26,0.45)] transition-transform duration-300 group-hover:-translate-y-1"
        />
      ) : (
        <div className="relative flex h-[88%] aspect-[3/4] flex-col justify-between overflow-hidden rounded-[3px] bg-ink-900 p-3 text-white shadow-[0_10px_24px_-8px_rgba(11,32,26,0.45)] transition-transform duration-300 group-hover:-translate-y-1">
          <div className="pattern-kente absolute inset-0 opacity-[0.12]" aria-hidden />
          <Icon className="relative size-5 text-amber-400" aria-hidden />
          <div className="relative">
            <p className="line-clamp-4 font-display text-[13px] leading-tight font-semibold">
              {resource.title}
            </p>
            {resource.workAuthor && (
              <p className="mt-1 truncate text-[10px] text-ink-100/80">{resource.workAuthor}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ResourceCard({
  resource,
  me,
  showStatus = false,
}: {
  resource: Resource;
  me?: Me | null;
  /** Mes publications : statut de validation et motif d'un refus. */
  showStatus?: boolean;
}) {
  const remove = useDeleteResource();
  const Icon = KIND_ICONS[resource.kind];
  const canDelete =
    !!me && (me.id === resource.author.id || (isStaff(me.role) && !resource.mentorshipId));
  const isLibrary = !resource.mentorshipId;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl bg-surface ring-1 ring-border transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-raised">
      {isLibrary && <ResourceCover resource={resource} className="h-52" />}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-teal-800">
            <Icon className="size-4" aria-hidden />
            {resourceKindLabels[resource.kind]}
            {resource.language && (
              <span className="font-normal text-muted-foreground">· {resource.language}</span>
            )}
          </span>
          {resource.domain && (
            <Badge tone="teal" className="max-w-[55%] truncate">
              {resource.domain.name}
            </Badge>
          )}
        </div>
        <h3 className="mt-3 font-display text-[18px] leading-snug font-semibold tracking-[-0.02em] text-ink-900">
          {resource.title}
        </h3>
        {resource.workAuthor && (
          <p className="mt-0.5 text-[14px] text-muted-foreground">de {resource.workAuthor}</p>
        )}
        {resource.description && (
          <p className="mt-2 line-clamp-3 text-[14px] leading-relaxed whitespace-pre-line text-foreground">
            {resource.description}
          </p>
        )}

        {showStatus && resource.status === 'PENDING' && (
          <p className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-[13px] text-[#7a4a0f]">
            <Hourglass className="mt-0.5 size-4 shrink-0" aria-hidden />
            En attente de validation par l’équipe : elle sera visible de tous une fois acceptée.
          </p>
        )}
        {showStatus && resource.status === 'REJECTED' && (
          <p className="mt-3 flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2 text-[13px] text-danger-700">
            <ShieldX className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Non publiée
              {resource.reviewNote ? ` : ${resource.reviewNote}` : '.'}
            </span>
          </p>
        )}

        <div className="mt-auto pt-5">
          <p className="text-[13px] text-muted-foreground">
            Partagée par{' '}
            <span className="font-semibold text-ink-900">{fullName(resource.author)}</span> ·{' '}
            {formatDate(resource.createdAt)}
            {isLibrary && resource.downloadCount > 0 && (
              <>
                {' '}
                · {resource.downloadCount} téléchargement{resource.downloadCount > 1 ? 's' : ''}
              </>
            )}
          </p>
          {resource.license && (
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {resourceLicensePublicLabels[resource.license]}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            {resource.file ? (
              <a
                href={resourceFileUrl(resource.id)}
                download={resource.file.fileName}
                className="inline-flex min-w-0 items-center gap-2 rounded-full bg-ink-900 px-4 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-ink-800"
              >
                <Download className="size-4 shrink-0" aria-hidden />
                <span>Télécharger</span>
                <span className="shrink-0 text-[12px] font-medium text-ink-100">
                  {fileKindLabel(resource.file.fileName)} · {formatFileSize(resource.file.size)}
                </span>
              </a>
            ) : resource.url ? (
              <a
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-teal-700 hover:text-teal-800"
              >
                {resource.kind === 'PODCAST' ? 'Écouter' : 'Ouvrir la ressource'}
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
      </div>
    </article>
  );
}
