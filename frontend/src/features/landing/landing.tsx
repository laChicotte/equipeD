'use client';

import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarCheck2,
  LoaderCircle,
  Lock,
  MessagesSquare,
  Pause,
  Play,
  Search,
  ShieldCheck,
  Target,
  Video,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useDeferredValue, useEffect, useId, useMemo, useState } from 'react';
import { DomainIcon } from '@/components/domain-icon';
import { ErrorState } from '@/components/feedback/states';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/misc';
import { useDomains, useMentors } from '@/features/catalog/api';
import { useReveal } from '@/hooks/use-reveal';
import { formatShortDate, fullName, plural } from '@/lib/format';
import { isCampusFrance } from '@/lib/labels';
import { photos, type Photo } from '@/lib/photos';
import { cn } from '@/lib/utils';

/* ── Briques communes ─────────────────────────────────────────────────────── */

function Shot({
  photo,
  className,
  sizes,
  priority = false,
  imgClassName,
}: {
  photo: Photo;
  className?: string;
  sizes: string;
  priority?: boolean;
  imgClassName?: string;
}) {
  return (
    <figure className={cn('relative overflow-hidden bg-ink-900', className)}>
      <Image
        src={photo.src}
        alt={photo.alt}
        fill
        sizes={sizes}
        priority={priority}
        className={cn('photo object-cover', imgClassName)}
      />
    </figure>
  );
}

function PrimaryLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'notch group inline-flex h-13 items-center gap-3 bg-teal-600 pr-7 pl-6 text-[16px] font-semibold text-white transition-colors duration-200 hover:bg-teal-700 active:scale-[0.98]',
        className,
      )}
    >
      {children}
      <ArrowRight
        className="size-4 transition-transform duration-200 group-hover:translate-x-1"
        aria-hidden
      />
    </Link>
  );
}

function SectionTitle({
  id,
  children,
  className,
  light = false,
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
  light?: boolean;
}) {
  return (
    <h2
      id={id}
      data-reveal
      className={cn(
        'font-display text-[clamp(2.25rem,1.2rem+3.4vw,4.5rem)] leading-[0.98] font-semibold tracking-[-0.035em]',
        light ? 'text-white' : 'text-ink-900',
        className,
      )}
    >
      {children}
    </h2>
  );
}

