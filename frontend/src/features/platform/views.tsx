'use client';

import {
  Archive,
  Award,
  CalendarCheck2,
  Download,
  Phone,
  Presentation,
  Printer,
  Target,
  Inbox,
  MessagesSquare,
  ShieldPlus,
  Star,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AccessDenied, ErrorState, PageHeader } from '@/components/feedback/states';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/misc';
import { DataTable } from '@/components/admin/data-table';
import { FunnelChart, TrendChart, formatNumber } from '@/components/admin/charts';
import { Panel } from '@/components/admin/ui';
import { useAdminUsers } from '@/features/admin/api';
import { useMe } from '@/features/auth/api';
import { formatDuration } from '@/features/certificates/api';
import { useOpportunities, useOpportunityMutations } from '@/features/opportunities/api';
import { useDeleteResource, useLibrary } from '@/features/resources/api';
import { ResourceReviewQueue } from '@/features/resources/review-queue';
import { errorMessage } from '@/lib/api';
import { formatDate, formatRelative, fullName, normalizeText } from '@/lib/format';
import { roleLabels } from '@/lib/labels';
import { cn } from '@/lib/utils';
import {
  auditActionLabels,
  useAdminCertificates,
  useAudit,
  useMetrics,
  usePlatformMutations,
  useTeam,
  type AdminCertificate,
} from './api';

const panel = 'rounded-xl bg-surface shadow-card ring-1 ring-border/70';

function useAdminGuard() {
  const { data: me } = useMe();
  return { me, allowed: me?.role === 'ADMIN' };
}

function Guard({ children }: { children: React.ReactNode }) {
  const { me, allowed } = useAdminGuard();
  if (!me) return null;
  if (!allowed)
    return (
      <AccessDenied message="Cet espace est réservé à l’équipe d’administration de la plateforme." />
    );
  return <>{children}</>;
}

