'use client';

import { Ban, CalendarDays, Eye, EyeOff, Hourglass, ShieldCheck, UserCheck, Users } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { AccessDenied, EmptyState, ErrorState, PageHeader } from '@/components/feedback/states';
import { StatusBadge } from '@/components/feedback/status-badge';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/misc';
import { useMe } from '@/features/auth/api';
import { errorMessage } from '@/lib/api';
import { formatDate, fullName } from '@/lib/format';
import { requestStatusLabels, roleLabels, sessionStatusLabels, verificationLabels } from '@/lib/labels';
import type { MentorshipRequestStatus, Role, SessionStatus, VerificationStatus } from '@/lib/types';
import { useAdminMutations, useAdminOverview, useAdminUsers } from './api';

function useAdminGuard() {
  const { data: me } = useMe();
  return { me, allowed: me?.role === 'ADMIN' };
}

function Tile({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Users }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className="inline-flex size-8 items-center justify-center rounded-md bg-teal-50 text-teal-700">
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function Breakdown<K extends string>({
  title,
  data,
  labels,
}: {
  title: string;
  data: Partial<Record<K, number>>;
  labels: Record<K, string>;
}) {
  const keys = Object.keys(labels) as K[];
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <caption className="sr-only">{title}</caption>
          <tbody className="divide-y divide-border">
            {keys.map((k) => (
              <tr key={k}>
                <th scope="row" className="py-2.5 text-left font-medium text-muted-foreground">
                  {labels[k]}
                </th>
                <td className="py-2.5 text-right font-semibold tabular-nums">{data[k] ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export function AdminOverviewView() {
  const { me, allowed } = useAdminGuard();
  const q = useAdminOverview();
  if (!me) return null;
  if (!allowed) return <AccessDenied />;
  return (
    <>
      <PageHeader title="Vue d’ensemble" description="Activité réelle de la plateforme, issue de la base de données." />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : q.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="grid gap-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Tile label="Comptes" value={q.data.users} icon={Users} />
            <Tile label="Mentors" value={q.data.mentors} icon={ShieldCheck} />
            <Tile label="Mentorés" value={q.data.mentees} icon={UserCheck} />
            <Tile label="Mentorats actifs" value={q.data.activeMentorships} icon={CalendarDays} />
          </div>
          {q.data.pendingVerification > 0 && (
            <div className="flex flex-col gap-3 rounded-lg border border-amber-100 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-2 text-sm font-medium text-[#7a4a0f]">
                <Hourglass className="size-4" aria-hidden />
                {q.data.pendingVerification} profil(s) mentor en attente de vérification.
              </p>
              <Button asChild size="sm" variant="secondary">
                <Link href="/admin/mentors">Vérifier les mentors</Link>
              </Button>
            </div>
          )}
          <div className="grid gap-6 md:grid-cols-2">
            <Breakdown<MentorshipRequestStatus>
              title="Demandes par statut"
              data={q.data.requestsByStatus}
              labels={requestStatusLabels}
            />
            <Breakdown<SessionStatus> title="Séances par statut" data={q.data.sessionsByStatus} labels={sessionStatusLabels} />
          </div>
        </div>
      )}
    </>
  );
}

export function AdminUsersView() {
  const { me, allowed } = useAdminGuard();
  const [role, setRole] = useState<Role | ''>('');
  const q = useAdminUsers(role || undefined);
  const { setStatus } = useAdminMutations();
  if (!me) return null;
  if (!allowed) return <AccessDenied />;

  return (
    <>
      <PageHeader
        title="Comptes"
        description="La suspension révoque immédiatement les sessions actives du compte."
        actions={
          <NativeSelect aria-label="Filtrer par rôle" value={role} onChange={(e) => setRole(e.target.value as Role | '')} className="w-48">
            <option value="">Tous les rôles</option>
            {(Object.keys(roleLabels) as Role[]).map((r) => (
              <option key={r} value={r}>
                {roleLabels[r]}
              </option>
            ))}
          </NativeSelect>
        }
      />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : q.isPending ? (
        <Skeleton className="h-96" />
      ) : q.data.length === 0 ? (
        <EmptyState icon={Users} title="Aucun compte" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-surface-muted text-left text-xs font-semibold text-muted-foreground">
                <tr>
                  <th scope="col" className="px-5 py-3">Utilisateur</th>
                  <th scope="col" className="px-5 py-3">Rôle</th>
                  <th scope="col" className="px-5 py-3">Inscription</th>
                  <th scope="col" className="px-5 py-3">Statut</th>
                  <th scope="col" className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {q.data.map((u) => (
                  <tr key={u.id} className="hover:bg-surface-muted/50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar person={u} size="sm" />
                        <div className="min-w-0">
                          <p className="font-semibold">{fullName(u)}</p>
                          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">{roleLabels[u.role]}</td>
                    <td className="px-5 py-3 text-muted-foreground">{formatDate(u.createdAt)}</td>
                    <td className="px-5 py-3">
                      {u.status === 'ACTIVE' ? <Badge tone="success">Actif</Badge> : (
                        <Badge tone="danger">
                          <Ban aria-hidden />
                          Suspendu
                        </Badge>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {u.id !== me.id && (
                        <Button
                          size="sm"
                          variant={u.status === 'ACTIVE' ? 'danger-ghost' : 'secondary'}
                          loading={setStatus.isPending && setStatus.variables?.id === u.id}
                          onClick={() =>
                            setStatus.mutate(
                              { id: u.id, status: u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' },
                              {
                                onSuccess: () => toast.success(u.status === 'ACTIVE' ? 'Compte suspendu.' : 'Compte réactivé.'),
                                onError: (e) => toast.error(errorMessage(e)),
                              },
                            )
                          }
                        >
                          {u.status === 'ACTIVE' ? 'Suspendre' : 'Réactiver'}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

export function AdminMentorsView() {
  const { me, allowed } = useAdminGuard();
  const q = useAdminUsers('MENTOR');
  const { updateMentor } = useAdminMutations();
  if (!me) return null;
  if (!allowed) return <AccessDenied />;

  const onError = (e: unknown) => toast.error(errorMessage(e));

  return (
    <>
      <PageHeader
        title="Mentors"
        description="Vérification manuelle (entretien, références). Aucune validation automatique de diplômes."
      />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : q.isPending ? (
        <Skeleton className="h-96" />
      ) : (
        <ul className="grid gap-3">
          {q.data.map((u) => (
            <li key={u.id}>
              <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar person={u} />
                  <div className="min-w-0">
                    <p className="font-semibold">
                      <Link href={`/mentors/${u.id}`} className="hover:underline">
                        {fullName(u)}
                      </Link>
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {u.mentorProfile?.headline ?? 'Profil non renseigné'}
                    </p>
                  </div>
                </div>
                {u.mentorProfile ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge kind="verification" status={u.mentorProfile.verificationStatus} />
                    <NativeSelect
                      aria-label={`Vérification de ${fullName(u)}`}
                      className="h-9 w-auto py-0 text-sm"
                      value={u.mentorProfile.verificationStatus}
                      onChange={(e) =>
                        updateMentor.mutate(
                          { id: u.id, patch: { verificationStatus: e.target.value as VerificationStatus } },
                          { onSuccess: () => toast.success('Statut de vérification mis à jour.'), onError },
                        )
                      }
                    >
                      {(Object.keys(verificationLabels) as VerificationStatus[]).map((v) => (
                        <option key={v} value={v}>
                          {verificationLabels[v]}
                        </option>
                      ))}
                    </NativeSelect>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        updateMentor.mutate(
                          { id: u.id, patch: { isPublished: !u.mentorProfile!.isPublished } },
                          {
                            onSuccess: () =>
                              toast.success(u.mentorProfile!.isPublished ? 'Profil retiré de l’annuaire.' : 'Profil publié.'),
                            onError,
                          },
                        )
                      }
                    >
                      {u.mentorProfile.isPublished ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                      {u.mentorProfile.isPublished ? 'Retirer' : 'Publier'}
                    </Button>
                  </div>
                ) : (
                  <Badge tone="neutral">Onboarding non terminé</Badge>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
