'use client';

import {
  AlertTriangle,
  BadgeCheck,
  ExternalLink,
  Eye,
  FileText,
  GraduationCap,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { AccessDenied, ErrorState, PageHeader } from '@/components/feedback/states';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { NativeSelect, Textarea } from '@/components/ui/input';
import { useMe } from '@/features/auth/api';
import { errorMessage } from '@/lib/api';
import { formatDate, fullName, plural } from '@/lib/format';
import { modalityLabels } from '@/lib/labels';
import type { AdminVerification, VerificationKind, VerificationRequestStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { DataTable } from '@/components/admin/data-table';
import { Segmented } from '@/components/admin/ui';
import { documentUrl, useAdminVerifications, useDecision } from './api';
import { RequestStatusBadge } from './parts';

const TABS: { value: VerificationRequestStatus; label: string }[] = [
  { value: 'PENDING', label: 'En attente' },
  { value: 'APPROVED', label: 'Acceptées' },
  { value: 'REJECTED', label: 'Refusées' },
];

const kindLabel: Record<VerificationKind, string> = {
  MENTOR_APPLICATION: 'Candidature mentor',
  MENTOR_VERIFICATION: 'Vérification de profil',
};

function DecisionDialog({
  request,
  decision,
  onClose,
}: {
  request: AdminVerification;
  decision: 'approve' | 'reject';
  onClose: () => void;
}) {
  const decide = useDecision();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();
  const approve = decision === 'approve';
  const application = request.kind === 'MENTOR_APPLICATION';
  const name = fullName(request.user);

  const submit = () => {
    if (!approve && note.trim().length < 10) {
      setError('Expliquez le refus (10 caractères au moins) : la personne le recevra.');
      return;
    }
    decide.mutate(
      { id: request.id, decision, note: note.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(
            approve
              ? application
                ? `${name} est désormais mentor`
                : `Profil de ${name} vérifié`
              : 'Demande refusée, la personne est prévenue',
          );
          onClose();
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={
          approve
            ? application
              ? `Accepter la candidature de ${name} ?`
              : `Vérifier le profil de ${name} ?`
            : `Refuser la demande de ${name} ?`
        }
        description={
          approve
            ? application
              ? 'Son compte devient un compte mentor : son profil est publié avec le badge « Profil vérifié ». Ses demandes de mentorat en attente sont annulées.'
              : 'Le badge « Profil vérifié » apparaîtra sur sa fiche et dans l’annuaire.'
            : 'La personne reçoit votre motif et pourra envoyer une nouvelle demande.'
        }
      >
        <Field
          label={approve ? 'Message à la personne' : 'Motif du refus'}
          optional={approve}
          error={error}
          counter={{ value: note.length, max: 1000 }}
        >
          <Textarea
            rows={4}
            value={note}
            maxLength={1000}
            onChange={(e) => {
              setNote(e.target.value);
              setError(undefined);
            }}
            placeholder={
              approve
                ? 'Bienvenue ! Pensez à publier vos premiers créneaux.'
                : 'Ex. : merci de joindre une attestation de votre employeur actuel.'
            }
          />
        </Field>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant={approve ? 'primary' : 'danger'}
            loading={decide.isPending}
            onClick={submit}
          >
            {approve ? 'Accepter' : 'Refuser'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequestCard({ r, bare = false }: { r: AdminVerification; bare?: boolean }) {
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const p = r.mentorProfile;
  const application = r.kind === 'MENTOR_APPLICATION';
  const blocked = application && r.history.activeMentorshipsAsMentee > 0;

  return (
    <article
      className={cn(
        bare ? '' : 'rounded-lg bg-surface p-5 shadow-card ring-1 ring-border/70 sm:p-6',
      )}
    >
      <header className="flex flex-wrap items-start gap-3">
        <Avatar person={r.user} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold text-ink-900">{fullName(r.user)}</p>
          <p className="truncate text-[13px] text-muted-foreground">
            {r.user.email} · inscrit·e le {formatDate(r.user.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={application ? 'amber' : 'ink'}>
            {application ? <GraduationCap aria-hidden /> : <ShieldCheck aria-hidden />}
            {kindLabel[r.kind]}
          </Badge>
          <RequestStatusBadge status={r.status} />
        </div>
      </header>

      <p className="mt-1 text-[12px] text-muted-foreground">Demande du {formatDate(r.createdAt)}</p>

      {p && (
        <div className="mt-4 grid gap-2 rounded-md bg-surface-muted/60 p-4">
          <p className="font-semibold text-ink-900">{p.headline}</p>
          <p className="text-[13px] text-muted-foreground">
            {[
              p.currentPosition && p.organization
                ? `${p.currentPosition} · ${p.organization}`
                : (p.currentPosition ?? p.organization),
              plural(p.yearsExperience, 'an') + ' d’expérience',
              p.city,
              p.languages.join(', '),
              p.modalities.map((m) => modalityLabels[m]).join(', '),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p className="text-[13px]">
            <span className="font-semibold">Domaines : </span>
            {p.domains.map((d) => d.name).join(', ')}
          </p>
          <p className="text-[13px]">
            <span className="font-semibold">Compétences : </span>
            {p.expertise.join(' · ')}
          </p>
          <details className="text-[14px]">
            <summary className="cursor-pointer font-medium text-teal-700">Présentation</summary>
            <p className="mt-2 whitespace-pre-line text-foreground">{p.bio}</p>
          </details>
        </div>
      )}

      {application && (
        <p className="mt-3 text-[13px] text-muted-foreground">
          Sur la plateforme :{' '}
          {plural(
            r.history.completedMentorshipsAsMentee,
            'accompagnement terminé',
            'accompagnements terminés',
          )}{' '}
          en tant que mentoré·e · {plural(r.history.certificatesAsMentee, 'certificat')}
        </p>
      )}
      {blocked && r.status === 'PENDING' && (
        <p className="mt-2 flex items-start gap-2 rounded-md bg-warning-50 px-3 py-2 text-[13px] text-warning-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Mentorat encore en cours en tant que mentoré·e : il doit être clôturé avant que la
          candidature puisse être acceptée.
        </p>
      )}

      <blockquote className="mt-4 border-l-2 border-teal-600 pl-3 text-[15px] whitespace-pre-line text-foreground">
        {r.message}
      </blockquote>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {r.profileUrl && (
          <a
            href={r.profileUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-1.5 rounded-sm bg-surface-muted px-2 py-1 text-[13px] font-medium text-teal-800 hover:bg-ink-50"
          >
            <ExternalLink className="size-3.5" aria-hidden />
            Profil en ligne
          </a>
        )}
        {r.documents.map((d) => (
          <a
            key={d.id}
            href={documentUrl(d.id)}
            download={d.fileName}
            className="inline-flex items-center gap-1.5 rounded-sm bg-surface-muted px-2 py-1 text-[13px] font-medium text-ink-800 hover:bg-ink-50"
          >
            <FileText className="size-3.5" aria-hidden />
            {d.fileName}
          </a>
        ))}
        {r.documents.length === 0 && !r.profileUrl && (
          <span className="text-[13px] text-muted-foreground">
            Aucun justificatif ni lien fourni.
          </span>
        )}
      </div>

      {r.status === 'PENDING' ? (
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          <Button variant="danger-ghost" onClick={() => setDecision('reject')}>
            <ShieldX aria-hidden />
            Refuser
          </Button>
          <Button onClick={() => setDecision('approve')} disabled={blocked}>
            <BadgeCheck aria-hidden />
            {application ? 'Accepter comme mentor' : 'Vérifier le profil'}
          </Button>
        </div>
      ) : (
        <p className="mt-5 border-t border-border pt-4 text-[13px] text-muted-foreground">
          Décision du {r.decidedAt ? formatDate(r.decidedAt) : '—'}
          {r.decidedBy && <> par {fullName(r.decidedBy)}</>}
          {r.decisionNote && <> : « {r.decisionNote} »</>}
        </p>
      )}
      {decision && (
        <DecisionDialog request={r} decision={decision} onClose={() => setDecision(null)} />
      )}
    </article>
  );
}

/** File d'examen des vérifications de profil et des candidatures de mentor. */
export function AdminVerificationsView() {
  const { data: me } = useMe();
  const [status, setStatus] = useState<VerificationRequestStatus>('PENDING');
  const [kind, setKind] = useState<VerificationKind | ''>('');
  const list = useAdminVerifications(status, kind || undefined);
  const [openId, setOpenId] = useState<string | null>(null);
  if (!me) return null;
  if (me.role !== 'ADMIN') {
    return <AccessDenied message="Cet espace est réservé à l’équipe d’administration." />;
  }
  const rows = list.data ?? [];
  const opened = rows.find((r) => r.id === openId) ?? null;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Vérifications"
        description="Profils de mentors à vérifier et candidatures de mentorés qui souhaitent devenir mentors."
      />
      <div className="mb-4">
        <Segmented
          label="Statut"
          value={status}
          onChange={setStatus}
          options={TABS.map((t) => ({ value: t.value, label: t.label }))}
        />
      </div>
      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <DataTable
          caption="Demandes de vérification"
          loading={list.isPending}
          rows={rows}
          rowKey={(r) => r.id}
          searchText={(r) =>
            `${r.user.firstName} ${r.user.lastName} ${r.user.email} ${r.mentorProfile?.headline ?? ''}`
          }
          searchPlaceholder="Nom, email ou titre"
          empty={
            status === 'PENDING'
              ? 'Aucune demande en attente : tout est à jour.'
              : 'Aucune demande dans cette catégorie.'
          }
          toolbar={
            <NativeSelect
              aria-label="Type de demande"
              value={kind}
              onChange={(e) => setKind(e.target.value as VerificationKind | '')}
              className="h-10 w-auto min-w-48 py-0 text-[14px]"
            >
              <option value="">Tous les types</option>
              <option value="MENTOR_APPLICATION">Candidatures mentor</option>
              <option value="MENTOR_VERIFICATION">Vérifications de profil</option>
            </NativeSelect>
          }
          columns={[
            {
              key: 'person',
              header: 'Personne',
              sortValue: (r) => `${r.user.lastName} ${r.user.firstName}`,
              cell: (r) => (
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar person={r.user} size="sm" />
                  <div className="max-w-[200px] min-w-0">
                    <p className="truncate font-semibold text-ink-900">{fullName(r.user)}</p>
                    <p className="truncate text-[12px] text-muted-foreground">{r.user.email}</p>
                  </div>
                </div>
              ),
            },
            {
              key: 'kind',
              header: 'Type',
              sortValue: (r) => r.kind,
              cell: (r) => (
                <Badge tone={r.kind === 'MENTOR_APPLICATION' ? 'amber' : 'ink'}>
                  {r.kind === 'MENTOR_APPLICATION' ? (
                    <GraduationCap aria-hidden />
                  ) : (
                    <ShieldCheck aria-hidden />
                  )}
                  {kindLabel[r.kind]}
                </Badge>
              ),
            },
            {
              key: 'profile',
              header: 'Profil',
              hideBelow: 'lg',
              cell: (r) => (
                <span className="line-clamp-1 max-w-[260px] text-muted-foreground">
                  {r.mentorProfile?.headline ?? '—'}
                </span>
              ),
            },
            {
              key: 'docs',
              header: 'Justificatifs',
              align: 'right',
              hideBelow: 'md',
              sortValue: (r) => r.documents.length,
              cell: (r) => (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <FileText className="size-3.5 text-muted-foreground" aria-hidden />
                  {r.documents.length}
                </span>
              ),
            },
            {
              key: 'date',
              header: 'Envoyée le',
              hideBelow: 'sm',
              sortValue: (r) => r.createdAt,
              cell: (r) => (
                <span className="whitespace-nowrap text-muted-foreground">
                  {formatDate(r.createdAt)}
                </span>
              ),
            },
            {
              key: 'status',
              header: 'Statut',
              hideBelow: 'sm',
              cell: (r) => <RequestStatusBadge status={r.status} />,
            },
            {
              key: 'actions',
              header: 'Actions',
              align: 'right',
              cell: (r) => (
                <Button
                  size="sm"
                  variant={r.status === 'PENDING' ? 'primary' : 'secondary'}
                  onClick={() => setOpenId(r.id)}
                >
                  <Eye aria-hidden />
                  {r.status === 'PENDING' ? 'Examiner' : 'Voir'}
                </Button>
              ),
            },
          ]}
        />
      )}
      {opened && (
        <Dialog open onOpenChange={(o) => !o && setOpenId(null)}>
          <DialogContent
            title={`${kindLabel[opened.kind]} · ${fullName(opened.user)}`}
            className="sm:max-w-2xl"
          >
            <RequestCard r={opened} bare />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
