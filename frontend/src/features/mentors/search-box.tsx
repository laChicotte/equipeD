'use client';

import { ArrowUpRight, LoaderCircle, Search, Tag, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { DomainIcon } from '@/components/domain-icon';
import { Avatar } from '@/components/ui/avatar';
import { useAutocomplete } from '@/features/catalog/api';
import { cn } from '@/lib/utils';

type Option =
  | { kind: 'query'; label: string }
  | { kind: 'domain'; slug: string; label: string; icon: string; count: number }
  | { kind: 'skill'; label: string; count: number }
  | {
      kind: 'mentor';
      id: string;
      label: string;
      headline: string;
      person: { firstName: string; lastName: string; avatarUpdatedAt: string | null; id: string };
    };

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** Met en gras la partie du libellé qui correspond à la saisie (sans tenir compte des accents). */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = fold(query.trim());
  const i = q.length >= 2 ? fold(text).indexOf(q) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-transparent font-semibold text-ink-900">
        {text.slice(i, i + q.length)}
      </mark>
      {text.slice(i + q.length)}
    </>
  );
}

export function MentorSearchBox({
  value,
  onChange,
  onSubmit,
  onDomain,
  loading,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Recherche immédiate (Entrée ou choix d'une compétence). */
  onSubmit: (v: string) => void;
  onDomain: (slug: string) => void;
  loading?: boolean;
}) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ac = useAutocomplete(open ? value : '');
  const term = value.trim();

  const options = useMemo<Option[]>(() => {
    if (term.length < 2) return [];
    const d = ac.data;
    return [
      { kind: 'query', label: term },
      ...(d?.domains ?? []).map((x): Option => ({
        kind: 'domain',
        slug: x.slug,
        label: x.name,
        icon: x.icon,
        count: x.mentorCount,
      })),
      ...(d?.skills ?? []).map((x): Option => ({ kind: 'skill', label: x.label, count: x.count })),
      ...(d?.mentors ?? []).map((x): Option => ({
        kind: 'mentor',
        id: x.id,
        label: `${x.firstName} ${x.lastName}`,
        headline: x.headline,
        person: x,
      })),
    ];
  }, [term, ac.data]);

  const choose = (o: Option) => {
    setOpen(false);
    if (o.kind === 'query') onSubmit(o.label);
    else if (o.kind === 'skill') {
      onChange(o.label);
      onSubmit(o.label);
    } else if (o.kind === 'domain') {
      onChange('');
      onDomain(o.slug);
    } else router.push(`/mentors/${o.id}`);
    inputRef.current?.blur();
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && options.length) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % options.length);
    } else if (e.key === 'ArrowUp' && options.length) {
      e.preventDefault();
      setActive((a) => (a - 1 + options.length) % options.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && options[active]) choose(options[active]);
      else {
        setOpen(false);
        onSubmit(value);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showPanel = open && term.length >= 2;
  const suggestions = options.length - 1;
  const groups: { title: string; kind: Option['kind'] }[] = [
    { title: 'Domaines', kind: 'domain' },
    { title: 'Compétences', kind: 'skill' },
    { title: 'Mentors', kind: 'mentor' },
  ];

  const row = (o: Option, i: number, content: ReactNode) => (
    <li
      key={`${o.kind}-${o.label}-${i}`}
      id={`${listId}-${i}`}
      role="option"
      aria-selected={active === i}
      onPointerMove={() => setActive(i)}
      onPointerDown={(e) => {
        e.preventDefault();
        choose(o);
      }}
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-[14px] transition-colors',
        active === i ? 'bg-surface-muted text-ink-900' : 'text-foreground',
      )}
    >
      {content}
    </li>
  );

  return (
    <div className="relative w-full">
      <label htmlFor="recherche-mentor" className="sr-only">
        Rechercher un mentor
      </label>
      <span
        className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      >
        {loading && term ? (
          <LoaderCircle className="size-[18px] animate-spin" />
        ) : (
          <Search className="size-[18px]" />
        )}
      </span>
      <input
        ref={inputRef}
        id="recherche-mentor"
        type="search"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showPanel ? `${listId}-${active}` : undefined}
        autoComplete="off"
        enterKeyHint="search"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKey}
        placeholder="Compétence, métier, domaine ou nom… (ex. React, CV, levée de fonds)"
        className="h-11 w-full rounded-lg border border-border bg-background pr-10 pl-10 text-[15px] text-ink-900 transition-[box-shadow,border-color,background-color] outline-none placeholder:text-muted-foreground focus:border-teal-600 focus:bg-surface focus:ring-4 focus:ring-teal-600/12 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('');
            onSubmit('');
            inputRef.current?.focus();
          }}
          className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-ink-900"
          aria-label="Effacer la recherche"
        >
          <X className="size-4" />
        </button>
      )}

      {showPanel && (
        <div className="absolute inset-x-0 top-full z-40 mt-1.5 animate-scale-in overflow-hidden rounded-xl bg-surface shadow-raised ring-1 ring-border/70">
          <ul
            id={listId}
            role="listbox"
            aria-label="Suggestions"
            className="max-h-[60vh] overflow-y-auto p-1.5"
          >
            {row(
              options[0],
              0,
              <>
                <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate">
                  Rechercher « <span className="font-semibold text-ink-900">{term}</span> »
                </span>
                <kbd className="hidden rounded border border-border px-1.5 text-[11px] text-muted-foreground sm:inline">
                  Entrée
                </kbd>
              </>,
            )}
            {groups.map((g) => {
              const items = options.map((o, i) => ({ o, i })).filter(({ o }) => o.kind === g.kind);
              if (items.length === 0) return null;
              return (
                <li key={g.kind} role="presentation" className="mt-1">
                  <p className="px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                    {g.title}
                  </p>
                  <ul role="group" aria-label={g.title}>
                    {items.map(({ o, i }) =>
                      row(
                        o,
                        i,
                        o.kind === 'domain' ? (
                          <>
                            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-ink-900 text-amber-400">
                              <DomainIcon name={o.icon} className="size-3.5" />
                            </span>
                            <span className="min-w-0 flex-1 truncate">
                              <Highlight text={o.label} query={term} />
                            </span>
                            <span className="text-[12px] text-muted-foreground tabular-nums">
                              {o.count} mentor{o.count > 1 ? 's' : ''}
                            </span>
                          </>
                        ) : o.kind === 'skill' ? (
                          <>
                            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-teal-50 text-teal-700">
                              <Tag className="size-3.5" aria-hidden />
                            </span>
                            <span className="min-w-0 flex-1 truncate">
                              <Highlight text={o.label} query={term} />
                            </span>
                            <span className="text-[12px] text-muted-foreground tabular-nums">
                              {o.count}
                            </span>
                          </>
                        ) : o.kind === 'mentor' ? (
                          <>
                            <Avatar person={o.person} size="sm" className="size-7 text-[10px]" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate">
                                <Highlight text={o.label} query={term} />
                              </span>
                              <span className="block truncate text-[12px] text-muted-foreground">
                                {o.headline}
                              </span>
                            </span>
                            <ArrowUpRight
                              className="size-4 shrink-0 text-muted-foreground"
                              aria-hidden
                            />
                          </>
                        ) : null,
                      ),
                    )}
                  </ul>
                </li>
              );
            })}
          </ul>
          {!ac.isPending && suggestions === 0 && (
            <p className="border-t border-border/70 px-4 py-2.5 text-[13px] text-muted-foreground">
              Aucune suggestion : appuyez sur Entrée pour chercher les profils proches.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
