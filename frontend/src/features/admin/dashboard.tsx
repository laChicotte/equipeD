'use client';

import {
  ArrowRight,
  CalendarCheck2,
  CircleCheck,
  Clock,
  Download,
  Hourglass,
  Inbox,
  MessagesSquare,
  Star,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { DataTable } from '@/components/admin/data-table';
import { DonutChart, FunnelChart, TrendChart, formatNumber } from '@/components/admin/charts';
import { Panel, Segmented, StatCard } from '@/components/admin/ui';
import { AccessDenied, ErrorState, PageHeader } from '@/components/feedback/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { useMe } from '@/features/auth/api';
import { auditActionLabels, useAudit, useMetrics, type Metrics } from '@/features/platform/api';
import { formatRelative } from '@/lib/format';
import { useAdminOverview } from './api';

type Serie = 'signups' | 'requests' | 'sessions' | 'messages';

const SERIES_META: Record<Serie, { label: string; unit: string }> = {
  signups: { label: 'Inscriptions', unit: 'inscription(s)' },
  requests: { label: 'Demandes', unit: 'demande(s)' },
  sessions: { label: 'Séances', unit: 'séance(s)' },
  messages: { label: 'Messages', unit: 'message(s)' },
};

const sum = (o: Partial<Record<string, number>>) =>
  Object.values(o).reduce<number>((a, b) => a + (b ?? 0), 0);

function ActivityPanel({ m }: { m: Metrics }) {
  const [serie, setSerie] = useState<Serie>('requests');
  const points = m.activity[serie];
  return (
    <Panel
      title="Activité des 30 derniers jours"
      description="Survolez la courbe, ou utilisez les flèches du clavier, pour lire chaque jour."
      className="lg:col-span-2"
    >
      <Segmented
        label="Mesure affichée"
        value={serie}
        onChange={setSerie}
        options={(Object.keys(SERIES_META) as Serie[]).map((s) => ({
          value: s,
          label: SERIES_META[s].label,
          hint: formatNumber(m.activity[s].reduce((a, p) => a + p.count, 0)),
        }))}
      />
      <div className="mt-5">
        <TrendChart
          key={serie}
          points={points}
          label={SERIES_META[serie].label}
          unit={SERIES_META[serie].unit}
        />
      </div>
    </Panel>
  );
}

function QualityPanel({ m }: { m: Metrics }) {
  const items = [
    {
      icon: Inbox,
      label: 'Taux d’acceptation des demandes',
      value: m.requests.acceptanceRate === null ? '—' : `${m.requests.acceptanceRate} %`,
    },
    {
      icon: Clock,
      label: 'Délai de réponse médian',
      value: m.requests.medianResponseHours === null ? '—' : `${m.requests.medianResponseHours} h`,
    },
    {
      icon: Star,
      label: `Satisfaction (${m.feedback.count} avis)`,
      value:
        m.feedback.average === null ? '—' : `${m.feedback.average.toLocaleString('fr-FR')} / 5`,
    },
    {
      icon: CalendarCheck2,
      label: 'Heures d’accompagnement',
      value: `${formatNumber(m.sessions.completedHours)} h`,
    },
  ];
  return (
    <Panel title="Qualité de l’accompagnement" description="Calculée sur l’ensemble des échanges.">
      <ul className="grid gap-3">
        {items.map(({ icon: Icon, label, value }) => (
          <li
            key={label}
            className="flex items-center gap-3 rounded-lg bg-background/70 px-3.5 py-3 ring-1 ring-border/50"
          >
            <span className="inline-flex size-8 items-center justify-center rounded-md bg-surface text-ink-800 ring-1 ring-border/70">
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1 text-[13px] text-muted-foreground">{label}</span>
            <span className="font-display text-[18px] font-semibold text-ink-900">{value}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function RecentActions() {
  const audit = useAudit('', 1);
  const rows = audit.data?.items.slice(0, 6) ?? [];
  return (
    <Panel
      title="Dernières actions de l’équipe"
      description="Modération, rôles, domaines et certificats."
      action={
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/journal">
            Tout le journal
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      }
      bodyClassName="p-0 sm:px-0 pt-4"
      className="lg:col-span-2"
    >
      <div className="-mb-px [&>div]:rounded-t-none [&>div]:shadow-none [&>div]:ring-0">
        <DataTable
          caption="Dernières actions de l’équipe"
          loading={audit.isPending}
          rows={rows}
          rowKey={(e) => e.id}
          empty="Aucune action enregistrée pour l’instant."
          defaultPageSize={6}
          columns={[
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
              cell: (e) => <span className="line-clamp-1 text-ink-900">{e.summary}</span>,
            },
            {
              key: 'actor',
              header: 'Par',
              hideBelow: 'md',
              cell: (e) => <span className="whitespace-nowrap">{e.actorName}</span>,
            },
            {
              key: 'date',
              header: 'Quand',
              align: 'right',
              cell: (e) => (
                <span className="whitespace-nowrap text-muted-foreground">
                  {formatRelative(e.createdAt)}
                </span>
              ),
            },
          ]}
        />
      </div>
    </Panel>
  );
}

/** Équilibre offre et demande, une ligne par domaine, sans surcharge. */
function DomainBalance({ domains }: { domains: Metrics['domains'] }) {
  const rows = domains
    .map((d) => ({ ...d, demand: d.menteeInterests + d.requests }))
    .sort((a, b) => b.demand - b.mentors - (a.demand - a.mentors));
  const max = Math.max(1, ...rows.map((r) => Math.max(r.mentors, r.demand)));
  const status = (r: (typeof rows)[number]) =>
    r.demand > 0 && r.mentors === 0
      ? { tone: 'danger' as const, label: 'Aucun mentor' }
      : r.demand > r.mentors * 2
        ? { tone: 'warning' as const, label: 'À renforcer' }
        : { tone: 'success' as const, label: 'Équilibré' };
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-left text-[14px]">
        <thead>
          <tr className="border-y border-border/70 bg-surface-muted/50 text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
            <th scope="col" className="px-5 py-2.5 sm:px-6">
              Domaine
            </th>
            <th scope="col" className="hidden px-3 py-2.5 sm:table-cell">
              Offre et demande
            </th>
            <th scope="col" className="px-3 py-2.5 text-right">
              Mentors
            </th>
            <th scope="col" className="px-3 py-2.5 text-right">
              Demande
            </th>
            <th scope="col" className="px-5 py-2.5 text-right sm:px-6">
              État
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {rows.map((r) => {
            const st = status(r);
            return (
              <tr key={r.id}>
                <td
                  className="max-w-[220px] truncate px-5 py-2.5 text-ink-900 sm:px-6"
                  title={r.name}
                >
                  {r.name}
                </td>
                <td className="hidden w-[30%] px-3 py-2.5 sm:table-cell">
                  <div className="grid gap-1" aria-hidden>
                    <span className="h-1.5 rounded-full bg-surface-muted">
                      <span
                        className="block h-full rounded-full bg-[#2f8a63]"
                        style={{ width: `${(r.mentors / max) * 100}%` }}
                      />
                    </span>
                    <span className="h-1.5 rounded-full bg-surface-muted">
                      <span
                        className="block h-full rounded-full bg-[#c0502a]"
                        style={{ width: `${(r.demand / max) * 100}%` }}
                      />
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{r.mentors}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{r.demand}</td>
                <td className="px-5 py-2.5 text-right sm:px-6">
                  <Badge tone={st.tone}>{st.label}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5} className="px-5 pt-3 pb-1 text-[12px] text-muted-foreground sm:px-6">
              <span className="mr-4 inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[#2f8a63]" aria-hidden /> Mentors
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[#c0502a]" aria-hidden /> Demande
              </span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function AdminDashboard() {
  const { data: me } = useMe();
  const overview = useAdminOverview();
  const metrics = useMetrics();
  if (!me) return null;
  if (me.role !== 'ADMIN') return <AccessDenied />;

  const pending = overview.data?.pendingVerification ?? 0;
  const pendingResources = overview.data?.pendingResources ?? 0;
  const m = metrics.data;

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow={
          <span className="text-[13px] font-medium text-muted-foreground">
            Bonjour {me.firstName}
          </span>
        }
        title="Tableau de bord"
        description="Activité réelle de la plateforme, calculée en direct sur la base de données."
        actions={
          <Button asChild variant="secondary">
            <a href="/api/v1/admin/impact-report.csv" download>
              <Download aria-hidden />
              Rapport d’impact (CSV)
            </a>
          </Button>
        }
      />

      {pending + pendingResources > 0 ? (
        <div className="mb-6 grid gap-3">
          {[
            pending > 0 && {
              key: 'verif',
              text:
                pending === 1
                  ? '1 demande de vérification ou candidature de mentor attend une décision.'
                  : `${pending} demandes de vérification ou candidatures de mentor attendent une décision.`,
              href: '/admin/verifications',
            },
            pendingResources > 0 && {
              key: 'res',
              text:
                pendingResources === 1
                  ? '1 document proposé pour la bibliothèque attend votre validation.'
                  : `${pendingResources} documents proposés pour la bibliothèque attendent votre validation.`,
              href: '/admin/contenus',
            },
          ]
            .filter((x): x is { key: string; text: string; href: string } => !!x)
            .map((x) => (
              <div
                key={x.key}
                className="flex animate-slide-up flex-col gap-3 rounded-xl border border-amber-100 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <p className="flex items-center gap-3 text-[14px] font-medium text-[#7a4a0f]">
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                    <Hourglass className="size-4" aria-hidden />
                  </span>
                  {x.text}
                </p>
                <Button asChild size="sm">
                  <Link href={x.href}>
                    Examiner
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
              </div>
            ))}
        </div>
      ) : overview.data ? (
        <p className="mb-6 flex items-center gap-2 rounded-xl bg-success-50 px-4 py-3 text-[14px] text-success-700">
          <CircleCheck className="size-4" aria-hidden />
          Aucune demande en attente : tout est à jour.
        </p>
      ) : null}

      {metrics.isError ? (
        <ErrorState error={metrics.error} onRetry={() => void metrics.refetch()} />
      ) : !m ? (
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-xl" />
        </div>
      ) : (
        <div className="grid gap-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard
              label="Membres"
              value={(m.users.byRole.MENTEE ?? 0) + (m.users.byRole.MENTOR ?? 0)}
              icon={Users}
              trend={m.activity.signups}
            />
            <StatCard
              label="Demandes de mentorat"
              value={sum(m.requests.byStatus)}
              icon={Inbox}
              trend={m.activity.requests}
            />
            <StatCard
              label="Séances réalisées"
              value={m.sessions.byStatus.COMPLETED ?? 0}
              icon={CalendarCheck2}
              trend={m.activity.sessions}
            />
            <StatCard
              label="Messages échangés"
              value={m.messages.total}
              icon={MessagesSquare}
              trend={m.activity.messages}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <ActivityPanel m={m} />
            <Panel title="Demandes de mentorat" description="Répartition par statut.">
              <DonutChart
                centerLabel="demandes"
                data={[
                  { label: 'Acceptées', value: m.requests.byStatus.ACCEPTED ?? 0 },
                  { label: 'Refusées', value: m.requests.byStatus.DECLINED ?? 0 },
                  { label: 'En attente', value: m.requests.byStatus.PENDING ?? 0 },
                  { label: 'Annulées', value: m.requests.byStatus.CANCELLED ?? 0 },
                ]}
              />
            </Panel>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Panel
              title="Offre et demande par domaine"
              description="Mentors disponibles face à la demande (mentorés intéressés et demandes reçues)."
              className="lg:col-span-2"
              bodyClassName="px-0 pb-2 sm:px-0"
            >
              <DomainBalance domains={m.domains.filter((d) => d.isActive)} />
            </Panel>
            <div className="grid content-start gap-6">
              <Panel title="Mentorats" description="Depuis le lancement.">
                <DonutChart
                  size={148}
                  centerLabel="mentorats"
                  data={[
                    { label: 'Menés à terme', value: m.mentorships.COMPLETED ?? 0 },
                    { label: 'En cours', value: m.mentorships.ACTIVE ?? 0 },
                    { label: 'Annulés', value: m.mentorships.CANCELLED ?? 0 },
                  ]}
                />
              </Panel>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel
              title="Du premier contact au certificat"
              description="Volumes cumulés et passage d’une étape à la suivante."
            >
              <FunnelChart
                steps={[
                  { label: 'Demandes envoyées', value: sum(m.requests.byStatus) },
                  { label: 'Demandes acceptées', value: m.requests.byStatus.ACCEPTED ?? 0 },
                  { label: 'Mentorats menés à terme', value: m.mentorships.COMPLETED ?? 0 },
                  { label: 'Certificats délivrés', value: m.certificates.valid },
                ]}
              />
            </Panel>
            <QualityPanel m={m} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <RecentActions />
            <Panel title="Comptes" description="Par rôle.">
              <DonutChart
                size={148}
                centerLabel="comptes"
                data={[
                  { label: 'Mentorés', value: m.users.byRole.MENTEE ?? 0 },
                  { label: 'Mentors', value: m.users.byRole.MENTOR ?? 0 },
                  { label: 'Administrateurs', value: m.users.byRole.ADMIN ?? 0 },
                ]}
              />
              <p className="mt-4 text-[12px] text-muted-foreground">
                +{m.users.new7d} inscription{m.users.new7d > 1 ? 's' : ''} ces 7 derniers jours ·
                mise à jour {formatRelative(m.generatedAt)}
              </p>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