/* ── Pilotage ─────────────────────────────────────────────────────────────── */

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
}) {
  return (
    <div className={cn(panel, 'min-w-0 p-3.5 sm:p-4')}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
        <span
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-ink-50 text-ink-800"
          aria-hidden
        >
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-1 font-display text-[28px] leading-none font-semibold text-ink-900 tabular-nums">
        {value}
      </p>
      {hint && <p className="mt-1.5 text-[12px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(iso),
  );

export function PilotageView() {
  const metrics = useMetrics();
  return (
    <Guard>
      <PageHeader
        title="Pilotage de la plateforme"
        description="Indicateurs calculés en direct sur la base de données. Aucun contenu de conversation n’est consulté."
        actions={
          <span className="flex flex-wrap gap-2 print:hidden">
            <Button asChild variant="secondary">
              <a href="/api/v1/admin/impact-report.csv" download>
                <Download aria-hidden />
                Rapport d’impact (CSV)
              </a>
            </Button>
            <Button variant="ghost" onClick={() => window.print()}>
              <Printer aria-hidden />
              Imprimer ou PDF
            </Button>
          </span>
        }
      />
      {metrics.isError ? (
        <ErrorState error={metrics.error} onRetry={() => void metrics.refetch()} />
      ) : metrics.isPending ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        (() => {
          const m = metrics.data;
          const users = (m.users.byRole.MENTEE ?? 0) + (m.users.byRole.MENTOR ?? 0);
          const totalRequests = Object.values(m.requests.byStatus).reduce(
            (a, b) => a + (b ?? 0),
            0,
          );
          return (
            <div className="grid gap-6">
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                <Kpi
                  label="Membres"
                  value={users}
                  hint={`${m.users.byRole.MENTEE ?? 0} mentorés · ${m.users.byRole.MENTOR ?? 0} mentors · +${m.users.new7d} en 7 jours`}
                  icon={Users}
                />
                <Kpi
                  label="Mentors publiés"
                  value={m.mentors.published}
                  hint={`${m.mentors.verified} vérifiés · ${m.mentors.toReview} à examiner`}
                  icon={ShieldPlus}
                />
                <Kpi
                  label="Taux d’acceptation"
                  value={
                    m.requests.acceptanceRate === null ? '—' : `${m.requests.acceptanceRate} %`
                  }
                  hint={
                    m.requests.medianResponseHours === null
                      ? 'Aucune décision encore'
                      : `Réponse médiane en ${m.requests.medianResponseHours} h`
                  }
                  icon={Inbox}
                />
                <Kpi
                  label="Mentorats en cours"
                  value={m.mentorships.ACTIVE ?? 0}
                  hint={`${m.mentorships.COMPLETED ?? 0} menés à terme`}
                  icon={Users}
                />
                <Kpi
                  label="Séances réalisées"
                  value={m.sessions.byStatus.COMPLETED ?? 0}
                  hint={`${m.sessions.completedHours} h d’accompagnement`}
                  icon={CalendarCheck2}
                />
                <Kpi
                  label="Satisfaction"
                  value={
                    m.feedback.average === null
                      ? '—'
                      : `${m.feedback.average.toLocaleString('fr-FR')} / 5`
                  }
                  hint={`${m.feedback.count} évaluation${m.feedback.count > 1 ? 's' : ''} de séance`}
                  icon={Star}
                />
                <Kpi
                  label="Certificats délivrés"
                  value={m.certificates.valid}
                  hint={
                    m.certificates.revoked
                      ? `${m.certificates.revoked} révoqué(s)`
                      : 'Aucun révoqué'
                  }
                  icon={Award}
                />
                <Kpi
                  label="Messages échangés"
                  value={m.messages.total}
                  hint={`${m.messages.last7d} ces 7 derniers jours`}
                  icon={MessagesSquare}
                />
                <Kpi
                  label="Objectifs atteints"
                  value={m.goals.completed}
                  hint={`sur ${m.goals.total} définis · ${m.goals.inProgress} en cours`}
                  icon={Target}
                />
                <Kpi
                  label="Ateliers réalisés"
                  value={m.workshops.held}
                  hint={`${m.workshops.participations} participation(s) · ${m.workshops.upcoming} à venir`}
                  icon={Presentation}
                />
                <Kpi
                  label="Appels audio"
                  value={m.calls.audio}
                  hint={`${m.calls.audioMinutes} min · vidéo : ${m.calls.video} appel(s), ${m.calls.videoMinutes} min`}
                  icon={Phone}
                />
              </div>

              <section aria-labelledby="titre-activite">
                <h2
                  id="titre-activite"
                  className="mb-3 font-display text-[18px] font-semibold text-ink-900"
                >
                  Activité des 30 derniers jours
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {(
                    [
                      ['Inscriptions', m.activity.signups, 'inscription(s)'],
                      ['Demandes de mentorat', m.activity.requests, 'demande(s)'],
                      ['Séances réalisées', m.activity.sessions, 'séance(s)'],
                      ['Messages', m.activity.messages, 'message(s)'],
                    ] as const
                  ).map(([title, points, unit]) => (
                    <Panel
                      key={title}
                      title={title}
                      description={`${formatNumber(points.reduce((a, p) => a + p.count, 0))} sur 30 jours`}
                    >
                      <TrendChart points={[...points]} label={title} unit={unit} height={160} />
                    </Panel>
                  ))}
                </div>
                <details className="mt-3 text-[13px]">
                  <summary className="cursor-pointer font-semibold text-muted-foreground hover:text-ink-900">
                    Voir les données en tableau
                  </summary>
                  <div className="mt-2 max-h-72 overflow-auto rounded-lg ring-1 ring-border/70">
                    <table className="w-full text-left tabular-nums">
                      <thead className="sticky top-0 bg-surface text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Jour</th>
                          <th className="px-3 py-2 text-right font-semibold">Inscriptions</th>
                          <th className="px-3 py-2 text-right font-semibold">Demandes</th>
                          <th className="px-3 py-2 text-right font-semibold">Séances</th>
                          <th className="px-3 py-2 text-right font-semibold">Messages</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60 bg-surface">
                        {m.activity.signups.map((p, i) => (
                          <tr key={p.day}>
                            <td className="px-3 py-1.5">{dayLabel(p.day)}</td>
                            <td className="px-3 py-1.5 text-right">{p.count}</td>
                            <td className="px-3 py-1.5 text-right">
                              {m.activity.requests[i]?.count ?? 0}
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              {m.activity.sessions[i]?.count ?? 0}
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              {m.activity.messages[i]?.count ?? 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </section>

              <div className="grid items-start gap-6 lg:grid-cols-2">
                <Panel
                  title="Du premier contact au certificat"
                  description="Volumes cumulés depuis le lancement."
                >
                  <FunnelChart
                    steps={[
                      { label: 'Demandes envoyées', value: totalRequests },
                      { label: 'Demandes acceptées', value: m.requests.byStatus.ACCEPTED ?? 0 },
                      { label: 'Mentorats menés à terme', value: m.mentorships.COMPLETED ?? 0 },
                      { label: 'Certificats délivrés', value: m.certificates.valid },
                    ]}
                  />
                </Panel>
                <section aria-labelledby="titre-domaines" className="grid gap-3">
                  <div>
                    <h2
                      id="titre-domaines"
                      className="font-display text-[16px] font-semibold text-ink-900"
                    >
                      Offre et demande par domaine
                    </h2>
                    <p className="text-[13px] text-muted-foreground">
                      Repérer les domaines où il manque des mentors.
                    </p>
                  </div>
                  <DataTable
                    caption="Offre et demande par domaine"
                    rows={m.domains}
                    rowKey={(d) => d.id}
                    defaultPageSize={10}
                    columns={[
                      {
                        key: 'name',
                        header: 'Domaine',
                        sortValue: (d) => d.name,
                        cell: (d) => (
                          <span className="text-ink-900">
                            {d.name}
                            {!d.isActive && (
                              <span className="ml-1.5 text-[11px] text-muted-foreground">
                                (désactivé)
                              </span>
                            )}
                            {d.menteeInterests + d.requests > 0 && d.mentors === 0 && (
                              <Badge tone="warning" className="ml-2">
                                Mentors manquants
                              </Badge>
                            )}
                          </span>
                        ),
                      },
                      {
                        key: 'mentors',
                        header: 'Mentors',
                        align: 'right',
                        sortValue: (d) => d.mentors,
                        cell: (d) => (
                          <span className="font-semibold tabular-nums">{d.mentors}</span>
                        ),
                      },
                      {
                        key: 'interests',
                        header: 'Intéressés',
                        align: 'right',
                        hideBelow: 'sm',
                        sortValue: (d) => d.menteeInterests,
                        cell: (d) => <span className="tabular-nums">{d.menteeInterests}</span>,
                      },
                      {
                        key: 'requests',
                        header: 'Demandes',
                        align: 'right',
                        sortValue: (d) => d.requests,
                        cell: (d) => <span className="tabular-nums">{d.requests}</span>,
                      },
                    ]}
                  />
                </section>
              </div>
              <p className="text-[12px] text-muted-foreground">
                Mis à jour {formatRelative(m.generatedAt)} · actualisation automatique chaque
                minute.
              </p>
            </div>
          );
        })()
      )}
    </Guard>
  );
}

/* ── Équipe ───────────────────────────────────────────────────────────────── */

export function TeamView() {
  const { me } = useAdminGuard();
  const team = useTeam();
  const users = useAdminUsers();
  const { changeRole } = usePlatformMutations();
  const [q, setQ] = useState('');

  const candidates = useMemo(() => {
    const term = normalizeText(q.trim());
    if (term.length < 2) return [];
    return (users.data ?? [])
      .filter((u) => (u.role === 'MENTEE' || u.role === 'MENTOR') && u.status === 'ACTIVE')
      .filter((u) => normalizeText(`${u.firstName} ${u.lastName} ${u.email}`).includes(term))
      .slice(0, 8);
  }, [users.data, q]);

  const run = (id: string, role: 'ADMIN' | 'MENTOR' | 'MENTEE', ok: string) =>
    changeRole.mutate(
      { id, role },
      { onSuccess: () => toast.success(ok), onError: (e) => toast.error(errorMessage(e)) },
    );

  return (
    <Guard>
      <PageHeader
        title="Équipe d’administration"
        description="Nommez ou retirez des administrateurs. Chaque changement déconnecte la personne et est inscrit au journal d’audit."
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-labelledby="titre-equipe" className="grid gap-3">
          <h2 id="titre-equipe" className="font-display text-[16px] font-semibold text-ink-900">
            Membres de l’équipe
          </h2>
          {team.isError ? (
            <ErrorState error={team.error} onRetry={() => void team.refetch()} />
          ) : (
            <DataTable
              caption="Membres de l’équipe"
              loading={team.isPending}
              rows={team.data ?? []}
              rowKey={(u) => u.id}
              searchText={(u) => `${u.firstName} ${u.lastName} ${u.email}`}
              searchPlaceholder="Nom ou adresse email"
              columns={[
                {
                  key: 'name',
                  header: 'Membre',
                  sortValue: (u) => `${u.lastName} ${u.firstName}`,
                  cell: (u) => (
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar person={u} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink-900">
                          {fullName(u)}{' '}
                          {u.id === me?.id && (
                            <span className="font-normal text-muted-foreground">(vous)</span>
                          )}
                        </p>
                        <p className="truncate text-[12px] text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'since',
                  header: 'Depuis',
                  hideBelow: 'md',
                  sortValue: (u) => u.createdAt,
                  cell: (u) => (
                    <span className="whitespace-nowrap text-muted-foreground">
                      {formatDate(u.createdAt)}
                    </span>
                  ),
                },
                {
                  key: 'role',
                  header: 'Rôle',
                  hideBelow: 'sm',
                  cell: (u) => <Badge tone="ink">{roleLabels[u.role]}</Badge>,
                },
                {
                  key: 'actions',
                  header: 'Actions',
                  align: 'right',
                  cell: (u) =>
                    u.role === 'ADMIN' &&
                    u.id !== me?.id && (
                      <ConfirmButton
                        title={`Retirer ${u.firstName} de l’équipe ?`}
                        description="La personne redevient mentorée et devra compléter son profil à sa prochaine connexion."
                        confirmLabel="Retirer de l’équipe"
                        loading={changeRole.isPending && changeRole.variables?.id === u.id}
                        onConfirm={() =>
                          run(u.id, 'MENTEE', `${u.firstName} ne fait plus partie de l’équipe`)
                        }
                      >
                        <UserMinus aria-hidden />
                        Retirer
                      </ConfirmButton>
                    ),
                },
              ]}
            />
          )}
        </section>

        <section className={cn(panel, 'p-5')} aria-labelledby="titre-nommer">
          <h2 id="titre-nommer" className="font-display text-[17px] font-semibold text-ink-900">
            Nommer un administrateur
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Parmi les comptes actifs, sans mentorat en cours ni demande en attente.
          </p>
          <Field label="Rechercher un compte" className="mt-4">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nom ou adresse email"
            />
          </Field>
          <ul className="mt-3 grid gap-1">
            {candidates.map((u) => (
              <li
                key={u.id}
                className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-background"
              >
                <Avatar person={u} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-ink-900">
                    {fullName(u)}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {roleLabels[u.role]} · {u.email}
                  </span>
                </span>
                <ConfirmButton
                  variant="secondary"
                  title={`Nommer ${u.firstName} administrateur ?`}
                  description="Il ou elle pourra modérer les comptes, les mentors et les domaines. Ses accès de mentor ou de mentoré seront retirés."
                  confirmLabel="Nommer administrateur"
                  loading={changeRole.isPending && changeRole.variables?.id === u.id}
                  onConfirm={() =>
                    run(u.id, 'ADMIN', `${u.firstName} est maintenant administrateur`)
                  }
                >
                  <UserPlus aria-hidden />
                  Nommer
                </ConfirmButton>
              </li>
            ))}
            {q.trim().length >= 2 && candidates.length === 0 && (
              <li className="px-2 py-3 text-[13px] text-muted-foreground">
                Aucun compte correspondant.
              </li>
            )}
          </ul>
        </section>
      </div>
    </Guard>
  );
}

/* ── Journal d'audit ──────────────────────────────────────────────────────── */

export function AuditView() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const audit = useAudit(action, page);
  return (
    <Guard>
      <PageHeader
        title="Journal d’audit"
        description="Toutes les actions de l’équipe : modération, rôles, domaines, certificats. Le contenu des conversations n’y figure jamais."
        actions={
          <NativeSelect
            aria-label="Filtrer par action"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            className="w-auto min-w-52"
          >
            <option value="">Toutes les actions</option>
            {Object.entries(auditActionLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </NativeSelect>
        }
      />
      {audit.isError ? (
        <ErrorState error={audit.error} onRetry={() => void audit.refetch()} />
      ) : (
        <DataTable
          caption="Journal d’audit"
          loading={audit.isPending}
          rows={audit.data?.items ?? []}
          rowKey={(e) => e.id}
          empty="Aucune action enregistrée. Les actions de modération apparaîtront ici."
          server={
            audit.data && {
              page: audit.data.page,
              totalPages: audit.data.totalPages,
              total: audit.data.total,
              pageSize: 30,
              onPageChange: setPage,
            }
          }
          columns={[
            {
              key: 'date',
              header: 'Date',
              cell: (e) => (
                <span className="whitespace-nowrap text-muted-foreground tabular-nums">
                  {new Intl.DateTimeFormat('fr-FR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                    timeZone: 'Africa/Conakry',
                  }).format(new Date(e.createdAt))}
                </span>
              ),
            },
            {
              key: 'action',
              header: 'Action',
              cell: (e) => (
                <Badge
                  tone={
                    e.action === 'CERTIFICATE_REVOKED' || e.action === 'USER_SUSPENDED'
                      ? 'warning'
                      : 'neutral'
                  }
                >
                  {auditActionLabels[e.action] ?? e.action}
                </Badge>
              ),
            },
            {
              key: 'summary',
              header: 'Détail',
              cell: (e) => <span className="text-ink-900">{e.summary}</span>,
            },
            {
              key: 'actor',
              header: 'Par',
              hideBelow: 'md',
              cell: (e) => <span className="whitespace-nowrap">{e.actorName}</span>,
            },
          ]}
        />
      )}
    </Guard>
  );
}

/* ── Certificats ──────────────────────────────────────────────────────────── */

function RevokeDialog({ cert, onClose }: { cert: AdminCertificate; onClose: () => void }) {
  const { revokeCertificate } = usePlatformMutations();
  const [reason, setReason] = useState('');
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={`Révoquer le certificat ${cert.code} ?`}
        description={`Le certificat de ${cert.mentorName} ne sera plus valide. Le mentor est prévenu et le motif est inscrit au journal.`}
      >
        <Field
          label="Motif"
          hint="Entre 10 et 300 caractères."
          counter={{ value: reason.length, min: 10, max: 300 }}
        >
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
        </Field>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant="danger"
            disabled={reason.trim().length < 10}
            loading={revokeCertificate.isPending}
            onClick={() =>
              revokeCertificate.mutate(
                { code: cert.code, reason: reason.trim() },
                {
                  onSuccess: () => {
                    toast.success('Certificat révoqué');
                    onClose();
                  },
                  onError: (e) => toast.error(errorMessage(e)),
                },
              )
            }
          >
            Révoquer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CertificatesAdminView() {
  const list = useAdminCertificates();
  const [revoking, setRevoking] = useState<AdminCertificate | null>(null);
  return (
    <Guard>
      <PageHeader
        title="Certificats d’accompagnement"
        description="Délivrés automatiquement à la clôture d’un mentorat avec au moins une séance réalisée. Une révocation doit être motivée."
      />
      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <DataTable
          caption="Certificats d’accompagnement"
          loading={list.isPending}
          rows={list.data ?? []}
          rowKey={(c) => c.code}
          searchText={(c) => `${c.code} ${c.mentorName} ${c.menteeName} ${c.domainName}`}
          searchPlaceholder="Code, mentor, mentoré ou domaine"
          empty="Aucun certificat délivré. Ils apparaîtront à la clôture des premiers mentorats."
          columns={[
            {
              key: 'code',
              header: 'Code',
              sortValue: (c) => c.code,
              cell: (c) => (
                <Link
                  href={`/certificats/${c.code}`}
                  className="font-mono font-semibold whitespace-nowrap text-teal-700 hover:underline"
                >
                  {c.code}
                </Link>
              ),
            },
            {
              key: 'mentor',
              header: 'Mentor',
              sortValue: (c) => c.mentorName,
              cell: (c) => <span className="text-ink-900">{c.mentorName}</span>,
            },
            {
              key: 'detail',
              header: 'Accompagnement',
              hideBelow: 'lg',
              cell: (c) => (
                <span className="text-muted-foreground">
                  {c.menteeName} · {c.domainName} · {c.completedSessions} séance(s),{' '}
                  {formatDuration(c.totalMinutes)}
                </span>
              ),
            },
            {
              key: 'issued',
              header: 'Délivré',
              sortValue: (c) => c.issuedAt,
              hideBelow: 'sm',
              cell: (c) => <span className="whitespace-nowrap">{formatDate(c.issuedAt)}</span>,
            },
            {
              key: 'state',
              header: 'État',
              sortValue: (c) => (c.revokedAt ? 1 : 0),
              cell: (c) =>
                c.revokedAt ? (
                  <span title={c.revokedReason ?? undefined}>
                    <Badge tone="warning">Révoqué</Badge>
                  </span>
                ) : (
                  <Badge tone="success">Valide</Badge>
                ),
            },
            {
              key: 'actions',
              header: 'Actions',
              align: 'right',
              cell: (c) =>
                !c.revokedAt && (
                  <Button variant="danger-ghost" size="sm" onClick={() => setRevoking(c)}>
                    Révoquer
                  </Button>
                ),
            },
          ]}
        />
      )}
      {revoking && <RevokeDialog cert={revoking} onClose={() => setRevoking(null)} />}
    </Guard>
  );
}

/* ── Contenus publics ─────────────────────────────────────────────────────── */

export function ContentView() {
  const [resPage, setResPage] = useState(1);
  const [oppPage, setOppPage] = useState(1);
  const resources = useLibrary({ page: resPage });
  const opportunities = useOpportunities({ page: oppPage });
  const del = useDeleteResource();
  const { setArchived } = useOpportunityMutations();
  return (
    <Guard>
      <PageHeader
        title="Modération des contenus"
        description="Validation des documents proposés pour la bibliothèque, ressources publiques et opportunités. Chaque décision de l’équipe est inscrite au journal."
      />
      <div className="grid gap-8">
        <ResourceReviewQueue />
        <section aria-labelledby="titre-ressources" className="grid gap-3">
          <h2 id="titre-ressources" className="font-display text-[16px] font-semibold text-ink-900">
            Ressources publiques
          </h2>
          <DataTable
            caption="Ressources publiques"
            loading={resources.isPending}
            rows={resources.data?.items ?? []}
            rowKey={(r) => r.id}
            empty="Aucune ressource publique."
            server={
              resources.data && {
                page: resources.data.page,
                totalPages: resources.data.totalPages,
                total: resources.data.total,
                pageSize: resources.data.pageSize,
                onPageChange: setResPage,
              }
            }
            columns={[
              {
                key: 'title',
                header: 'Titre',
                cell: (r) => <span className="font-semibold text-ink-900">{r.title}</span>,
              },
              {
                key: 'author',
                header: 'Auteur',
                hideBelow: 'sm',
                cell: (r) => <span className="whitespace-nowrap">{fullName(r.author)}</span>,
              },
              {
                key: 'date',
                header: 'Publiée le',
                hideBelow: 'md',
                cell: (r) => (
                  <span className="whitespace-nowrap text-muted-foreground">
                    {formatDate(r.createdAt)}
                  </span>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                cell: (r) => (
                  <ConfirmButton
                    title="Retirer cette ressource ?"
                    description="Elle disparaît de la bibliothèque. L’action est tracée dans le journal d’audit."
                    confirmLabel="Retirer"
                    loading={del.isPending && del.variables === r.id}
                    onConfirm={() =>
                      del.mutate(r.id, {
                        onSuccess: () => toast.success('Ressource retirée'),
                        onError: (e) => toast.error(errorMessage(e)),
                      })
                    }
                  >
                    <Trash2 aria-hidden />
                    Retirer
                  </ConfirmButton>
                ),
              },
            ]}
          />
        </section>
        <section aria-labelledby="titre-opps" className="grid gap-3">
          <h2 id="titre-opps" className="font-display text-[16px] font-semibold text-ink-900">
            Opportunités ouvertes
          </h2>
          <DataTable
            caption="Opportunités ouvertes"
            loading={opportunities.isPending}
            rows={opportunities.data?.items ?? []}
            rowKey={(o) => o.id}
            empty="Aucune opportunité ouverte."
            server={
              opportunities.data && {
                page: opportunities.data.page,
                totalPages: opportunities.data.totalPages,
                total: opportunities.data.total,
                pageSize: opportunities.data.pageSize,
                onPageChange: setOppPage,
              }
            }
            columns={[
              {
                key: 'title',
                header: 'Opportunité',
                cell: (o) => (
                  <div className="min-w-0">
                    <p className="font-semibold text-ink-900">{o.title}</p>
                    <p className="text-[12px] text-muted-foreground">{o.organization}</p>
                  </div>
                ),
              },
              {
                key: 'author',
                header: 'Publiée par',
                hideBelow: 'sm',
                cell: (o) => <span className="whitespace-nowrap">{fullName(o.author)}</span>,
              },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                cell: (o) => (
                  <ConfirmButton
                    title="Archiver cette opportunité ?"
                    description="Elle n’est plus visible du public. L’action est tracée dans le journal d’audit."
                    confirmLabel="Archiver"
                    loading={setArchived.isPending && setArchived.variables?.id === o.id}
                    onConfirm={() =>
                      setArchived.mutate(
                        { id: o.id, archived: true },
                        {
                          onSuccess: () => toast.success('Opportunité archivée'),
                          onError: (e) => toast.error(errorMessage(e)),
                        },
                      )
                    }
                  >
                    <Archive aria-hidden />
                    Archiver
                  </ConfirmButton>
                ),
              },
            ]}
          />
        </section>
      </div>
    </Guard>
  );
}
