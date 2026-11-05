'use client';

import { BadgeCheck, Clock3, FileText, FileUp, ShieldX, Undo2, X } from 'lucide-react';
import { useRef } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm';
import { formatFileSize } from '@/features/resources/files';
import { errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { VerificationRequest, VerificationRequestStatus } from '@/lib/types';
import {
  documentUrl,
  PROOF_ACCEPT,
  PROOF_MAX,
  PROOF_MAX_BYTES,
  useVerificationMutations,
} from './api';

const PROOF_EXT = /\.(pdf|png|jpe?g|webp)$/i;

export const statusLabels: Record<VerificationRequestStatus, string> = {
  PENDING: 'En cours d’examen',
  APPROVED: 'Acceptée',
  REJECTED: 'Refusée',
  WITHDRAWN: 'Retirée',
};

export function RequestStatusBadge({ status }: { status: VerificationRequestStatus }) {
  const tone =
    status === 'APPROVED'
      ? 'success'
      : status === 'REJECTED'
        ? 'danger'
        : status === 'PENDING'
          ? 'warning'
          : 'neutral';
  const Icon = status === 'APPROVED' ? BadgeCheck : status === 'REJECTED' ? ShieldX : Clock3;
  return (
    <Badge tone={tone}>
      <Icon aria-hidden />
      {statusLabels[status]}
    </Badge>
  );
}

function checkProof(file: File): string | null {
  if (!PROOF_EXT.test(file.name)) return `« ${file.name} » : PDF, JPEG, PNG ou WebP attendu.`;
  if (file.size > PROOF_MAX_BYTES) return `« ${file.name} » dépasse 10 Mo.`;
  if (file.size === 0) return `« ${file.name} » est vide.`;
  return null;
}

/** Choix des justificatifs (PDF ou image, 10 Mo, 3 au plus), avant l'envoi. */
export function ProofPicker({
  files,
  onChange,
  max = PROOF_MAX,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  max?: number;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="grid gap-2">
      <p className="text-sm font-semibold text-foreground">
        Justificatifs{' '}
        <span className="font-normal text-muted-foreground">(facultatif, {max} au plus)</span>
      </p>
      <p className="text-[13px] text-muted-foreground">
        Diplôme, attestation d’employeur, certificat de formation, contrat de mission… en PDF ou en
        photo. Ils ne sont visibles que de vous et de l’équipe d’administration.
      </p>
      {files.length > 0 && (
        <ul className="grid gap-1.5">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center gap-3 rounded-md border border-border bg-surface-muted/50 px-3 py-2"
            >
              <FileText className="size-4 shrink-0 text-teal-700" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-[14px]">{f.name}</span>
              <span className="text-[12px] text-muted-foreground">{formatFileSize(f.size)}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Retirer ${f.name}`}
                onClick={() => onChange(files.filter((_, j) => j !== i))}
              >
                <X aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={ref}
        type="file"
        accept={PROOF_ACCEPT}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          e.target.value = '';
          const ok: File[] = [];
          for (const f of picked) {
            const error = checkProof(f);
            if (error) toast.error(error);
            else ok.push(f);
          }
          const next = [...files, ...ok];
          if (next.length > max) toast.error(`${max} justificatifs au maximum.`);
          onChange(next.slice(0, max));
        }}
      />
      {files.length < max && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="justify-self-start"
          onClick={() => ref.current?.click()}
        >
          <FileUp aria-hidden />
          Ajouter un justificatif
        </Button>
      )}
    </div>
  );
}

/** Suivi d'une demande : statut, justificatifs, motif de décision ; retrait possible en attente. */
export function RequestSummary({ request }: { request: VerificationRequest }) {
  const { withdraw, addProof } = useVerificationMutations();
  const ref = useRef<HTMLInputElement>(null);
  const pending = request.status === 'PENDING';
  return (
    <div className="grid gap-3 rounded-md border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <RequestStatusBadge status={request.status} />
        <span className="text-[13px] text-muted-foreground">
          Envoyée le {formatDate(request.createdAt)}
          {request.decidedAt && <> · décision le {formatDate(request.decidedAt)}</>}
        </span>
      </div>
      {request.decisionNote && (
        <p
          className={
            request.status === 'REJECTED'
              ? 'rounded-md bg-danger-50 px-3 py-2 text-[14px] text-danger-700'
              : 'rounded-md bg-success-50 px-3 py-2 text-[14px] text-success-700'
          }
        >
          <span className="font-semibold">Message de l’équipe : </span>
          {request.decisionNote}
        </p>
      )}
      {request.documents.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {request.documents.map((d) => (
            <li key={d.id}>
              <a
                href={documentUrl(d.id)}
                download={d.fileName}
                className="inline-flex items-center gap-1.5 rounded-sm bg-surface-muted px-2 py-1 text-[13px] font-medium text-ink-800 hover:bg-ink-50"
              >
                <FileText className="size-3.5" aria-hidden />
                {d.fileName}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-muted-foreground">Aucun justificatif joint.</p>
      )}
      {pending && (
        <div className="flex flex-wrap gap-2">
          {request.documents.length < PROOF_MAX && (
            <>
              <input
                ref={ref}
                type="file"
                accept={PROOF_ACCEPT}
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  const error = checkProof(file);
                  if (error) return void toast.error(error);
                  addProof.mutate(
                    { requestId: request.id, file },
                    {
                      onSuccess: () => toast.success('Justificatif ajouté'),
                      onError: (err) => toast.error(errorMessage(err)),
                    },
                  );
                }}
              />
              <Button
                variant="secondary"
                size="sm"
                loading={addProof.isPending}
                onClick={() => ref.current?.click()}
              >
                <FileUp aria-hidden />
                Ajouter un justificatif
              </Button>
            </>
          )}
          <ConfirmButton
            title="Retirer votre demande ?"
            description="L’équipe ne l’examinera pas. Vous pourrez en envoyer une nouvelle plus tard."
            confirmLabel="Retirer la demande"
            loading={withdraw.isPending}
            onConfirm={() =>
              withdraw.mutate(request.id, {
                onSuccess: () => toast.success('Demande retirée'),
                onError: (err) => toast.error(errorMessage(err)),
              })
            }
          >
            <Undo2 aria-hidden />
            Retirer
          </ConfirmButton>
        </div>
      )}
    </div>
  );
}
