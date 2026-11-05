'use client';

import {
  Award,
  BadgeCheck,
  CalendarRange,
  Check,
  Copy,
  Printer,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { ErrorState } from '@/components/feedback/states';
import { LogoMark } from '@/components/layout/logo';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { isApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { Certificate } from '@/lib/types';
import { formatDuration, useCertificate, useMentorCertificates } from './api';

function stats(c: Certificate) {
  return [
    `${c.completedSessions} séance${c.completedSessions > 1 ? 's' : ''} réalisée${c.completedSessions > 1 ? 's' : ''}`,
    formatDuration(c.totalMinutes),
    c.goalsTotal
      ? `${c.goalsCompleted}/${c.goalsTotal} objectif${c.goalsTotal > 1 ? 's' : ''} atteint${c.goalsCompleted > 1 ? 's' : ''}`
      : null,
    c.averageRating !== null ? `★ ${c.averageRating.toLocaleString('fr-FR')} / 5` : null,
  ].filter(Boolean) as string[];
}

/** Section « Certificats d’accompagnement » de la fiche mentor (façon « Licences et certifications »). */
export function MentorCertificatesSection({
  mentorId,
  className,
}: {
  mentorId: string;
  className: string;
}) {
  const { data, isPending } = useMentorCertificates(mentorId);
  if (isPending) return <Skeleton className="h-32" />;
  if (!data || data.length === 0) return null;
  return (
    <section
      id="certificats"
      className={`${className} scroll-mt-24`}
      aria-labelledby="titre-certificats"
    >
      <h2
        id="titre-certificats"
        className="font-display text-[19px] font-semibold tracking-[-0.01em] text-ink-900"
      >
        Certificats d’accompagnement
      </h2>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Délivrés par la plateforme à la clôture d’un mentorat comptant au moins une séance réalisée.
        Vérifiables par leur code.
      </p>
      <ul className="mt-3 divide-y divide-border/70">
        {data.map((c) => (
          <li key={c.code} className="flex gap-3 py-4">
            <span className="relative inline-flex size-12 shrink-0 items-center justify-center rounded-[30%] bg-ink-900 text-amber-400">
              <Award className="size-6" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-ink-900">
                Accompagnement en {c.domainName.toLowerCase()}
              </p>
              <p className="text-[13px] text-foreground">
                Talents Connectés · Mentoré : {c.menteeName}
              </p>
              <p className="text-[13px] text-muted-foreground">
                Délivré le {formatDate(c.issuedAt)} · {stats(c).join(' · ')}
              </p>
              <Link
                href={`/certificats/${c.code}`}
                className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold text-ink-900 ring-1 ring-ink-900 ring-inset transition-colors hover:bg-background"
              >
                <BadgeCheck className="size-4" aria-hidden />
                Afficher le certificat
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Page publique de vérification : le certificat lui-même, imprimable en PDF. */
export function CertificateView({ code }: { code: string }) {
  const { data: c, isPending, isError, error, refetch } = useCertificate(code);
  const [copied, setCopied] = useState(false);

  if (isPending) return <Skeleton className="mx-auto h-[560px] max-w-[900px]" />;
  if (isError) {
    if (isApiError(error) && error.statusCode === 404) {
      return (
        <div className="mx-auto max-w-lg rounded-lg bg-surface p-8 text-center shadow-card ring-1 ring-border/70">
          <ShieldAlert className="mx-auto size-8 text-danger-700" aria-hidden />
          <h1 className="mt-3 font-display text-[22px] font-semibold text-ink-900">
            Certificat introuvable
          </h1>
          <p className="mt-2 text-[15px] text-muted-foreground">
            Aucun certificat ne correspond au code{' '}
            <span className="font-semibold">{code.toUpperCase()}</span>. Vérifiez sa saisie.
          </p>
        </div>
      );
    }
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  }

  const url = typeof window !== 'undefined' ? window.location.href : `/certificats/${c.code}`;

  return (
    <div className="mx-auto grid max-w-[900px] gap-4">
      {/* Statut de vérification */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-lg px-5 py-3.5 ring-1 print:hidden ${
          c.valid
            ? 'bg-success-50 text-success-700 ring-success-700/20'
            : 'bg-danger-50 text-danger-700 ring-danger-700/20'
        }`}
      >
        <p className="flex items-center gap-2 text-[14px] font-semibold">
          {c.valid ? (
            <ShieldCheck className="size-5" aria-hidden />
          ) : (
            <ShieldAlert className="size-5" aria-hidden />
          )}
          {c.valid
            ? `Certificat authentique, délivré par Talents Connectés le ${formatDate(c.issuedAt)}.`
            : 'Ce certificat a été révoqué : il n’est plus valide.'}
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void navigator.clipboard.writeText(url).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
          >
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copied ? 'Lien copié' : 'Copier le lien'}
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer aria-hidden />
            Imprimer ou PDF
          </Button>
        </div>
      </div>

      {/* Le certificat */}
      <article className="certificate relative isolate overflow-hidden rounded-xl bg-surface p-2 shadow-raised ring-1 ring-border/70 print:shadow-none">
        <div className="relative overflow-hidden rounded-lg border-[3px] border-ink-900 px-6 py-10 sm:px-14 sm:py-14">
          <div
            className="absolute inset-x-0 top-0 -z-10 h-24 overflow-hidden bg-ink-900"
            aria-hidden
          >
            <div className="pattern-kente absolute inset-0 opacity-[0.14]" />
            <div className="absolute -top-10 right-24 size-40 rounded-full bg-amber-400/25 blur-2xl" />
          </div>
          <div className="-mt-4 flex items-center justify-between gap-6 sm:-mt-6">
            <div className="flex items-center gap-2.5 text-white">
              <LogoMark className="size-10" />
              <span className="font-display text-[17px] font-bold tracking-[-0.02em]">
                Talents Connectés
              </span>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-[12px] font-semibold ${c.valid ? 'bg-amber-400 text-ink-950' : 'bg-white/20 text-white'}`}
            >
              {c.valid ? 'Certificat vérifié' : 'Révoqué'}
            </span>
          </div>

          <div className="mt-16 text-center sm:mt-20">
            <p className="text-[13px] font-semibold tracking-[0.18em] text-teal-700 uppercase">
              Certificat d’accompagnement
            </p>
            <p className="mt-6 text-[15px] text-muted-foreground">décerné à</p>
            <div className="mt-3 flex items-center justify-center gap-3">
              {c.mentor.id && (
                <Avatar
                  person={{
                    id: c.mentor.id,
                    firstName: c.mentorName.split(' ')[0] ?? '',
                    lastName: c.mentorName.split(' ').slice(1).join(' '),
                    avatarUpdatedAt: c.mentor.avatarUpdatedAt,
                  }}
                  size="lg"
                />
              )}
              <h1 className="font-display text-[clamp(1.9rem,1.3rem+2.2vw,3rem)] leading-tight font-semibold tracking-[-0.03em] text-ink-900">
                {c.mentorName}
              </h1>
            </div>
            {c.mentor.headline && (
              <p className="mt-1 text-[14px] text-muted-foreground">{c.mentor.headline}</p>
            )}
            <p className="mx-auto mt-6 max-w-[56ch] text-[16px] leading-relaxed text-foreground">
              pour avoir accompagné <span className="font-semibold">{c.menteeName}</span> en{' '}
              <span className="font-semibold">{c.domainName.toLowerCase()}</span>, du{' '}
              {formatDate(c.startedAt)} au {formatDate(c.endedAt)}, dans le cadre du programme de
              mentorat Talents Connectés.
            </p>
          </div>

          <dl className="mx-auto mt-10 grid max-w-[640px] grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { k: 'Séances réalisées', v: String(c.completedSessions) },
              { k: 'Temps d’accompagnement', v: formatDuration(c.totalMinutes) },
              {
                k: 'Objectifs atteints',
                v: c.goalsTotal ? `${c.goalsCompleted}/${c.goalsTotal}` : '—',
              },
              {
                k: 'Note du mentoré',
                v:
                  c.averageRating !== null ? `${c.averageRating.toLocaleString('fr-FR')} / 5` : '—',
              },
            ].map((s) => (
              <div key={s.k} className="rounded-md bg-background px-3 py-3 text-center">
                <dt className="text-[11px] font-medium text-muted-foreground">{s.k}</dt>
                <dd className="mt-1 font-display text-[20px] font-semibold text-ink-900 tabular-nums">
                  {s.v}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-12 flex flex-wrap items-end justify-between gap-6 border-t border-border pt-6">
            <div className="text-[12px] leading-relaxed text-muted-foreground">
              <p className="flex items-center gap-1.5 font-semibold text-ink-900">
                <CalendarRange className="size-4 text-teal-700" aria-hidden />
                Délivré le {formatDate(c.issuedAt)}
              </p>
              <p className="mt-1">
                Chiffres enregistrés par la plateforme à la clôture du mentorat.
              </p>
              <p>Hackathon « Talents connectés », Conakry 2026 · prototype de démonstration.</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-medium text-muted-foreground">Code de vérification</p>
              <p className="font-mono text-[18px] font-bold tracking-[0.08em] text-ink-900">
                {c.code}
              </p>
              <p className="text-[11px] text-muted-foreground">
                à saisir sur /certificats/{c.code}
              </p>
            </div>
          </div>
          <span
            aria-hidden
            className="absolute top-32 right-8 hidden size-24 rotate-[-12deg] items-center justify-center rounded-full border-[3px] border-amber-400/70 text-center text-[11px] leading-tight font-bold tracking-[0.12em] text-amber-500/80 uppercase sm:flex"
          >
            Talents
            <br />
            Connectés
            <br />
            2026
          </span>
        </div>
      </article>

      {c.mentor.id && (
        <p className="text-center text-[14px] print:hidden">
          <Link
            href={`/mentors/${c.mentor.id}`}
            className="font-semibold text-teal-700 hover:underline"
          >
            Voir la fiche de {c.mentorName}
          </Link>
        </p>
      )}
    </div>
  );
}

/** Route /certificats/[code] : le code est lu dans l’URL. */
export function CertificatePage() {
  const { code } = useParams<{ code: string }>();
  return <CertificateView code={code} />;
}