/* ── Recherche vivante (panneau du hero) ──────────────────────────────────── */

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
    <div className="cut-panel relative bg-white px-6 pt-6 pb-6 text-ink-900 sm:px-8 lg:pl-20">
      <label
        htmlFor={inputId}
        className="font-display text-[20px] font-semibold tracking-[-0.02em] text-ink-900"
      >
        Que voulez-vous apprendre ?
      </label>
      <form
        role="search"
        action="/mentors"
        className="mt-3 flex items-stretch"
        onSubmit={(e) => {
          if (!active) return;
          e.preventDefault();
          window.location.assign(href);
        }}
      >
        <span className="flex items-center bg-amber-50 pl-4 text-muted-foreground" aria-hidden>
          {isFetching && active ? (
            <LoaderCircle className="size-5 animate-spin" />
          ) : (
            <Search className="size-5" />
          )}
        </span>
        <input
          id={inputId}
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Développement web, CV, business plan…"
          autoComplete="off"
          className="h-14 min-w-0 flex-1 bg-amber-50 px-3 text-[16px] text-ink-900 outline-none placeholder:text-ink-700/60"
        />
        <button
          type="submit"
          className="notch inline-flex h-14 items-center gap-2 bg-teal-600 pr-6 pl-5 text-[16px] font-semibold text-white transition-colors hover:bg-teal-700 active:scale-[0.98]"
        >
          <span className="hidden sm:inline">Trouver mon mentor</span>
          <span className="sm:hidden">Chercher</span>
          <ArrowRight className="size-4" aria-hidden />
        </button>
      </form>

      {!active ? (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[14px]">
          {QUICK_PICKS.map((pick) => (
            <button
              key={pick}
              type="button"
              onClick={() => setQ(pick)}
              className="font-semibold text-ink-700 underline decoration-ink-100 underline-offset-4 transition-colors hover:text-teal-700 hover:decoration-teal-600"
            >
              {pick}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-3" aria-live="polite">
          {results.length === 0 && !isFetching ? (
            <p className="text-[15px] text-muted-foreground">
              Aucun mentor pour « {deferred} » pour l’instant.{' '}
              <Link
                href="/mentors"
                className="font-semibold text-teal-700 underline underline-offset-4"
              >
                Voir tout l’annuaire
              </Link>
            </p>
          ) : (
            <ul className="grid gap-1">
              {results.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/mentors/${m.id}`}
                    className="flex items-center gap-3 px-2 py-2 transition-colors hover:bg-ink-50"
                  >
                    <Avatar person={m} className="size-9 text-[13px]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">
                        {fullName(m)}
                      </span>
                      <span className="block truncate text-[13px] text-muted-foreground">
                        {m.headline}
                      </span>
                    </span>
                    {m.nextAvailableAt && (
                      <span className="hidden text-[13px] font-semibold whitespace-nowrap text-teal-700 sm:inline">
                        {formatShortDate(m.nextAvailableAt)}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {data && data.total > 3 && (
            <Link
              href={href}
              className="mt-2 inline-flex items-center gap-1 text-[14px] font-semibold text-teal-700"
            >
              Voir les {data.total} mentors <ArrowRight className="size-4" aria-hidden />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Hero : diaporama plein écran ─────────────────────────────────────────── */

const SLIDES: { photo: Photo; label: string; position: string }[] = [
  { photo: photos.lyceennes, label: 'Jeunes talents', position: 'object-[50%_35%]' },
  { photo: photos.mentor, label: 'Transmission', position: 'object-[50%_30%]' },
  { photo: photos.conakryCentre, label: 'Conakry', position: 'object-[50%_60%]' },
];
const SLIDE_MS = 7000;

function Hero() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = window.setTimeout(() => setIndex((i) => (i + 1) % SLIDES.length), SLIDE_MS);
    return () => window.clearTimeout(t);
  }, [index, paused]);

  return (
    <section
      aria-labelledby="titre-accueil"
      className="relative isolate -mt-16 min-h-[calc(100svh-2rem)] overflow-hidden bg-ink-950 text-white"
    >
      {/* Diaporama */}
      {SLIDES.map((s, i) => (
        <div
          key={s.photo.src}
          aria-hidden={i !== index}
          className={cn(
            'absolute inset-0 -z-10 transition-opacity duration-[1400ms] ease-out',
            i === index ? 'opacity-100' : 'opacity-0',
          )}
        >
          <Image
            src={s.photo.src}
            alt={i === index ? s.photo.alt : ''}
            fill
            priority={i === 0}
            sizes="100vw"
            className={cn('photo object-cover', s.position, i === index && 'drift')}
          />
        </div>
      ))}
      {/* Voile neutre sous le texte (lisibilité) */}
      <div className="absolute inset-0 -z-10 bg-ink-950/55" aria-hidden />
      <div
        className="absolute inset-y-0 left-0 -z-10 w-full bg-[linear-gradient(90deg,rgb(11_32_26/0.85),rgb(11_32_26/0.35)_60%,transparent)] lg:w-3/4"
        aria-hidden
      />

      <div className="page-frame flex min-h-[calc(100svh-2rem)] flex-col justify-end pt-28 pb-0 lg:pt-32">
        <div className="max-w-[60rem] pb-10 lg:pb-12">
          <h1 id="titre-accueil" className="lines font-display font-semibold tracking-[-0.04em]">
            <span className="line">
              <span
                data-line
                style={{ ['--i' as string]: 0 }}
                className="text-[clamp(1.5rem,1rem+2vw,2.75rem)] leading-[1.1] text-white/90"
              >
                Le mentorat à l’ère du numérique :
              </span>
            </span>
            <span className="line">
              <span
                data-line
                style={{ ['--i' as string]: 1 }}
                className="text-[clamp(3.25rem,1.2rem+7vw,7.5rem)] leading-[0.95]"
              >
                trouvez votre mentor.
              </span>
            </span>
          </h1>
          <p
            data-after-lines
            className="mt-6 max-w-[46ch] text-[clamp(1.0625rem,1rem+0.4vw,1.3rem)] leading-relaxed text-white/90"
          >
            Étudiants, jeunes diplômés, porteurs de projets : avancez avec des professionnels de
            Guinée qui ont déjà fait le chemin, de la première demande jusqu’à l’objectif atteint.
          </p>
          <div data-after-lines className="mt-8 flex flex-wrap items-center gap-4">
            <PrimaryLink href="/mentors">Trouver un mentor</PrimaryLink>
            <Link
              href="/inscription?role=MENTOR"
              className="inline-flex h-13 items-center border-2 border-white/80 px-6 text-[16px] font-semibold text-white transition-colors hover:bg-white hover:text-ink-900"
            >
              Devenir mentor
            </Link>
          </div>
        </div>

        {/* Bas du hero : indicateurs du diaporama + panneau de recherche */}
        <div className="grid items-end gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:gap-10">
          <div className="hidden items-end gap-4 pb-8 lg:flex">
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              className="inline-flex size-11 shrink-0 items-center justify-center bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label={paused ? 'Relancer le diaporama' : 'Mettre le diaporama en pause'}
            >
              {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
            </button>
            {SLIDES.map((s, i) => (
              <button
                key={s.label}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Afficher la photo : ${s.label}`}
                aria-pressed={i === index}
                className="group w-40 text-left"
              >
                <span className="relative block h-0.5 w-full overflow-hidden bg-white/30">
                  {i === index && (
                    <span
                      key={`${index}-${paused}`}
                      className="absolute inset-y-0 left-0 bg-amber-400"
                      style={{
                        width: paused ? '100%' : undefined,
                        animation: paused
                          ? undefined
                          : `slide-progress ${SLIDE_MS}ms linear forwards`,
                      }}
                    />
                  )}
                </span>
                <span
                  className={cn(
                    'mt-3 block text-[14px] font-semibold transition-colors',
                    i === index ? 'text-white' : 'text-white/60 group-hover:text-white',
                  )}
                >
                  {s.label}
                </span>
              </button>
            ))}
          </div>
          <div
            data-after-lines
            className="-mx-[var(--page-x)] lg:mx-0 lg:mr-[calc(var(--page-x)*-1)]"
          >
            <HeroSearch />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Un seul espace : chiffres réels ──────────────────────────────────────── */

function Overview() {
  const mentors = useMentors({});
  const domains = useDomains();
  const stats = useMemo(() => {
    const items = mentors.data?.items ?? [];
    return {
      mentors: mentors.data?.total,
      domains: domains.data?.length,
      languages: new Set(items.flatMap((m) => m.languages)).size || undefined,
      cities: new Set(items.map((m) => m.city).filter(Boolean)).size || undefined,
    };
  }, [mentors.data, domains.data]);

  const figures = [
    { value: stats.mentors, label: 'mentors disponibles' },
    { value: stats.domains, label: 'domaines d’accompagnement' },
    { value: stats.languages, label: 'langues parlées, dont soussou, pular et malinké' },
    { value: stats.cities, label: 'villes, et partout à distance' },
  ];

  return (
    <section aria-labelledby="titre-espace" className="bg-background py-24 lg:py-32">
      <div className="page-frame">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-x-8">
          <SectionTitle id="titre-espace" className="lg:col-span-6">
            Un seul espace pour avancer
          </SectionTitle>
          <div
            data-reveal
            style={{ ['--d' as string]: 1 }}
            className="lg:col-span-5 lg:col-start-8 lg:pt-3"
          >
            <p className="text-[clamp(1.0625rem,1rem+0.3vw,1.25rem)] leading-relaxed text-foreground">
              Beaucoup de jeunes ont des idées et de l’ambition, mais pas encore le réseau ni les
              conseils pour les concrétiser. TalentsConnect réunit tout l’accompagnement : trouver
              le bon mentor, échanger en privé, planifier les séances et suivre ses objectifs.
            </p>
            <Link
              href="#domaines"
              className="mt-6 inline-flex items-center gap-2 text-[16px] font-semibold text-teal-700 hover:text-teal-800"
            >
              Découvrir les domaines <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-[1.4fr_1fr] lg:mt-20">
          <Shot
            photo={photos.conakryCentre}
            sizes="(min-width: 640px) 58vw, 100vw"
            className="aspect-[16/10]"
          />
          <Shot
            photo={photos.eleves}
            sizes="(min-width: 640px) 40vw, 100vw"
            className="aspect-[16/10] sm:aspect-auto"
          />
        </div>

        <dl className="mt-14 grid grid-cols-2 gap-x-6 gap-y-10 lg:mt-20 lg:grid-cols-4">
          {figures.map((f, i) => (
            <div
              key={f.label}
              data-reveal
              style={{ ['--d' as string]: i }}
              className="border-l-2 border-teal-600 pl-5"
            >
              <dt className="sr-only">{f.label}</dt>
              <dd>
                <span className="block font-display text-[clamp(3rem,2rem+3vw,5rem)] leading-none font-semibold tracking-[-0.04em] text-ink-900 tabular-nums">
                  {f.value ?? <Skeleton className="h-14 w-20" />}
                </span>
                <span className="mt-3 block max-w-[22ch] text-[15px] leading-snug text-muted-foreground">
                  {f.label}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ── Les domaines ─────────────────────────────────────────────────────────── */

function Domains() {
  const { data, isPending, isError, error, refetch } = useDomains();
  useReveal([data]);

  return (
    <section
      id="domaines"
      aria-labelledby="titre-domaines"
      className="scroll-mt-20 bg-white py-24 lg:py-32"
    >
      <div className="page-frame grid gap-12 lg:grid-cols-12 lg:gap-x-10">
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-28">
            <SectionTitle
              id="titre-domaines"
              className="text-[clamp(2.25rem,1.2rem+2.6vw,3.75rem)]"
            >
              Sept domaines pour avancer
            </SectionTitle>
            <p
              data-reveal
              className="mt-6 max-w-[42ch] text-[17px] leading-relaxed text-foreground"
            >
              Les domaines du programme « Talents connectés », de l’orientation à l’entrepreneuriat.
              Chaque mentor indique ses spécialités : vous trouvez la bonne personne pour votre
              objectif.
            </p>
            <Shot
              photo={photos.mentor}
              sizes="(min-width: 1024px) 36vw, 100vw"
              className="mt-10 aspect-[4/3]"
            />
            <p className="mt-3 text-[13px] text-muted-foreground">{photos.mentor.caption}</p>
          </div>
        </div>

        <div className="lg:col-span-7">
          {isError ? (
            <ErrorState error={error} onRetry={() => void refetch()} />
          ) : (
            <ul className="divide-y divide-border border-y border-border">
              {isPending
                ? Array.from({ length: 7 }).map((_, i) => (
                    <li key={i} className="py-6">
                      <Skeleton className="h-8" />
                    </li>
                  ))
                : data.map((d) => (
                    <li key={d.id} data-reveal>
                      <Link
                        href={`/mentors?domain=${d.slug}`}
                        className="group grid grid-cols-[auto_1fr_auto] items-start gap-x-5 py-6 transition-colors duration-200 hover:bg-background sm:px-3"
                      >
                        <span className="mt-0.5 inline-flex size-11 items-center justify-center bg-ink-900 text-amber-400 transition-colors duration-200 group-hover:bg-teal-600 group-hover:text-white">
                          <DomainIcon name={d.icon} className="size-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-display text-[clamp(1.125rem,1rem+0.5vw,1.5rem)] leading-tight font-semibold tracking-[-0.02em] text-ink-900">
                            {d.name}
                          </span>
                          <span className="mt-1.5 block text-[15px] leading-snug text-muted-foreground">
                            {d.topics.slice(0, 3).join(' · ')}
                          </span>
                          {isCampusFrance(d.slug) && (
                            <span className="mt-2 block text-[14px] font-medium text-[#8a5410]">
                              Conseil et orientation, sans garantie d’admission ni de visa.
                            </span>
                          )}
                        </span>
                        <span className="mt-1 flex items-center gap-2 text-[15px] font-semibold whitespace-nowrap text-teal-700">
                          {d.mentorCount === 0 ? 'Bientôt' : plural(d.mentorCount, 'mentor')}
                          <ArrowRight
                            className="size-4 transition-transform duration-200 group-hover:translate-x-1"
                            aria-hidden
                          />
                        </span>
                      </Link>
                    </li>
                  ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── Le parcours, de la demande à la séance ───────────────────────────────── */

const STEPS = [
  {
    photo: photos.eleves,
    title: 'Votre objectif',
    text: 'Décrivez votre situation, vos domaines et ce que vous voulez apprendre. Deux minutes.',
  },
  {
    photo: photos.lyceennes,
    title: 'Le bon mentor',
    text: 'Recherche, filtres et suggestions expliquées : vous savez pourquoi un profil vous correspond.',
  },
  {
    photo: photos.mentor,
    title: 'Une demande acceptée',
    text: 'Votre message motivé arrive au mentor, qui décide. La conversation privée s’ouvre.',
  },
  {
    photo: photos.communaute,
    title: 'Des séances et des objectifs',
    text: 'Créneaux réservés sans conflit, salle de visio, jalons suivis à deux jusqu’au résultat.',
  },
];

function Journey() {
  return (
    <section
      id="fonctionnement"
      aria-labelledby="titre-parcours"
      className="scroll-mt-20 bg-ink-900 py-24 text-white lg:py-32"
    >
      <div className="page-frame">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <SectionTitle id="titre-parcours" light className="lg:col-span-7">
            De la demande à la première séance
          </SectionTitle>
          <p
            data-reveal
            className="max-w-[44ch] text-[17px] leading-relaxed text-ink-100 lg:col-span-4 lg:col-start-9"
          >
            Chaque étape est enregistrée : mentoré et mentor savent toujours où en est
            l’accompagnement.
          </p>
        </div>
        <ol className="mt-14 grid gap-6 sm:grid-cols-2 lg:mt-20 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} data-reveal style={{ ['--d' as string]: i }} className="group">
              <Shot
                photo={s.photo}
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                className="aspect-[4/5]"
                imgClassName="transition-transform duration-700 ease-out group-hover:scale-105"
              />
              <div className="mt-5 flex items-start gap-4">
                <span
                  className="font-display text-[44px] leading-none font-semibold text-amber-400 tabular-nums"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-display text-[20px] leading-tight font-semibold tracking-[-0.02em]">
                    <span className="sr-only">Étape {i + 1} : </span>
                    {s.title}
                  </h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-100">{s.text}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ── Les mentors (profils réels de la base de démonstration) ──────────────── */

const AVATAR_TINTS = [
  'bg-teal-100 text-teal-800',
  'bg-amber-100 text-[#7a4a0f]',
  'bg-ink-100 text-ink-900',
  'bg-[#f3e1e1] text-[#7a1f1f]',
];

function Mentors() {
  const { data, isPending } = useMentors({});
  useReveal([data]);
  const items = (data?.items ?? []).slice(0, 4);

  return (
    <section aria-labelledby="titre-mentors" className="bg-background py-24 lg:py-32">
      <div className="page-frame">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionTitle id="titre-mentors">Ils transmettent</SectionTitle>
          <Link
            href="/mentors"
            className="inline-flex items-center gap-2 text-[16px] font-semibold text-teal-700 hover:text-teal-800"
          >
            Voir tout l’annuaire <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <p data-reveal className="mt-4 max-w-[60ch] text-[15px] text-muted-foreground">
          Des professionnels de Guinée prêts à transmettre leur expérience.
        </p>
        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {isPending
            ? Array.from({ length: 4 }).map((_, i) => (
                <li key={i}>
                  <Skeleton className="h-72" />
                </li>
              ))
            : items.map((m, i) => (
                <li key={m.id} data-reveal style={{ ['--d' as string]: i }}>
                  <Link
                    href={`/mentors/${m.id}`}
                    className="group flex h-full flex-col bg-white p-6 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-raised"
                  >
                    <div className="flex items-center justify-between">
                      <Avatar
                        person={m}
                        className={cn(
                          'size-16 text-[20px] ring-0',
                          !m.avatarUpdatedAt && AVATAR_TINTS[i % AVATAR_TINTS.length],
                        )}
                      />
                      {m.verificationStatus === 'VERIFIED' && (
                        <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#8a5410]">
                          <BadgeCheck className="size-4 text-amber-500" aria-hidden /> Vérifié
                        </span>
                      )}
                    </div>
                    <p className="mt-5 font-display text-[20px] leading-tight font-semibold tracking-[-0.02em] text-ink-900">
                      {fullName(m)}
                    </p>
                    <p className="mt-2 line-clamp-3 text-[15px] leading-snug text-foreground">
                      {m.headline}
                    </p>
                    <p className="mt-4 text-[13px] text-muted-foreground">
                      {m.yearsExperience} ans d’expérience · {m.city ?? 'À distance'}
                    </p>
                    <span className="mt-auto inline-flex items-center gap-2 pt-6 text-[15px] font-semibold text-teal-700">
                      Voir le profil
                      <ArrowRight
                        className="size-4 transition-transform duration-200 group-hover:translate-x-1"
                        aria-hidden
                      />
                    </span>
                  </Link>
                </li>
              ))}
        </ul>
      </div>
    </section>
  );
}

/* ── Un cadre de confiance ────────────────────────────────────────────────── */

const GUARANTEES = [
  {
    icon: ShieldCheck,
    title: 'Mentors vérifiés',
    text: 'Profils examinés par l’équipe, jamais de validation automatique de diplômes.',
  },
  {
    icon: Lock,
    title: 'Échanges privés',
    text: 'La conversation s’ouvre après acceptation, visible des deux seuls participants.',
  },
  {
    icon: CalendarCheck2,
    title: 'Zéro double réservation',
    text: 'Un créneau ne peut être pris qu’une fois, même en cas de clics simultanés.',
  },
  {
    icon: Video,
    title: 'Appels dans l’application',
    text: 'Appel audio léger, pensé pour les réseaux mobiles, ou vidéo ; une salle de visio est aussi créée pour chaque séance à distance.',
  },
  {
    icon: Target,
    title: 'Objectifs suivis',
    text: 'Jalons, progression, retours écrits du mentor et évaluation des séances.',
  },
  {
    icon: MessagesSquare,
    title: 'Vos données, vos choix',
    text: 'Coordonnées jamais publiques, export et suppression du compte à tout moment.',
  },
];

function Trust() {
  return (
    <section aria-labelledby="titre-confiance" className="bg-white py-24 lg:py-32">
      <div className="page-frame">
        <SectionTitle id="titre-confiance" className="max-w-[16ch]">
          Un cadre de confiance pour les deux
        </SectionTitle>
        <ul className="mt-14 grid gap-px bg-border sm:grid-cols-2 lg:mt-20 lg:grid-cols-3">
          {GUARANTEES.map(({ icon: Icon, title, text }, i) => (
            <li
              key={title}
              data-reveal
              style={{ ['--d' as string]: i % 3 }}
              className="bg-white p-8 transition-colors duration-300 hover:bg-background"
            >
              <Icon className="size-7 text-teal-600" aria-hidden />
              <h3 className="mt-6 font-display text-[20px] font-semibold tracking-[-0.02em] text-ink-900">
                {title}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-foreground">{text}</p>
            </li>
          ))}
        </ul>
        <p data-reveal className="mt-8 max-w-[70ch] text-[14px] text-muted-foreground">
          L’accompagnement Campus France relève du conseil et de l’orientation : il ne garantit ni
          l’admission dans un établissement, ni l’obtention d’un visa.
        </p>
      </div>
    </section>
  );
}

/* ── Appel final ──────────────────────────────────────────────────────────── */

function Closing() {
  return (
    <section
      aria-labelledby="titre-mentor"
      className="relative isolate overflow-hidden bg-teal-700 text-white"
    >
      <div className="absolute inset-y-0 right-0 -z-10 hidden w-1/2 lg:block">
        <Image
          src={photos.loos.src}
          alt={photos.loos.alt}
          fill
          sizes="50vw"
          className="photo object-cover object-[50%_55%]"
        />
      </div>
      <div className="relative bg-teal-700 py-24 lg:w-[62%] lg:py-32 lg:[clip-path:polygon(0_0,100%_0,82%_100%,0_100%)]">
        <div className="page-frame lg:pr-[14%]">
          <SectionTitle id="titre-mentor" light>
            Votre expérience peut changer un parcours.
          </SectionTitle>
          <p data-reveal className="mt-6 max-w-[46ch] text-[17px] leading-relaxed text-teal-50">
            Devenez mentor : vous fixez vos créneaux et le nombre de personnes que vous accompagnez.
            Chaque demande arrive avec un objectif clair, vous acceptez celles où vous serez utile.
          </p>
          <div data-reveal className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/inscription?role=MENTOR"
              className="notch group inline-flex h-13 items-center gap-3 bg-white pr-7 pl-6 text-[16px] font-semibold text-ink-900 transition-colors hover:bg-amber-100 active:scale-[0.98]"
            >
              Devenir mentor
              <ArrowUpRight className="size-4" aria-hidden />
            </Link>
            <Link
              href="/inscription"
              className="inline-flex h-13 items-center border-2 border-white/80 px-6 text-[16px] font-semibold text-white transition-colors hover:bg-white hover:text-ink-900"
            >
              Je cherche un mentor
            </Link>
          </div>
        </div>
      </div>
      <Shot
        photo={photos.loos}
        sizes="100vw"
        className="aspect-[16/10] lg:hidden"
        imgClassName="object-[50%_60%]"
      />
    </section>
  );
}

export function Landing() {
  useReveal();
  return (
    <>
      <Hero />
      <Overview />
      <Domains />
      <Journey />
      <Mentors />
      <Trust />
      <Closing />
    </>
  );
}
