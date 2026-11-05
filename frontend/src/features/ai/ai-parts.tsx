'use client';

import { ChevronDown, ListChecks, Search, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/misc';
import { useGoalMutations } from '@/features/mentorships/api';
import { errorMessage } from '@/lib/api';
import { useOnline } from '@/lib/connectivity';
import { cn } from '@/lib/utils';
import {
  useAiAvailable,
  useMentorExplanation,
  useOrientation,
  usePathProposal,
  type PathProposal,
} from './api';

const PRIVACY_NOTE =
  'Votre texte est envoyé à OpenAI, sans votre nom. Évitez d’y écrire des informations personnelles.';

/** Orientation : le besoin en langage courant devient des domaines et compétences à explorer. */
export function OrientationPanel({
  onDomain,
  onSkill,
}: {
  onDomain: (slug: string) => void;
  onSkill: (skill: string) => void;
}) {
  const available = useAiAvailable();
  const orientation = useOrientation();
  const [open, setOpen] = useState(false);
  const [need, setNeed] = useState('');
  const [error, setError] = useState<string>();
  if (!available) return null;
  const result = orientation.data;

  return (
    <section className="overflow-hidden rounded-lg bg-surface shadow-card ring-1 ring-border/70">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-5 py-3.5 text-left sm:px-6"
      >
        <Sparkles className="size-[18px] shrink-0 text-amber-500" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[16px] font-semibold text-ink-900">
            Vous ne savez pas par où commencer ?
          </span>
          <span className="block text-[13px] text-muted-foreground">
            Décrivez votre besoin avec vos mots, l’assistant vous oriente.
          </span>
        </span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      {open && (
        <div className="grid gap-4 border-t border-border/70 px-5 py-4 sm:px-6">
          <form
            className="grid gap-3"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              const text = need.trim();
              if (text.length < 20) {
                setError('Décrivez votre besoin en 20 caractères au moins.');
                return;
              }
              setError(undefined);
              orientation.mutate(text, { onError: (err) => toast.error(errorMessage(err)) });
            }}
          >
            <Field
              label="Votre besoin"
              error={error}
              hint={PRIVACY_NOTE}
              counter={{ value: need.length, max: 1000 }}
            >
              <Textarea
                rows={3}
                value={need}
                maxLength={1000}
                onChange={(e) => setNeed(e.target.value)}
                placeholder="Ex. : je finis ma licence et je voudrais travailler dans le web, mais je ne sais pas quoi apprendre."
              />
            </Field>
            <Button
              type="submit"
              size="sm"
              className="justify-self-end"
              loading={orientation.isPending}
            >
              <Sparkles aria-hidden />
              M’orienter
            </Button>
          </form>
          {result && (
            <div className="grid gap-3 rounded-md bg-surface-muted/60 p-4" aria-live="polite">
              <p className="text-[15px] text-foreground">{result.summary}</p>
              <ul className="grid gap-2">
                {result.domains.map((d) => (
                  <li key={d.slug} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 basis-56 text-[14px]">
                      <span className="font-semibold text-ink-900">{d.name}</span>
                      <span className="text-muted-foreground"> : {d.reason}</span>
                    </span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => onDomain(d.slug)}
                    >
                      <Search aria-hidden />
                      Voir les mentors
                    </Button>
                  </li>
                ))}
              </ul>
              {result.skills.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[13px] font-semibold text-ink-800">Compétences :</span>
                  {result.skills.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => onSkill(s)}
                      className="rounded-full bg-surface px-2.5 py-1 text-[13px] font-medium text-teal-800 ring-1 ring-border hover:ring-teal-600"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-[12px] text-muted-foreground">
                Proposition de l’IA, à vérifier : vous restez libre de votre choix.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** « Pourquoi ce mentor ? » : raisons calculées par les règles, reformulées par l'IA si disponible. */
export function WhyThisMentor({ mentorId }: { mentorId: string }) {
  const explanation = useMentorExplanation(mentorId);
  const online = useOnline();
  const aiOn = useAiAvailable();
  const data = explanation.data;

  if (!data) {
    return (
      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <button
          type="button"
          disabled={!online}
          onClick={() =>
            explanation.mutate(undefined, { onError: (e) => toast.error(errorMessage(e)) })
          }
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-teal-700 hover:underline disabled:opacity-50"
        >
          <Sparkles className="size-3.5" aria-hidden />
          {explanation.isPending ? 'Analyse en cours…' : 'Pourquoi ce mentor ?'}
        </button>
        {aiOn && (
          <span className="text-[12px] text-muted-foreground">
            Vos objectifs sont envoyés à OpenAI, sans votre nom.
          </span>
        )}
      </span>
    );
  }

  return (
    <span className="block rounded-md bg-surface-muted/70 px-3 py-2 text-[13px]" aria-live="polite">
      {data.text ? (
        <>
          <span className="block text-foreground">{data.text}</span>
          <span className="mt-1 block text-[12px] text-muted-foreground">
            Reformulé par l’IA à partir du score de {data.score}/100, calculé par des règles.
          </span>
        </>
      ) : data.reasons.length > 0 ? (
        <>
          <span className="block font-semibold text-ink-900">
            Correspondance {data.score}/100, calculée par des règles :
          </span>
          <span className="mt-0.5 block text-muted-foreground">{data.reasons.join(' · ')}.</span>
        </>
      ) : (
        <span className="text-muted-foreground">
          Aucun critère commun entre votre profil et celui de ce mentor pour l’instant.
        </span>
      )}
    </span>
  );
}

/** Proposition d'objectifs et de jalons : rien n'est ajouté sans la validation d'un participant. */
export function PathProposalDialog({
  mentorshipId,
  open,
  onOpenChange,
}: {
  mentorshipId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const proposal = usePathProposal(mentorshipId);
  const { create } = useGoalMutations(mentorshipId);
  const [focus, setFocus] = useState('');
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      proposal.reset();
      setFocus('');
      setExcluded(new Set());
    }
  };

  const goals: PathProposal['goals'] = proposal.data?.goals ?? [];
  const chosen = goals.filter((_, i) => !excluded.has(i));

  const generate = () => {
    setExcluded(new Set());
    proposal.mutate(focus.trim(), { onError: (e) => toast.error(errorMessage(e)) });
  };

  const accept = async () => {
    setSaving(true);
    try {
      for (const goal of chosen) {
        await create.mutateAsync({
          title: goal.title,
          description: goal.description || undefined,
          milestones: goal.milestones,
        });
      }
      toast.success(chosen.length > 1 ? `${chosen.length} objectifs ajoutés` : 'Objectif ajouté');
      close(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        title="Proposer un parcours avec l’IA"
        description="Une base de travail à relire ensemble : seuls les objectifs que vous validez sont ajoutés, et vous pourrez les modifier."
        className="sm:max-w-xl"
      >
        <div className="grid gap-4">
          <Field
            label="Sur quoi insister ?"
            optional
            hint="L’objectif initial, le domaine et la situation du mentoré sont envoyés à OpenAI, sans aucun nom ni message."
          >
            <Input
              value={focus}
              maxLength={300}
              onChange={(e) => setFocus(e.target.value)}
              placeholder="Ex. : décrocher un premier stage en six mois"
            />
          </Field>
          <Button
            type="button"
            variant={goals.length ? 'secondary' : 'primary'}
            className="justify-self-start"
            loading={proposal.isPending}
            onClick={generate}
          >
            <Sparkles aria-hidden />
            {goals.length ? 'Proposer autre chose' : 'Générer une proposition'}
          </Button>
          {goals.length > 0 && (
            <ul className="grid gap-2" aria-live="polite">
              {goals.map((goal, i) => {
                const id = `objectif-ia-${i}`;
                return (
                  <li key={goal.title} className="flex gap-3 rounded-md border border-border p-3">
                    <Checkbox
                      id={id}
                      className="mt-0.5"
                      checked={!excluded.has(i)}
                      onCheckedChange={(checked) =>
                        setExcluded((prev) => {
                          const next = new Set(prev);
                          if (checked) next.delete(i);
                          else next.add(i);
                          return next;
                        })
                      }
                    />
                    <div className="min-w-0">
                      <label htmlFor={id} className="block font-semibold text-ink-900">
                        {goal.title}
                      </label>
                      {goal.description && (
                        <p className="text-[14px] text-muted-foreground">{goal.description}</p>
                      )}
                      <ul className="mt-1.5 grid gap-0.5 text-[13px] text-foreground">
                        {goal.milestones.map((m) => (
                          <li key={m} className="flex items-start gap-1.5">
                            <ListChecks
                              className="mt-0.5 size-3.5 shrink-0 text-teal-700"
                              aria-hidden
                            />
                            {m}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => close(false)}>
            Fermer
          </Button>
          {goals.length > 0 && (
            <Button
              type="button"
              disabled={chosen.length === 0}
              loading={saving}
              onClick={() => void accept()}
            >
              Ajouter {chosen.length > 1 ? `les ${chosen.length} objectifs` : 'l’objectif'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
