'use client';

import { ArrowRight, ArrowUpRight, LoaderCircle, Search } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useDeferredValue, useId, useState } from 'react';
import { ErrorState } from '@/components/feedback/states';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { useDomains, useMentors } from '@/features/catalog/api';
import { useReveal } from '@/hooks/use-reveal';
import { formatShortDate, fullName, plural } from '@/lib/format';
import { isCampusFrance } from '@/lib/labels';
import { photos, type Photo } from '@/lib/photos';
import { cn } from '@/lib/utils';

/* ── Image éditoriale (un seul traitement pour toute la page) ─────────────── */

function EdPhoto({
  photo,
  className,
  sizes,
  priority = false,
  drift = false,
}: {
  photo: Photo;
  className?: string;
  sizes: string;
  priority?: boolean;
  drift?: boolean;
}) {
  return (
    <div className={cn('relative overflow-hidden bg-ink-900', className)}>
      <Image
        src={photo.src}
        alt={photo.alt}
        fill
        sizes={sizes}
        priority={priority}
        className={cn('photo object-cover', drift && 'drift')}
      />
    </div>
  );
}

/* ── Recherche vivante : les vrais mentors, pendant la frappe ─────────────── */

const QUICK_PICKS = ['Développement web', 'Business plan', 'Campus France', 'Prise de parole'];

