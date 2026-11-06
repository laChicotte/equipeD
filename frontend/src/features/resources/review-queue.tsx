'use client';

import { Check, Download, FileCheck2, ShieldCheck, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Pagination } from '@/components/admin/data-table';
import { Segmented } from '@/components/admin/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/misc';
import { errorMessage } from '@/lib/api';
import { formatDate, fullName } from '@/lib/format';
import { resourceKindLabels, resourceLicenseLabels } from '@/lib/labels';
import type { Resource, ResourceStatus } from '@/lib/types';
import { useResourceDecision, useResourceReview } from './api';
import { fileKindLabel, formatFileSize, resourceFileUrl } from './files';
import { ResourceCover } from './resource-card';

function RejectDialog({ resource, onClose }: { resource: Resource; onClose: () => void }) {
  const decide = useResourceDecision();
  const [note, setNote] = useState('');
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={`Refuser « ${resource.title} » ?`}
        description={`${resource.author.firstName} reçoit votre motif et pourra proposer une nouvelle version.`}
      >
        <Field
          label="Motif du refus"
          hint="Entre 10 et 500 caractères."
          counter={{ value: note.length, min: 10, max: 500 }}
        >
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="Ex. : merci de joindre l’autorisation écrite de l’éditeur."
          />
        </Field>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant="danger"
            disabled={note.trim().length < 10}
            loading={decide.isPending}
            onClick={() =>
              decide.mutate(
                { id: resource.id, approve: false, note: note.trim() },
                {
                  onSuccess: () => {
                    toast.success('Ressource refusée, l’auteur est prévenu');
                    onClose();
                  },
                  onError: (e) => toast.error(errorMessage(e)),
                },
              )
            }
          >
            Refuser
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** File de validation des documents proposés par les mentors pour la bibliothèque. */
export function ResourceReviewQueue() {
  const [status, setStatus] = useState<ResourceStatus>('PENDING');
  const [page, setPage] = useState(1);
  const list = useResourceReview(status, page);
  const decide = useResourceDecision();
  const [rejecting, setRejecting] = useState<Resource | null>(null);

  return (
    <section aria-labelledby="titre-validation" className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="titre-validation" className="font-display text-[16px] font-semibold text-ink-900">
            Documents à valider
          </h2>
          <p className="text-[13px] text-muted-foreground">
            Vérifiez les droits de diffusion et la qualité avant la publication.
          </p>
        </div>
        <Segmented
          label="Statut"
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={[
            { value: 'PENDING', label: 'En attente' },
            { value: 'PUBLISHED', label: 'Publiés' },
            { value: 'REJECTED', label: 'Refusés' },
          ]}
        />
      </div>

      <div className="overflow-hidden rounded-xl bg-surface shadow-card ring-1 ring-border/70">
        {list.isPending ? (
          <div className="grid gap-3 p-5">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        ) : !list.data || list.data.items.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <span className="inline-flex size-11 items-center justify-center rounded-full bg-success-50 text-success-700">
              <FileCheck2 className="size-5" aria-hidden />
            </span>
            <p className="mt-3 text-[14px] text-muted-foreground">
              {status === 'PENDING'
                ? 'Aucun document en attente : tout est à jour.'
                : 'Aucun document dans cette catégorie.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {list.data.items.map((r) => (
              <li key={r.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
                <ResourceCover resource={r} className="h-32 w-full shrink-0 rounded-lg sm:w-28" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{resourceKindLabels[r.kind]}</Badge>
                    {r.domain && <Badge tone="teal">{r.domain.name}</Badge>}
                    {r.language && (
                      <span className="text-[12px] text-muted-foreground">{r.language}</span>
                    )}
                  </div>
                  <p className="mt-2 font-display text-[16px] font-semibold text-ink-900">
                    {r.title}
                  </p>
                  {r.workAuthor && (
                    <p className="text-[13px] text-muted-foreground">de {r.workAuthor}</p>
                  )}
                  {r.description && (
                    <p className="mt-1.5 line-clamp-3 text-[14px] whitespace-pre-line text-foreground">
                      {r.description}
                    </p>
                  )}
                  <p className="mt-2 text-[12px] text-muted-foreground">
                    Proposé par{' '}
                    <span className="font-semibold text-ink-900">{fullName(r.author)}</span> le{' '}
                    {formatDate(r.createdAt)}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-[12px] text-ink-900">
                    <ShieldCheck className="size-3.5 text-success-700" aria-hidden />
                    {r.license ? resourceLicenseLabels[r.license] : 'Licence non précisée'}
                    {r.rightsConfirmed && ' · droits de diffusion confirmés par l’auteur'}
                  </p>
                  {r.status === 'REJECTED' && r.reviewNote && (
                    <p className="mt-2 rounded-md bg-danger-50 px-3 py-2 text-[13px] text-danger-700">
                      Motif : {r.reviewNote}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-row flex-wrap items-start gap-2 sm:w-44 sm:flex-col sm:items-stretch">
                  {r.file && (
                    <Button asChild variant="secondary" size="sm">
                      <a href={resourceFileUrl(r.id)} download={r.file.fileName}>
                        <Download aria-hidden />
                        {fileKindLabel(r.file.fileName)} · {formatFileSize(r.file.size)}
                      </a>
                    </Button>
                  )}
                  {r.status === 'PENDING' && (
                    <>
                      <Button
                        size="sm"
                        loading={decide.isPending && decide.variables?.id === r.id}
                        onClick={() =>
                          decide.mutate(
                            { id: r.id, approve: true },
                            {
                              onSuccess: () =>
                                toast.success('Ressource publiée dans la bibliothèque'),
                              onError: (e) => toast.error(errorMessage(e)),
                            },
                          )
                        }
                      >
                        <Check aria-hidden />
                        Publier
                      </Button>
                      <Button size="sm" variant="danger-ghost" onClick={() => setRejecting(r)}>
                        <X aria-hidden />
                        Refuser
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {list.data && list.data.total > list.data.pageSize && (
          <Pagination
            page={list.data.page}
            totalPages={list.data.totalPages}
            total={list.data.total}
            pageSize={list.data.pageSize}
            onPageChange={setPage}
          />
        )}
      </div>
      {rejecting && <RejectDialog resource={rejecting} onClose={() => setRejecting(null)} />}
    </section>
  );
}
