'use client';

import { Ban, CircleCheck, Eye, EyeOff, ShieldCheck, UserCheck, Users, UserX } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { DataTable } from '@/components/admin/data-table';
import { StatCard } from '@/components/admin/ui';
import { AccessDenied, ErrorState, PageHeader } from '@/components/feedback/states';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/input';
import { useMe } from '@/features/auth/api';
import { ResetLinkButton } from '@/features/auth/components/password-reset';
import { errorMessage } from '@/lib/api';
import { formatDate, fullName } from '@/lib/format';
import { roleLabels, verificationLabels } from '@/lib/labels';
import type { Role, UserStatus, VerificationStatus } from '@/lib/types';
import { isStaff } from '@/lib/utils';
import { useAdminMutations, useAdminUsers, type AdminUser } from './api';

function useAdminGuard() {
  const { data: me } = useMe();
  return { me, allowed: isStaff(me?.role) };
}

const selectSm = 'h-10 w-auto min-w-40 py-0 text-[14px]';

/* ── Comptes ──────────────────────────────────────────────────────────────── */

export function AdminUsersView() {
  const { me, allowed } = useAdminGuard();
  const [role, setRole] = useState<Role | ''>('');
  const [status, setStatus] = useState<UserStatus | ''>('');
  const q = useAdminUsers(role || undefined);
  const { setStatus: setUserStatus } = useAdminMutations();
  if (!me) return null;
  if (!allowed) return <AccessDenied />;

  const all = q.data ?? [];
  const rows = status ? all.filter((u) => u.status === status) : all;
  const suspended = all.filter((u) => u.status !== 'ACTIVE').length;

  const toggle = (u: AdminUser) =>
    setUserStatus.mutate(
      { id: u.id, status: u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' },
      {
        onSuccess: () =>
          toast.success(u.status === 'ACTIVE' ? 'Compte suspendu.' : 'Compte réactivé.'),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Comptes"
        description="La suspension ferme immédiatement les sessions du compte. « Réinitialiser » crée un lien personnel de changement de mot de passe, à remettre à la personne après avoir vérifié son identité."
      />
      {!role && q.data && (
        <div className="mb-6 grid grid-cols-3 gap-2.5 sm:gap-4">
          <StatCard label="Comptes" value={all.length} icon={Users} hint="Tous rôles confondus" />
          <StatCard
            label="Actifs"
            value={all.length - suspended}
            icon={UserCheck}
            hint="Peuvent se connecter"
          />
          <StatCard label="Suspendus" value={suspended} icon={UserX} hint="Sessions fermées" />
        </div>
      )}
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <DataTable
          caption="Comptes de la plateforme"
          loading={q.isPending}
          rows={rows}
          rowKey={(u) => u.id}
          searchText={(u) => `${u.firstName} ${u.lastName} ${u.email}`}
          searchPlaceholder="Nom ou adresse email"
          empty="Aucun compte ne correspond à ces filtres."
          toolbar={
            <>
              <NativeSelect
                aria-label="Filtrer par rôle"
                value={role}
                onChange={(e) => setRole(e.target.value as Role | '')}
                className={selectSm}
              >
                <option value="">Tous les rôles</option>
                {(Object.keys(roleLabels) as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {roleLabels[r]}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect
                aria-label="Filtrer par statut"
                value={status}
                onChange={(e) => setStatus(e.target.value as UserStatus | '')}
                className={selectSm}
              >
                <option value="">Tous les statuts</option>
                <option value="ACTIVE">Actifs</option>
                <option value="SUSPENDED">Suspendus</option>
              </NativeSelect>
            </>
          }
          columns={[
            {
              key: 'name',
              header: 'Utilisateur',
              sortValue: (u) => `${u.lastName} ${u.firstName}`,
              cell: (u) => (
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar person={u} size="sm" />
                  <div className="max-w-[170px] min-w-0 sm:max-w-none">
                    <p className="truncate font-semibold text-ink-900">
                      {fullName(u)}
                      {u.id === me.id && (
                        <span className="ml-1 font-normal text-muted-foreground">(vous)</span>
                      )}
                    </p>
                    <p className="truncate text-[12px] text-muted-foreground">{u.email}</p>
                    <p className="mt-0.5 text-[12px] sm:hidden">
                      {roleLabels[u.role]} ·{' '}
                      {u.status === 'ACTIVE' ? (
                        <span className="text-success-700">Actif</span>
                      ) : (
                        <span className="font-semibold text-danger-700">Suspendu</span>
                      )}
                    </p>
                  </div>
                </div>
              ),
            },
            {
              key: 'role',
              header: 'Rôle',
              sortValue: (u) => roleLabels[u.role],
              hideBelow: 'sm',
              cell: (u) => (
                <Badge tone={u.role === 'ADMIN' ? 'ink' : 'neutral'}>{roleLabels[u.role]}</Badge>
              ),
            },
            {
              key: 'created',
              header: 'Inscription',
              sortValue: (u) => u.createdAt,
              hideBelow: 'md',
              cell: (u) => (
                <span className="whitespace-nowrap text-muted-foreground">
                  {formatDate(u.createdAt)}
                </span>
              ),
            },
            {
              key: 'status',
              header: 'Statut',
              hideBelow: 'sm',
              sortValue: (u) => u.status,
              cell: (u) =>
                u.status === 'ACTIVE' ? (
                  <Badge tone="success">
                    <CircleCheck aria-hidden />
                    Actif
                  </Badge>
                ) : (
                  <Badge tone="danger">
                    <Ban aria-hidden />
                    Suspendu
                  </Badge>
                ),
            },
            {
              key: 'actions',
              header: 'Actions',
              align: 'right',
              cell: (u) =>
                u.id === me.id ? null : (
                  <div className="flex flex-col items-end gap-1 whitespace-nowrap sm:flex-row sm:justify-end">
                    {u.status === 'ACTIVE' && u.role !== 'ADMIN' && <ResetLinkButton user={u} />}
                    <Button
                      size="sm"
                      variant={u.status === 'ACTIVE' ? 'danger-ghost' : 'secondary'}
                      loading={setUserStatus.isPending && setUserStatus.variables?.id === u.id}
                      onClick={() => toggle(u)}
                    >
                      {u.status === 'ACTIVE' ? 'Suspendre' : 'Réactiver'}
                    </Button>
                  </div>
                ),
            },
          ]}
        />
      )}
    </div>
  );
}

/* ── Mentors ──────────────────────────────────────────────────────────────── */

export function AdminMentorsView() {
  const { me, allowed } = useAdminGuard();
  const q = useAdminUsers('MENTOR');
  const { updateMentor } = useAdminMutations();
  const [verif, setVerif] = useState<VerificationStatus | ''>('');
  const [published, setPublished] = useState<'' | 'yes' | 'no'>('');
  if (!me) return null;
  if (!allowed) return <AccessDenied />;

  const onError = (e: unknown) => toast.error(errorMessage(e));
  const all = q.data ?? [];
  const rows = all.filter(
    (u) =>
      (!verif || u.mentorProfile?.verificationStatus === verif) &&
      (!published || (u.mentorProfile?.isPublished ?? false) === (published === 'yes')),
  );
  const publishedCount = all.filter((u) => u.mentorProfile?.isPublished).length;
  const verifiedCount = all.filter(
    (u) => u.mentorProfile?.verificationStatus === 'VERIFIED',
  ).length;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Mentors"
        description="Publiez ou retirez un profil de l’annuaire et suivez sa vérification. La vérification est manuelle (entretien, références) : aucune validation automatique de diplômes."
      />
      {q.data && (
        <div className="mb-6 grid grid-cols-3 gap-2.5 sm:gap-4">
          <StatCard label="Mentors" value={all.length} icon={Users} hint="Comptes mentor" />
          <StatCard
            label="Publiés"
            value={publishedCount}
            icon={Eye}
            hint="Visibles dans l’annuaire"
          />
          <StatCard
            label="Vérifiés"
            value={verifiedCount}
            icon={ShieldCheck}
            hint="Badge « Profil vérifié »"
          />
        </div>
      )}
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <DataTable
          caption="Mentors de la plateforme"
          loading={q.isPending}
          rows={rows}
          rowKey={(u) => u.id}
          searchText={(u) =>
            `${u.firstName} ${u.lastName} ${u.email} ${u.mentorProfile?.headline ?? ''} ${u.mentorProfile?.city ?? ''}`
          }
          searchPlaceholder="Nom, titre ou ville"
          empty="Aucun mentor ne correspond à ces filtres."
          toolbar={
            <>
              <NativeSelect
                aria-label="Filtrer par vérification"
                value={verif}
                onChange={(e) => setVerif(e.target.value as VerificationStatus | '')}
                className={selectSm}
              >
                <option value="">Toutes les vérifications</option>
                {(Object.keys(verificationLabels) as VerificationStatus[]).map((v) => (
                  <option key={v} value={v}>
                    {verificationLabels[v]}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect
                aria-label="Filtrer par publication"
                value={published}
                onChange={(e) => setPublished(e.target.value as '' | 'yes' | 'no')}
                className={selectSm}
              >
                <option value="">Publiés ou non</option>
                <option value="yes">Publiés</option>
                <option value="no">Non publiés</option>
              </NativeSelect>
            </>
          }
          columns={[
            {
              key: 'name',
              header: 'Mentor',
              sortValue: (u) => `${u.lastName} ${u.firstName}`,
              cell: (u) => (
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar person={u} size="sm" />
                  <div className="max-w-[170px] min-w-0 sm:max-w-[320px]">
                    <Link
                      href={`/mentors/${u.id}`}
                      className="block truncate font-semibold text-ink-900 hover:underline"
                    >
                      {fullName(u)}
                    </Link>
                    <p className="truncate text-[12px] text-muted-foreground">
                      {u.mentorProfile?.headline ?? 'Profil non renseigné'}
                    </p>
                  </div>
                </div>
              ),
            },
            {
              key: 'city',
              header: 'Ville',
              hideBelow: 'lg',
              sortValue: (u) => u.mentorProfile?.city ?? null,
              cell: (u) => (
                <span className="text-muted-foreground">{u.mentorProfile?.city ?? '—'}</span>
              ),
            },
            {
              key: 'verification',
              header: 'Vérification',
              sortValue: (u) => u.mentorProfile?.verificationStatus ?? null,
              cell: (u) =>
                u.mentorProfile ? (
                  <NativeSelect
                    aria-label={`Vérification de ${fullName(u)}`}
                    className="h-9 w-auto min-w-36 py-0 text-[13px]"
                    value={u.mentorProfile.verificationStatus}
                    onChange={(e) =>
                      updateMentor.mutate(
                        {
                          id: u.id,
                          patch: { verificationStatus: e.target.value as VerificationStatus },
                        },
                        {
                          onSuccess: () => toast.success('Statut de vérification mis à jour.'),
                          onError,
                        },
                      )
                    }
                  >
                    {(Object.keys(verificationLabels) as VerificationStatus[]).map((v) => (
                      <option key={v} value={v}>
                        {verificationLabels[v]}
                      </option>
                    ))}
                  </NativeSelect>
                ) : (
                  <Badge tone="neutral">Onboarding non terminé</Badge>
                ),
            },
            {
              key: 'published',
              header: 'Annuaire',
              hideBelow: 'sm',
              sortValue: (u) => (u.mentorProfile?.isPublished ? 1 : 0),
              cell: (u) =>
                u.mentorProfile ? (
                  u.mentorProfile.isPublished ? (
                    <Badge tone="success">Publié</Badge>
                  ) : (
                    <Badge tone="neutral">Non publié</Badge>
                  )
                ) : null,
            },
            {
              key: 'actions',
              header: 'Actions',
              align: 'right',
              cell: (u) =>
                u.mentorProfile && (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={updateMentor.isPending && updateMentor.variables?.id === u.id}
                    onClick={() =>
                      updateMentor.mutate(
                        { id: u.id, patch: { isPublished: !u.mentorProfile!.isPublished } },
                        {
                          onSuccess: () =>
                            toast.success(
                              u.mentorProfile!.isPublished
                                ? 'Profil retiré de l’annuaire.'
                                : 'Profil publié.',
                            ),
                          onError,
                        },
                      )
                    }
                  >
                    {u.mentorProfile.isPublished ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                    {u.mentorProfile.isPublished ? 'Retirer' : 'Publier'}
                  </Button>
                ),
            },
          ]}
        />
      )}
    </div>
  );
}