function HeroSearch() {
  const inputId = useId();
  const [q, setQ] = useState('');
  const deferred = useDeferredValue(q.trim());
  const active = deferred.length >= 2;
  const { data, isFetching } = useMentors({ q: active ? deferred : undefined });
  const results = active ? (data?.items ?? []).slice(0, 3) : [];
  const href = active ? `/mentors?q=${encodeURIComponent(deferred)}` : '/mentors';

  return (
    <div data-after-lines className="mt-10 max-w-[38rem]">
      <form
        role="search"
        action="/mentors"
        className="flex items-stretch bg-surface"
        onSubmit={(e) => {
          if (!active) return;
          e.preventDefault();
          window.location.assign(href);
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Que voulez-vous apprendre ?
        </label>
        <span className="flex items-center pl-4 text-muted-foreground" aria-hidden>
          {isFetching && active ? <LoaderCircle className="size-5 animate-spin" /> : <Search className="size-5" />}
        </span>
        <input
          id={inputId}
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Que voulez-vous apprendre ?"
          autoComplete="off"
          className="h-14 min-w-0 flex-1 bg-transparent px-3 text-[17px] text-foreground outline-none placeholder:text-muted-foreground"
        />
        <Button type="submit" size="lg" className="h-14 rounded-none px-5 sm:px-6">
          <span className="sm:hidden">Chercher</span>
          <span className="hidden sm:inline">Trouver un mentor</span>
        </Button>
      </form>

      {!active ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[17px]">
          <span className="text-muted-foreground">Par exemple :</span>
          {QUICK_PICKS.map((pick) => (
            <button
              key={pick}
              type="button"
              onClick={() => setQ(pick)}
              className="ed-link font-semibold text-ink-900 transition-colors hover:text-teal-700"
            >
              {pick}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-1 bg-surface" aria-live="polite">
          {results.length === 0 && !isFetching ? (
            <p className="px-4 py-4 text-[17px] text-muted-foreground">
              Aucun mentor ne correspond encore à « {deferred} ». Essayez un autre mot, ou{' '}
              <Link href="/mentors" className="ed-link font-semibold text-ink-900">
                parcourez l’annuaire
              </Link>
              .
            </p>
          ) : (
            <ul>
              {results.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/mentors/${m.id}`}
                    className="group grid grid-cols-[1fr_auto] items-baseline gap-x-4 px-4 py-3 transition-colors hover:bg-ink-50"
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold text-ink-900">{fullName(m)}</span>
                      <span className="block truncate text-[17px] text-muted-foreground">{m.headline}</span>
                    </span>
                    <span className="text-sm font-semibold whitespace-nowrap text-teal-700">
                      {m.nextAvailableAt ? `Libre le ${formatShortDate(m.nextAvailableAt)}` : 'Voir le profil'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {data && data.total > 0 && (
            <Link
              href={href}
              className="flex items-center justify-between bg-ink-900 px-4 py-3 text-[17px] font-semibold text-white transition-colors hover:bg-ink-800"
            >
              {data.total > results.length
                ? `Voir les ${data.total} mentors pour « ${deferred} »`
                : `Ouvrir l’annuaire filtré sur « ${deferred} »`}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Première page : mosaïque, titre sur l'axe, recherche ─────────────────── */

function Masthead() {
  return (
    <section aria-labelledby="titre-accueil" className="bg-background">
      {/* Mosaïque sans gouttière : photographies et aplats butés */}
      <div className="grid h-[34svh] min-h-56 grid-cols-4 grid-rows-2 sm:h-[36svh] sm:grid-cols-6 sm:grid-rows-1">
        <EdPhoto
          photo={photos.conakry}
          priority
          drift
          sizes="(min-width: 640px) 50vw, 100vw"
          className="col-span-4 sm:col-span-3 [&_img]:object-[50%_78%]"
        />
        <div className="hidden flex-col justify-end bg-teal-700 p-5 text-white sm:flex">
          <p className="text-[17px] leading-snug font-semibold">
            Né au Salon international du livre de jeunesse de Conakry
          </p>
        </div>
        <EdPhoto photo={photos.portrait} priority sizes="(min-width: 640px) 17vw, 50vw" className="col-span-2 sm:col-span-1 [&_img]:object-[50%_15%]" />
        <EdPhoto photo={photos.autrices} priority sizes="(min-width: 640px) 17vw, 50vw" className="col-span-2 sm:col-span-1" />
      </div>

      <div className="page-frame grid gap-8 pt-10 pb-20 sm:pt-12 lg:grid-cols-[var(--axis)_1fr] lg:gap-0 lg:pb-28">
        <p
          data-after-lines
          className="order-2 max-w-[32ch] self-end text-[17px] leading-relaxed text-foreground lg:order-1 lg:pr-10 lg:pb-3"
        >
          La plateforme de mentorat qui relie étudiants, jeunes diplômés et porteurs de projets à des
          professionnels de Guinée prêts à transmettre ce qu’ils ont appris.
        </p>
        <div className="order-1 lg:order-2">
          <h1
            id="titre-accueil"
            className="lines text-[clamp(3.25rem,1rem+6.2vw,6.75rem)] leading-[0.9] font-extrabold tracking-[-0.05em] whitespace-nowrap text-ink-900"
          >
            <span className="line">
              <span data-line style={{ ['--i' as string]: 0 }}>
                Trouvez
              </span>
            </span>
            <span className="line">
              <span data-line style={{ ['--i' as string]: 1 }}>
                votre mentor.
              </span>
            </span>
          </h1>
          <HeroSearch />
        </div>
      </div>
    </section>
  );
}

/* ── Le constat (paragraphe à droite, photo isolée) ───────────────────────── */

function Intro() {
  return (
    <section aria-label="Pourquoi le mentorat" className="page-frame py-24 lg:py-40">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-x-6">
        <p
          data-reveal
          className="text-[clamp(1.375rem,1rem+1.2vw,2rem)] leading-[1.25] font-medium text-ink-900 lg:col-span-6 lg:col-start-7 lg:indent-[3em]"
        >
          Beaucoup de jeunes ont l’ambition, pas encore le réseau. Des professionnels sont prêts à
          transmettre. Talents Connectés organise la rencontre, puis la suit jusqu’à l’objectif.
        </p>
        <div className="grid grid-cols-[1fr_62%] items-end gap-4 lg:col-span-12 lg:grid-cols-12 lg:gap-x-6">
          <p data-reveal style={{ ['--d' as string]: 2 }} className="text-sm leading-relaxed text-muted-foreground lg:order-2 lg:col-span-2 lg:col-start-1 lg:mt-24 lg:self-start">
            {photos.classe.caption}.
          </p>
          <div data-reveal className="lg:order-1 lg:col-span-3 lg:col-start-1 lg:row-start-1">
            <EdPhoto photo={photos.classe} sizes="(min-width: 1024px) 22vw, 60vw" className="aspect-[4/5] lg:aspect-square" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Les domaines, comme une table des matières ───────────────────────────── */

function DomainsTable() {
  const { data, isPending, isError, error, refetch } = useDomains();
  useReveal([data]);

  return (
    <section id="domaines" aria-labelledby="titre-domaines" className="scroll-mt-20 bg-surface py-24 lg:py-40">
      <div className="page-frame">
        <h2
          id="titre-domaines"
          data-reveal
          className="max-w-[18ch] text-[length:var(--step-head)] leading-[0.98] font-extrabold tracking-[-0.04em] text-ink-900 lg:indent-[3vw]"
        >
          Sept domaines pour avancer
        </h2>

        <div className="mt-16 grid gap-12 lg:mt-24 lg:grid-cols-12 lg:gap-x-6">
          <div className="hidden lg:col-span-4 lg:block lg:self-end">
            <div data-reveal>
              <EdPhoto photo={photos.portrait} sizes="22vw" className="aspect-[4/5] [&_img]:object-[50%_12%]" />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{photos.portrait.caption}.</p>
          </div>

          <div className="lg:col-span-7 lg:col-start-6">
            {isError ? (
              <ErrorState error={error} onRetry={() => void refetch()} />
            ) : (
              <ul className="grid">
                {isPending
                  ? Array.from({ length: 7 }).map((_, i) => (
                      <li key={i} className="py-4">
                        <Skeleton className="h-6" />
                      </li>
                    ))
                  : data.map((d, i) => (
                      <li key={d.id} data-reveal style={{ ['--d' as string]: i % 4 }} className={cn(i > 0 && i % 4 === 0 && 'mt-8')}>
                        <Link
                          href={`/mentors?domain=${d.slug}`}
                          className="group grid grid-cols-[1fr_auto] items-baseline gap-x-6 py-4 transition-colors sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto]"
                        >
                          <span className="text-[17px] font-semibold text-ink-900 transition-colors group-hover:text-teal-700">
                            {d.name}
                          </span>
                          <span className="hidden truncate text-[17px] text-muted-foreground sm:block">
                            {d.topics.slice(0, 2).join(' · ')}
                          </span>
                          <span className="flex items-center gap-1.5 text-[17px] font-semibold whitespace-nowrap text-teal-700 tabular-nums">
                            {d.mentorCount === 0 ? 'Bientôt' : plural(d.mentorCount, 'mentor')}
                            <ArrowRight
                              className="size-4 transition-transform duration-200 group-hover:translate-x-1"
                              aria-hidden
                            />
                          </span>
                          {isCampusFrance(d.slug) && (
                            <span className="col-span-full mt-1 text-[17px] text-[#7a4a0f]">
                              Conseil et orientation, sans garantie d’admission ni de visa.
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Le fonctionnement, en escalier ───────────────────────────────────────── */

const STAGES = [
  {
    line: 'Vous dites ce que vous visez.',
    text: 'Votre situation, vos domaines, ce que vous voulez apprendre. Deux minutes suffisent.',
    start: 'lg:col-start-1',
  },
  {
    line: 'Vous choisissez un mentor.',
    text: 'L’annuaire et les suggestions expliquent pourquoi chaque profil vous correspond.',
    start: 'lg:col-start-3',
  },
  {
    line: 'Il accepte votre demande.',
    text: 'Votre message motivé arrive au bon mentor, qui décide. La conversation privée s’ouvre.',
    start: 'lg:col-start-5',
  },
  {
    line: 'Vous avancez à deux.',
    text: 'Séances réservées sans conflit, salle de visio, objectifs découpés en jalons et suivis.',
    start: 'lg:col-start-7',
  },
];

function HowItWorks() {
  return (
    <section id="fonctionnement" aria-label="Comment ça marche" className="page-frame scroll-mt-20 py-24 lg:py-40">
      <ol className="grid gap-10 sm:gap-14 lg:grid-cols-12 lg:gap-x-6">
        {STAGES.map((s, i) => (
          <li
            key={s.line}
            data-reveal
            className={cn('pl-[calc(var(--i)*6vw)] lg:col-span-6 lg:pl-0', s.start)}
            style={{ ['--i' as string]: i }}
          >
            {i === 0 ? (
              <h2 className="text-[clamp(2.1rem,1rem+3.6vw,4.4rem)] leading-none font-extrabold tracking-[-0.045em] text-ink-900">
                {s.line}
              </h2>
            ) : (
              <p
                className={cn(
                  'text-[clamp(2.1rem,1rem+3.6vw,4.4rem)] leading-none font-extrabold tracking-[-0.045em]',
                  i === STAGES.length - 1 ? 'text-teal-700' : 'text-ink-900',
                )}
              >
                {s.line}
              </p>
            )}
            <p className="mt-3 max-w-[34ch] text-[17px] leading-relaxed text-foreground">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ── Le cadre de confiance, en tableau ────────────────────────────────────── */

const GUARANTEES = [
  ['Mentors', 'Vérification humaine', 'Profils examinés par l’équipe, jamais de validation automatique de diplômes'],
  ['Échanges', 'Conversation privée', 'Ouverte après acceptation, visible des deux seuls participants'],
  ['Séances', 'Aucune double réservation', 'Un créneau ne peut être pris qu’une fois, même en cas de clics simultanés'],
  ['Visio', 'Salle privée générée', 'Lien Jitsi Meet unique à chaque séance confirmée, service externe'],
  ['Suivi', 'Objectifs et jalons', 'Progression calculée, retours écrits du mentor, évaluation des séances'],
  ['Données', 'Contrôle par la personne', 'Coordonnées jamais publiques, export et suppression du compte'],
  ['Campus France', 'Conseil honnête', 'Orientation et partage d’expérience, sans garantie d’admission ni de visa'],
];

function Guarantees() {
  return (
    <section aria-labelledby="titre-confiance" className="bg-surface py-24 lg:py-40">
      <div className="page-frame">
        <h2
          id="titre-confiance"
          data-reveal
          className="text-[length:var(--step-head)] leading-[0.98] font-extrabold tracking-[-0.04em] text-ink-900"
        >
          Un cadre
          <br />
          <span className="lg:ml-[16.66%]">de confiance</span>
        </h2>
        <div data-reveal className="mt-14 lg:mt-20">
          <table className="block w-full border-collapse text-left text-[17px] sm:table">
            <caption className="sr-only">Les garanties de la plateforme</caption>
            <thead className="sr-only">
              <tr>
                <th scope="col">Domaine</th>
                <th scope="col">Garantie</th>
                <th scope="col">Ce que cela veut dire</th>
              </tr>
            </thead>
            <tbody className="block sm:table-row-group">
              {GUARANTEES.map(([area, title, detail], i) => (
                <tr key={area} className={cn('grid gap-1 px-4 py-4 sm:table-row sm:p-0', i % 2 === 1 && 'bg-background')}>
                  <th scope="row" className="text-sm font-semibold text-muted-foreground sm:w-[18%] sm:px-4 sm:py-4 sm:align-top sm:text-[17px]">
                    {area}
                  </th>
                  <td className="font-semibold text-ink-900 sm:w-[30%] sm:px-4 sm:py-4 sm:align-top">{title}</td>
                  <td className="text-foreground sm:px-4 sm:py-4 sm:align-top">{detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/* ── L'appel : trois photographies, puis un aplat ─────────────────────────── */

function Closing() {
  return (
    <section aria-labelledby="titre-mentor">
      <div className="grid grid-cols-2 sm:grid-cols-3">
        <EdPhoto photo={photos.jeunes} sizes="(min-width: 640px) 33vw, 100vw" className="col-span-2 aspect-[4/3] sm:col-span-1 sm:aspect-auto sm:h-[40svh]" />
        <EdPhoto photo={photos.formation} sizes="(min-width: 640px) 33vw, 50vw" className="aspect-[4/3] sm:aspect-auto sm:h-[40svh]" />
        <EdPhoto photo={photos.autrices} sizes="(min-width: 640px) 33vw, 50vw" className="aspect-[4/3] sm:aspect-auto sm:h-[40svh]" />
      </div>
      <div className="bg-teal-700 py-20 text-white lg:min-h-[44svh] lg:py-24">
        <div className="page-frame grid gap-10 lg:grid-cols-12 lg:gap-x-6">
          <div data-reveal className="lg:col-span-7">
            <h2 id="titre-mentor" className="sr-only">Devenir mentor</h2>
            <p className="text-[clamp(1.375rem,1rem+1.2vw,2rem)] leading-[1.25] font-semibold tracking-[-0.02em]">
              Votre expérience peut changer un parcours.{' '}
              <Link
                href="/inscription?role=MENTOR"
                className="underline decoration-amber-400 decoration-4 underline-offset-[6px] transition-colors hover:text-amber-100"
              >
                Devenez mentor
              </Link>
              , à votre rythme.
            </p>
            <p className="mt-8 max-w-[52ch] text-[17px] leading-relaxed text-teal-50">
              Vous fixez vos créneaux et le nombre de personnes que vous accompagnez. Chaque demande
              arrive avec un objectif clair : vous acceptez celles où vous serez utile.
            </p>
          </div>
          <div data-reveal style={{ ['--d' as string]: 1 }} className="flex flex-col items-start gap-3 lg:col-span-4 lg:col-start-9 lg:items-end lg:self-end">
            <Button asChild size="lg" className="bg-white text-ink-900 hover:bg-teal-50">
              <Link href="/inscription">
                Créer un compte
                <ArrowUpRight aria-hidden />
              </Link>
            </Button>
            <Link href="/mentors" className="ed-link text-[17px] font-semibold text-white">
              Ou parcourir l’annuaire
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Landing() {
  useReveal();
  return (
    <>
      <Masthead />
      <Intro />
      <DomainsTable />
      <HowItWorks />
      <Guarantees />
      <Closing />
    </>
  );
}
