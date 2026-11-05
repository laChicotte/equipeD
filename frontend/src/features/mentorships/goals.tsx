'use client';

import { CalendarClock, MessageSquareQuote, Plus, Route, Target, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState, ErrorState } from '@/components/feedback/states';
import { StatusBadge } from '@/components/feedback/status-badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Checkbox, Progress, Skeleton, Slider } from '@/components/ui/misc';
import { errorMessage } from '@/lib/api';
import { formatDate, fullName } from '@/lib/format';
import { goalStatusLabels } from '@/lib/labels';
import type { Goal, GoalStatus, Me, MentorshipSummary } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useGoalMutations, useGoals } from './api';
import { GuidedPathDialog, GuidedPathHint } from './guided-paths';

function CreateGoalDialog({
  mentorshipId,
  open,
  onOpenChange,
}: {
  mentorshipId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { create } = useGoalMutations(mentorshipId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [milestones, setMilestones] = useState<string[]>(['']);
  const [error, setError] = useState<string>();

  const submit = () => {
    const t = title.trim();
    if (t.length < 3 || t.length > 160)
      return setError('Le titre doit contenir entre 3 et 160 caractères.');
    setError(undefined);
    create.mutate(
      {
        title: t,
        description: description.trim() || undefined,
        dueDate: dueDate ? new Date(`${dueDate}T12:00:00Z`).toISOString() : undefined,
        milestones: milestones.map((m) => m.trim()).filter(Boolean),
      },
      {
        onSuccess: () => {
          toast.success('Objectif créé');
          setTitle('');
          setDescription('');
          setDueDate('');
          setMilestones(['']);
          onOpenChange(false);
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Nouvel objectif"
        description="Un objectif précis, découpé en jalons concrets."
      >
        <div className="grid gap-5">
          <Field label="Objectif" error={error} counter={{ value: title.length, min: 3, max: 160 }}>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex. : Publier un portfolio en ligne"
            />
          </Field>
          <Field label="Description" optional>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Field label="Échéance" optional>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">
              Jalons{' '}
              <span className="font-normal text-muted-foreground">(facultatif, 12 au maximum)</span>
            </legend>
            <ol className="grid gap-2">
              {milestones.map((m, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-5 text-right text-xs font-semibold text-muted-foreground tabular-nums">
                    {i + 1}.
                  </span>
                  <Input
                    value={m}
                    aria-label={`Jalon ${i + 1}`}
                    onChange={(e) =>
                      setMilestones((all) => all.map((x, j) => (j === i ? e.target.value : x)))
                    }
                    placeholder={i === 0 ? 'Ex. : Choisir 3 projets à présenter' : 'Jalon suivant'}
                  />
                  {milestones.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Retirer le jalon ${i + 1}`}
                      onClick={() => setMilestones((all) => all.filter((_, j) => j !== i))}
                    >
                      <X aria-hidden />
                    </Button>
                  )}
                </li>
              ))}
            </ol>
            {milestones.length < 12 && (
              <Button
                variant="link"
                size="sm"
                className="mt-2"
                onClick={() => setMilestones((a) => [...a, ''])}
              >
                <Plus aria-hidden />
                Ajouter un jalon
              </Button>
            )}
          </fieldset>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={submit} loading={create.isPending}>
            Créer l’objectif
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GoalCard({
  goal,
  me,
  mentorshipId,
  readOnly,
}: {
  goal: Goal;
  me: Me;
  mentorshipId: string;
  readOnly: boolean;
}) {
  const m = useGoalMutations(mentorshipId);
  const [newMilestone, setNewMilestone] = useState('');
  const [feedback, setFeedback] = useState(goal.mentorFeedback ?? '');
  const [editingFeedback, setEditingFeedback] = useState(false);
  const [progress, setProgress] = useState(goal.progress);
  const isMentor = me.role === 'MENTOR';
  const hasMilestones = goal.milestones.length > 0;
  const done = goal.milestones.filter((x) => x.isDone).length;
  const onError = (e: unknown) => toast.error(errorMessage(e));

  const shownProgress = hasMilestones ? goal.progress : progress;

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold tracking-tight">{goal.title}</h3>
            <StatusBadge kind="goal" status={goal.status} />
          </div>
          <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            <span>
              Proposé par {goal.createdById === me.id ? 'vous' : fullName(goal.createdBy)}
            </span>
            {goal.dueDate && (
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="size-3.5" aria-hidden />
                Échéance : {formatDate(goal.dueDate)}
              </span>
            )}
          </p>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-1">
            <NativeSelect
              aria-label="Statut de l’objectif"
              className="h-9 w-auto py-0 text-sm"
              value={goal.status}
              onChange={(e) =>
                m.update.mutate(
                  { id: goal.id, patch: { status: e.target.value as GoalStatus } },
                  { onError },
                )
              }
            >
              {(Object.keys(goalStatusLabels) as GoalStatus[]).map((s) => (
                <option key={s} value={s}>
                  {goalStatusLabels[s]}
                </option>
              ))}
            </NativeSelect>
            {goal.createdById === me.id && (
              <Button
                variant="danger-ghost"
                size="icon-sm"
                aria-label="Supprimer l’objectif"
                onClick={() => {
                  if (confirm('Supprimer cet objectif et ses jalons ?'))
                    m.remove.mutate(goal.id, {
                      onSuccess: () => toast.success('Objectif supprimé.'),
                      onError,
                    });
                }}
              >
                <Trash2 aria-hidden />
              </Button>
            )}
          </div>
        )}
      </div>

      {goal.description && (
        <p className="mt-3 max-w-[70ch] text-sm leading-relaxed text-foreground/85">
          {goal.description}
        </p>
      )}

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
          <span className="text-muted-foreground">
            {hasMilestones
              ? `${done} jalon${done > 1 ? 's' : ''} sur ${goal.milestones.length}`
              : 'Progression'}
          </span>
          <span className="text-teal-800 tabular-nums">{Math.round(shownProgress)} %</span>
        </div>
        {hasMilestones || readOnly ? (
          <Progress value={shownProgress} label={`Progression : ${goal.title}`} />
        ) : (
          <Slider
            value={[progress]}
            min={0}
            max={100}
            step={5}
            onValueChange={([v]) => setProgress(v)}
            onValueCommit={([v]) =>
              m.update.mutate({ id: goal.id, patch: { progress: v } }, { onError })
            }
            aria-label={`Progression : ${goal.title}`}
          />
        )}
      </div>

      {(hasMilestones || !readOnly) && (
        <ul className="mt-4 grid gap-1">
          {goal.milestones
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((ms) => (
              <li
                key={ms.id}
                className="group flex min-h-10 items-center gap-3 rounded-md px-2 -mx-2 hover:bg-surface-muted"
              >
                <Checkbox
                  id={`ms-${ms.id}`}
                  checked={ms.isDone}
                  disabled={readOnly}
                  onCheckedChange={(v) =>
                    m.toggleMilestone.mutate({ id: ms.id, isDone: v === true }, { onError })
                  }
                />
                <label
                  htmlFor={`ms-${ms.id}`}
                  className={cn(
                    'flex-1 text-sm',
                    ms.isDone && 'text-muted-foreground line-through',
                  )}
                >
                  {ms.title}
                </label>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => m.removeMilestone.mutate(ms.id, { onError })}
                    className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger-700 focus-visible:opacity-100"
                    aria-label={`Retirer le jalon « ${ms.title} »`}
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          {!readOnly && goal.milestones.length < 12 && (
            <li>
              <form
                className="mt-1 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const t = newMilestone.trim();
                  if (!t) return;
                  m.addMilestone.mutate(
                    { goalId: goal.id, title: t },
                    { onSuccess: () => setNewMilestone(''), onError },
                  );
                }}
              >
                <Input
                  className="h-9"
                  value={newMilestone}
                  onChange={(e) => setNewMilestone(e.target.value)}
                  placeholder="Ajouter un jalon…"
                  aria-label="Nouveau jalon"
                />
                <Button
                  type="submit"
                  variant="secondary"
                  size="sm"
                  disabled={!newMilestone.trim()}
                  loading={m.addMilestone.isPending}
                >
                  Ajouter
                </Button>
              </form>
            </li>
          )}
        </ul>
      )}

      <div className="mt-5 rounded-md border border-border bg-surface-muted/60 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <MessageSquareQuote className="size-4 text-teal-700" aria-hidden />
          Retour du mentor
        </p>
        {isMentor && !readOnly && editingFeedback ? (
          <div className="mt-3 grid gap-2">
            <Textarea
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              aria-label="Retour du mentor"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditingFeedback(false)}>
                Annuler
              </Button>
              <Button
                size="sm"
                loading={m.update.isPending}
                onClick={() =>
                  m.update.mutate(
                    { id: goal.id, patch: { mentorFeedback: feedback.trim() } },
                    {
                      onSuccess: () => {
                        toast.success('Retour enregistré.');
                        setEditingFeedback(false);
                      },
                      onError,
                    },
                  )
                }
              >
                Enregistrer
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex items-start justify-between gap-3">
            <p
              className={cn(
                'text-sm leading-relaxed',
                !goal.mentorFeedback && 'text-muted-foreground',
              )}
            >
              {goal.mentorFeedback ??
                (isMentor ? 'Partagez un conseil ou un encouragement.' : 'Pas encore de retour.')}
            </p>
            {isMentor && !readOnly && (
              <Button variant="secondary" size="sm" onClick={() => setEditingFeedback(true)}>
                {goal.mentorFeedback ? 'Modifier' : 'Écrire'}
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

export function GoalsPanel({ mentorship, me }: { mentorship: MentorshipSummary; me: Me }) {
  const goals = useGoals(mentorship.id);
  const [creating, setCreating] = useState(false);
  const [guided, setGuided] = useState(false);
  const readOnly = mentorship.status !== 'ACTIVE';

  if (goals.isError) return <ErrorState error={goals.error} onRetry={() => void goals.refetch()} />;
  if (goals.isPending)
    return (
      <div className="grid gap-4">
        <Skeleton className="h-52" />
      </div>
    );

  return (
    <div className="grid gap-4">
      {!readOnly && goals.data.length > 0 && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setGuided(true)}>
            <Route aria-hidden />
            Parcours guidé
          </Button>
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            Nouvel objectif
          </Button>
        </div>
      )}
      {!readOnly && goals.data.length === 0 && (
        <GuidedPathHint mentorship={mentorship} onOpen={() => setGuided(true)} />
      )}
      {goals.data.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Aucun objectif pour l’instant"
          description="Définissez ensemble un premier objectif, découpé en jalons. Point de départ suggéré :"
          action={
            <div className="grid justify-items-center gap-3">
              <p className="max-w-md rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">
                « {mentorship.initialGoal} »
              </p>
              {!readOnly && (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={() => setCreating(true)}>
                    <Plus aria-hidden />
                    Créer un objectif
                  </Button>
                  <Button variant="secondary" onClick={() => setGuided(true)}>
                    <Route aria-hidden />
                    Partir d’un parcours guidé
                  </Button>
                </div>
              )}
            </div>
          }
        />
      ) : (
        goals.data.map((g) => (
          <GoalCard key={g.id} goal={g} me={me} mentorshipId={mentorship.id} readOnly={readOnly} />
        ))
      )}
      <CreateGoalDialog mentorshipId={mentorship.id} open={creating} onOpenChange={setCreating} />
      {!readOnly && (
        <GuidedPathDialog
          mentorship={mentorship}
          goals={goals.data}
          open={guided}
          onOpenChange={setGuided}
        />
      )}
    </div>
  );
}
