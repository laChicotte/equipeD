'use client';

import {
  Archive,
  Award,
  CalendarCheck2,
  Clock,
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
import { AccessDenied, EmptyState, ErrorState, PageHeader } from '@/components/feedback/states';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/misc';
import { useAdminUsers } from '@/features/admin/api';
import { useMe } from '@/features/auth/api';
import { formatDuration } from '@/features/certificates/api';
import { useOpportunities, useOpportunityMutations } from '@/features/opportunities/api';
import { useDeleteResource, useLibrary } from '@/features/resources/api';
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
  type DailyPoint,
} from './api';

const panel = 'rounded-lg bg-surface shadow-card ring-1 ring-border/70';

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
    <div className={cn(panel, 'p-4')}>
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

/**
 * Petit graphique à barres (une série, une couleur) : un multiple par mesure plutôt qu'un
 * graphique à double échelle. Survol : info-bulle par barre ; les données existent aussi en tableau.
 */
function DailyBars({ title, points, unit }: { title: string; points: DailyPoint[]; unit: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...points.map((p) => p.count));
  const total = points.reduce((s, p) => s + p.count, 0);
  const W = 300;
  const H = 72;
  const step = W / points.length;
  const bar = Math.max(2, step - 2);
  const h = hover === null ? null : points[hover];
  return (
    <figure className={cn(panel, 'p-4')}>
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold text-ink-900">{title}</span>
        <span className="text-[12px] text-muted-foreground tabular-nums">
          {h ? `${dayLabel(h.day)} : ${h.count} ${unit}` : `${total} sur 30 jours`}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H + 2}`}
        className="mt-3 h-20 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${title} : ${total} ${unit} sur 30 jours`}
        onMouseLeave={() => setHover(null)}
      >
        <line x1="0" x2={W} y1={H} y2={H} className="stroke-border" strokeWidth="1" />
        {points.map((p, i) => {
          const bh = p.count === 0 ? 0 : Math.max(3, (p.count / max) * (H - 4));
          return (
            <g key={p.day} onMouseEnter={() => setHover(i)}>
              <rect x={i * step} y={0} width={step} height={H} fill="transparent" />
              {bh > 0 && (
                <rect
                  x={i * step + 1}
                  y={H - bh}
                  width={bar}
                  height={bh}
                  rx={Math.min(2, bar / 2)}
                  className={cn(
                    'fill-teal-600 transition-opacity',
                    hover !== null && hover !== i && 'opacity-40',
                  )}
                />
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>{dayLabel(points[0]?.day ?? new Date().toISOString())}</span>
        <span>Aujourd’hui</span>
      </div>
    </figure>
  );
}

function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <ol className="grid gap-2.5">
      {steps.map((s) => (
        <li
          key={s.label}
          className="grid grid-cols-[minmax(0,180px)_minmax(0,1fr)_48px] items-center gap-3 text-[13px]"
        >
          <span className="truncate text-muted-foreground">{s.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-ink-50">
            <span
              className="block h-full rounded-full bg-ink-800"
              style={{ width: `${(s.value / max) * 100}%` }}
            />
          </span>
          <span className="text-right font-semibold text-ink-900 tabular-nums">{s.value}</span>
        </li>
      ))}
    </ol>
  );
}

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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                  <DailyBars
                    title="Inscriptions"
                    points={m.activity.signups}
                    unit="inscription(s)"
                  />
                  <DailyBars
                    title="Demandes de mentorat"
                    points={m.activity.requests}
                    unit="demande(s)"
                  />
                  <DailyBars
                    title="Séances réalisées"
                    points={m.activity.sessions}
                    unit="séance(s)"
                  />
                  <DailyBars title="Messages" points={m.activity.messages} unit="message(s)" />
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

              <div className="grid items-start gap-4 lg:grid-cols-2">
                <section className={cn(panel, 'p-5')} aria-labelledby="titre-entonnoir">
                  <h2
                    id="titre-entonnoir"
                    className="font-display text-[17px] font-semibold text-ink-900"
                  >
                    Du premier contact au certificat
                  </h2>
                  <p className="mt-0.5 mb-4 text-[13px] text-muted-foreground">
                    Volumes cumulés depuis le lancement.
                  </p>
                  <Funnel
                    steps={[
                      { label: 'Demandes envoyées', value: totalRequests },
                      { label: 'Demandes acceptées', value: m.requests.byStatus.ACCEPTED ?? 0 },
                      { label: 'Mentorats menés à terme', value: m.mentorships.COMPLETED ?? 0 },
                      { label: 'Certificats délivrés', value: m.certificates.valid },
                    ]}
                  />
                </section>
                <section className={cn(panel, 'overflow-hidden')} aria-labelledby="titre-domaines">
                  <h2
                    id="titre-domaines"
                    className="px-5 pt-5 font-display text-[17px] font-semibold text-ink-900"
                  >
                    Offre et demande par domaine
                  </h2>
                  <p className="mt-0.5 px-5 text-[13px] text-muted-foreground">
                    Repérer les domaines où il manque des mentors.
                  </p>
                  <table className="mt-3 w-full text-left text-[13px]">
                    <thead className="text-muted-foreground">
                      <tr className="border-b border-border/70">
                        <th className="px-5 py-2 font-semibold">Domaine</th>
                        <th className="px-3 py-2 text-right font-semibold">Mentors</th>
                        <th className="px-3 py-2 text-right font-semibold">Intéressés</th>
                        <th className="px-5 py-2 text-right font-semibold">Demandes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {m.domains.map((d) => {
                        const short = d.menteeInterests + d.requests > 0 && d.mentors === 0;
                        return (
                          <tr key={d.id}>
                            <td className="px-5 py-2 text-ink-900">
                              {d.name}
                              {!d.isActive && (
                                <span className="ml-1.5 text-[11px] text-muted-foreground">
                                  (désactivé)
                                </span>
                              )}
                              {short && (
                                <Badge tone="warning" className="ml-2">
                                  Mentors manquants
                                </Badge>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold tabular-nums">
                              {d.mentors}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {d.menteeInterests}
                            </td>
                            <td className="px-5 py-2 text-right tabular-nums">{d.requests}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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
        <section className={cn(panel, 'overflow-hidden')} aria-labelledby="titre-equipe">
          <h2
            id="titre-equipe"
            className="border-b border-border/70 px-5 py-3.5 font-display text-[17px] font-semibold text-ink-900"
          >
            Membres de l’équipe
          </h2>
          {team.isPending ? (
            <Skeleton className="m-5 h-32" />
          ) : team.isError ? (
            <div className="p-5">
              <ErrorState error={team.error} onRetry={() => void team.refetch()} />
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {team.data.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <Avatar person={u} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-ink-900">
                      {fullName(u)}{' '}
                      {u.id === me?.id && (
                        <span className="font-normal text-muted-foreground">(vous)</span>
                      )}
                    </p>
                    <p className="truncate text-[12px] text-muted-foreground">
                      {u.email} · depuis le {formatDate(u.createdAt)}
                    </p>
                  </div>
                  <Badge tone="teal">{roleLabels[u.role]}</Badge>
                  {u.role === 'ADMIN' && (
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
                  )}
                </li>
              ))}
            </ul>
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
      ) : audit.isPending ? (
        <Skeleton className="h-80" />
      ) : audit.data.items.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Aucune action enregistrée"
          description="Les actions de modération apparaîtront ici dès qu’un membre de l’équipe en effectuera."
        />
      ) : (
        <div className={cn(panel, 'overflow-x-auto')}>
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border/70">
                <th className="px-5 py-3 font-semibold">Date</th>
                <th className="px-3 py-3 font-semibold">Action</th>
                <th className="px-3 py-3 font-semibold">Détail</th>
                <th className="px-5 py-3 font-semibold">Par</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {audit.data.items.map((e) => (
                <tr key={e.id}>
                  <td className="px-5 py-3 whitespace-nowrap text-muted-foreground">
                    {new Intl.DateTimeFormat('fr-FR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                      timeZone: 'Africa/Conakry',
                    }).format(new Date(e.createdAt))}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <Badge
                      tone={
                        e.action === 'CERTIFICATE_REVOKED' || e.action === 'USER_SUSPENDED'
                          ? 'warning'
                          : 'neutral'
                      }
                    >
                      {auditActionLabels[e.action] ?? e.action}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-ink-900">{e.summary}</td>
                  <td className="px-5 py-3 whitespace-nowrap">{e.actorName}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {audit.data.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border/70 px-5 py-3 text-[13px]">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Précédent
              </Button>
              <span className="text-muted-foreground">
                Page {audit.data.page} sur {audit.data.totalPages} · {audit.data.total} entrées
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= audit.data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Suivant
              </Button>
            </div>
          )}
        </div>
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
      ) : list.isPending ? (
        <Skeleton className="h-64" />
      ) : list.data.length === 0 ? (
        <EmptyState
          icon={Award}
          title="Aucun certificat délivré"
          description="Ils apparaîtront ici à la clôture des premiers mentorats."
        />
      ) : (
        <div className={cn(panel, 'overflow-x-auto')}>
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border/70">
                <th className="px-5 py-3 font-semibold">Code</th>
                <th className="px-3 py-3 font-semibold">Mentor</th>
                <th className="px-3 py-3 font-semibold">Accompagnement</th>
                <th className="px-3 py-3 font-semibold">Délivré</th>
                <th className="px-3 py-3 font-semibold">État</th>
                <th className="px-5 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {list.data.map((c) => (
                <tr key={c.code}>
                  <td className="px-5 py-3 font-mono font-semibold whitespace-nowrap">
                    <Link href={`/certificats/${c.code}`} className="text-teal-700 hover:underline">
                      {c.code}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-ink-900">{c.mentorName}</td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {c.menteeName} · {c.domainName} · {c.completedSessions} séance(s),{' '}
                    {formatDuration(c.totalMinutes)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">{formatDate(c.issuedAt)}</td>
                  <td className="px-3 py-3">
                    {c.revokedAt ? (
                      <span title={c.revokedReason ?? undefined}>
                        <Badge tone="warning">Révoqué</Badge>
                      </span>
                    ) : (
                      <Badge tone="success">Valide</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {!c.revokedAt && (
                      <Button variant="danger-ghost" size="sm" onClick={() => setRevoking(c)}>
                        Révoquer
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {revoking && <RevokeDialog cert={revoking} onClose={() => setRevoking(null)} />}
    </Guard>
  );
}

/* ── Contenus publics ─────────────────────────────────────────────────────── */

export function ContentView() {
  const resources = useLibrary({ page: 1 });
  const opportunities = useOpportunities({ page: 1 });
  const del = useDeleteResource();
  const { setArchived } = useOpportunityMutations();
  return (
    <Guard>
      <PageHeader
        title="Modération des contenus"
        description="Ressources publiques et opportunités publiées par les mentors. Chaque retrait par l’équipe est inscrit au journal."
      />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className={cn(panel, 'overflow-hidden')} aria-labelledby="titre-ressources">
          <h2
            id="titre-ressources"
            className="border-b border-border/70 px-5 py-3.5 font-display text-[17px] font-semibold text-ink-900"
          >
            Ressources publiques
          </h2>
          {resources.isPending ? (
            <Skeleton className="m-5 h-40" />
          ) : (
            <ul className="divide-y divide-border/60">
              {(resources.data?.items ?? []).map((r) => (
                <li key={r.id} className="flex items-start gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-ink-900">{r.title}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {fullName(r.author)} · {formatDate(r.createdAt)}
                    </p>
                  </div>
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
                </li>
              ))}
              {resources.data?.items.length === 0 && (
                <li className="px-5 py-6 text-[13px] text-muted-foreground">
                  Aucune ressource publique.
                </li>
              )}
            </ul>
          )}
        </section>
        <section className={cn(panel, 'overflow-hidden')} aria-labelledby="titre-opps">
          <h2
            id="titre-opps"
            className="border-b border-border/70 px-5 py-3.5 font-display text-[17px] font-semibold text-ink-900"
          >
            Opportunités ouvertes
          </h2>
          {opportunities.isPending ? (
            <Skeleton className="m-5 h-40" />
          ) : (
            <ul className="divide-y divide-border/60">
              {(opportunities.data?.items ?? []).map((o) => (
                <li key={o.id} className="flex items-start gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-ink-900">{o.title}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {o.organization} · {fullName(o.author)}
                    </p>
                  </div>
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
                </li>
              ))}
              {opportunities.data?.items.length === 0 && (
                <li className="px-5 py-6 text-[13px] text-muted-foreground">
                  Aucune opportunité ouverte.
                </li>
              )}
            </ul>
          )}
        </section>
      </div>
    </Guard>
  );
}
