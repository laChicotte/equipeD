'use client';

import { Info, ListChecks, Route } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/feedback/states';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Checkbox, Skeleton } from '@/components/ui/misc';
import { errorMessage } from '@/lib/api';
import type { Goal, GuidedPath, MentorshipSummary } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useApplyGuidedPath, useGuidedPaths } from './api';

/** Parcours du domaine du mentorat d'abord, puis les autres. */
function sortForMentorship(paths: GuidedPath[], domainSlug?: string) {
  return [...paths].sort(
    (a, b) => Number(b.domain.slug === domainSlug) - Number(a.domain.slug === domainSlug),
  );
}

function PathPicker({
  paths,
  value,
  onChange,
  domainSlug,
}: {
  paths: GuidedPath[];
  value: string;
  onChange: (key: string) => void;
  domainSlug?: string;
}) {
  return (
    <div role="radiogroup" aria-label="Parcours" className="grid gap-2">
      {paths.map((p) => {
        const selected = p.key === value;
        return (
          <button
            key={p.key}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(p.key)}
            className={cn(
              'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
              selected
                ? 'border-accent bg-teal-50'
                : 'border-border bg-surface hover:border-border-strong',
            )}
          >
            <Route
              className={cn(
                'mt-0.5 size-4 shrink-0',
                selected ? 'text-teal-700' : 'text-muted-foreground',
              )}
              aria-hidden
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{p.title}</span>
              <span className="block text-xs text-muted-foreground">
                {p.domain.name}
                {p.domain.slug === domainSlug && ' · domaine de ce mentorat'}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Ajout d'un parcours guidé : objectifs et jalons prêts à l'emploi, à ajuster ensuite ensemble.
 * Les objectifs déjà présents dans le mentorat (même titre) ne sont pas proposés à nouveau.
 */
export function GuidedPathDialog({
  mentorship,
  goals,
  open,
  onOpenChange,
}: {
  mentorship: MentorshipSummary;
  goals: Goal[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const query = useGuidedPaths(open);
  const apply = useApplyGuidedPath(mentorship.id);
  const domainSlug = mentorship.domain?.slug;
  const paths = useMemo(
    () => sortForMentorship(query.data ?? [], domainSlug),
    [query.data, domainSlug],
  );
  const [pathKey, setPathKey] = useState<string | null>(null);
  const path = paths.find((p) => p.key === pathKey) ?? paths[0];
  const existing = useMemo(() => new Set(goals.map((g) => g.title)), [goals]);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const available = path ? path.goals.filter((g) => !existing.has(g.title)) : [];
  const chosen = available.filter((g) => !excluded.has(g.key));

  const choosePath = (key: string) => {
    setPathKey(key);
    setExcluded(new Set());
  };

  const submit = () => {
    if (!path || chosen.length === 0) return;
    apply.mutate(
      { pathKey: path.key, goalKeys: chosen.map((g) => g.key) },
      {
        onSuccess: (res) => {
          toast.success(
            `${res.created.length} objectif${res.created.length > 1 ? 's' : ''} ajouté${res.created.length > 1 ? 's' : ''} au mentorat.`,
          );
          setExcluded(new Set());
          onOpenChange(false);
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Partir d’un parcours guidé"
        description="Des objectifs et des étapes prêts à l’emploi, que vous ajusterez ensuite ensemble."
        className="sm:max-w-2xl"
      >
        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : query.isPending ? (
          <div className="grid gap-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-40" />
          </div>
        ) : !path ? (
          <p className="text-sm text-muted-foreground">Aucun parcours disponible pour l’instant.</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
            <PathPicker
              paths={paths}
              value={path.key}
              onChange={choosePath}
              domainSlug={domainSlug}
            />
            <div className="min-w-0">
              <p className="text-sm leading-relaxed">{path.summary}</p>
              {path.notice && (
                <p className="mt-3 flex gap-2 rounded-md bg-amber-50 p-3 text-xs leading-relaxed text-foreground">
                  <Info className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
                  {path.notice}
                </p>
              )}
              <fieldset className="mt-4">
                <legend className="mb-2 text-sm font-semibold">Objectifs à ajouter</legend>
                <ul className="grid gap-2">
                  {path.goals.map((g) => {
                    const already = existing.has(g.title);
                    const checked = !already && !excluded.has(g.key);
                    const id = `gp-${path.key}-${g.key}`;
                    return (
                      <li
                        key={g.key}
                        className={cn(
                          'rounded-lg border border-border p-3',
                          already && 'bg-surface-muted/60',
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            id={id}
                            checked={checked}
                            disabled={already}
                            onCheckedChange={(v) =>
                              setExcluded((prev) => {
                                const next = new Set(prev);
                                if (v === true) next.delete(g.key);
                                else next.add(g.key);
                                return next;
                              })
                            }
                            className="mt-0.5"
                          />
                          <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
                            <span className="block text-sm font-semibold">{g.title}</span>
                            <span className="block text-xs text-muted-foreground">
                              {already
                                ? 'Déjà dans vos objectifs'
                                : `${g.milestones.length} étapes · ${g.description}`}
                            </span>
                          </label>
                        </div>
                        {!already && (
                          <details className="mt-2 pl-8 text-xs text-muted-foreground">
                            <summary className="inline-flex cursor-pointer items-center gap-1 font-medium text-teal-700">
                              <ListChecks className="size-3.5" aria-hidden />
                              Voir les étapes
                            </summary>
                            <ol className="mt-2 list-decimal space-y-1 pl-4">
                              {g.milestones.map((m) => (
                                <li key={m}>{m}</li>
                              ))}
                            </ol>
                          </details>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={submit} loading={apply.isPending} disabled={chosen.length === 0}>
            {chosen.length > 1
              ? `Ajouter ${chosen.length} objectifs`
              : chosen.length === 1
                ? 'Ajouter l’objectif'
                : 'Rien à ajouter'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Encart d'invitation : parcours conseillé pour le domaine du mentorat, s'il en existe un. */
export function GuidedPathHint({
  mentorship,
  onOpen,
}: {
  mentorship: MentorshipSummary;
  onOpen: () => void;
}) {
  const query = useGuidedPaths();
  const match = query.data?.find((p) => p.domain.slug === mentorship.domain?.slug);
  if (!match) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-teal-200 bg-teal-50 p-4">
      <Route className="size-5 shrink-0 text-teal-700" aria-hidden />
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-semibold">Parcours conseillé : {match.title}.</span>{' '}
        <span className="text-muted-foreground">
          {match.goals.length} objectifs et leurs étapes, prêts à l’emploi.
        </span>
      </p>
      <Button variant="secondary" size="sm" onClick={onOpen}>
        Voir le parcours
      </Button>
    </div>
  );
}
