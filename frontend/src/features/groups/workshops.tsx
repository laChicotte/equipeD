'use client';

import {
  CalendarPlus,
  Check,
  ExternalLink,
  MapPin,
  Presentation,
  UsersRound,
  Video,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState, ErrorState } from '@/components/feedback/states';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/misc';
import { useNow } from '@/hooks/use-now';
import { errorMessage, isApiError } from '@/lib/api';
import { formatTime, fullName, zonedToIso } from '@/lib/format';
import { modalityLabels } from '@/lib/labels';
import type { Me, Modality, Workshop } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useCreateWorkshop, useGroupWorkshops, useWorkshopActions } from './api';

const DURATIONS = [30, 45, 60, 90, 120, 180];

function durationLabel(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return min % 60 ? `${h} h ${min % 60}` : `${h} h`;
}

/** Carte d'un atelier : date, groupe, salle de visio, participants et réponse de l'utilisateur. */
export function WorkshopCard({
  workshop: w,
  me,
  showGroup = true,
}: {
  workshop: Workshop;
  me: Me;
  showGroup?: boolean;
}) {
  const { respond, cancel } = useWorkshopActions();
  const now = useNow();
  const tz = me.timezone;
  const start = new Date(w.startsAt);
  const started = now > 0 && start.getTime() <= now;
  const open = w.status === 'UPCOMING';
  const onError = (e: unknown) => toast.error(errorMessage(e));

  const month = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: tz }).format(start);
  const day = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', timeZone: tz }).format(start);
  const weekday = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', timeZone: tz }).format(start);

  return (
    <article
      id={`atelier-${w.id}`}
      className={cn(
        'flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:p-5',
        w.status !== 'UPCOMING' && 'opacity-75',
      )}
    >
      <div className="flex items-center gap-4 sm:contents">
        <div
          className={cn(
            'flex w-16 shrink-0 flex-col items-center rounded-md py-2 text-center',
            open ? 'bg-teal-700 text-white' : 'bg-surface-muted text-foreground',
          )}
        >
          <span
            className={cn(
              'text-xs font-semibold first-letter:uppercase',
              open ? 'text-teal-100' : 'text-muted-foreground',
            )}
          >
            {month}
          </span>
          <span className="text-2xl leading-none font-semibold">{day}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-sm bg-teal-50 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-teal-800 uppercase">
              <Presentation className="size-3" aria-hidden />
              Atelier
            </span>
            <h3 className="font-semibold tracking-tight">{w.title}</h3>
            {w.status === 'CANCELLED' && (
              <span className="rounded-sm bg-danger-50 px-1.5 py-0.5 text-xs font-semibold text-danger-700">
                Annulé
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            <span className="capitalize">{weekday}</span> · {formatTime(w.startsAt, tz)} –{' '}
            {formatTime(w.endsAt, tz)}
            {showGroup && (
              <>
                {' '}
                · groupe <span className="font-medium text-foreground">{w.group.name}</span>
              </>
            )}{' '}
            · animé par {w.isOwner ? 'vous' : fullName(w.createdBy)}
          </p>
          {w.description && (
            <p className="mt-1 max-w-[70ch] text-sm leading-relaxed">{w.description}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
            <span>{modalityLabels[w.modality]}</span>
            <span className="inline-flex items-center gap-1">
              <UsersRound className="size-3.5" aria-hidden />
              {w.goingCount} participant{w.goingCount > 1 ? 's' : ''}
            </span>
            {w.meetingUrl && open && (
              <a
                href={w.meetingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
              >
                <Video className="size-3.5" aria-hidden />
                Salle de visio (service externe)
                <ExternalLink className="size-3" aria-hidden />
              </a>
            )}
            {w.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden />
                {w.location}
              </span>
            )}
          </div>
        </div>
      </div>
      {open && (
        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
          {!w.isOwner && (
            <div role="group" aria-label="Votre participation" className="flex gap-1">
              <Button
                size="sm"
                variant={w.myResponse === 'GOING' ? 'accent' : 'secondary'}
                aria-pressed={w.myResponse === 'GOING'}
                loading={respond.isPending && respond.variables?.going === true}
                onClick={() => respond.mutate({ id: w.id, going: true }, { onError })}
              >
                <Check aria-hidden />
                Je participe
              </Button>
              <Button
                size="sm"
                variant={w.myResponse === 'NOT_GOING' ? 'soft' : 'ghost'}
                aria-pressed={w.myResponse === 'NOT_GOING'}
                loading={respond.isPending && respond.variables?.going === false}
                onClick={() => respond.mutate({ id: w.id, going: false }, { onError })}
              >
                Pas disponible
              </Button>
            </div>
          )}
          {w.isOwner && !started && (
            <Button
              size="sm"
              variant="danger-ghost"
              loading={cancel.isPending}
              onClick={() => {
                if (confirm('Annuler cet atelier ? Les membres du groupe seront prévenus.'))
                  cancel.mutate(w.id, {
                    onSuccess: () => toast.success('Atelier annulé, les membres sont prévenus.'),
                    onError,
                  });
              }}
            >
              <X aria-hidden />
              Annuler
            </Button>
          )}
        </div>
      )}
    </article>
  );
}

function todayIn(tz: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
}

/** Planification d'un atelier par le mentor responsable du groupe. */
export function CreateWorkshopDialog({
  groupId,
  groupName,
  me,
  open,
  onOpenChange,
}: {
  groupId: string;
  groupName: string;
  me: Me;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateWorkshop(groupId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [duration, setDuration] = useState(60);
  const [modality, setModality] = useState<Modality>('REMOTE');
  const [location, setLocation] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const reset = () => {
    setTitle('');
    setDescription('');
    setDate('');
    setTime('10:00');
    setDuration(60);
    setModality('REMOTE');
    setLocation('');
    setErrors({});
  };

  const submit = () => {
    const next: Record<string, string> = {};
    if (title.trim().length < 3) next.title = 'Le titre contient au moins 3 caractères.';
    if (!date) next.startsAt = 'Choisissez une date.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    const startsAt = zonedToIso(date, time, me.timezone);
    const endsAt = new Date(new Date(startsAt).getTime() + duration * 60_000).toISOString();
    create.mutate(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        startsAt,
        endsAt,
        modality,
        location: modality !== 'REMOTE' ? location.trim() || undefined : undefined,
      },
      {
        onSuccess: () => {
          toast.success('Atelier planifié : les membres du groupe sont prévenus.');
          reset();
          onOpenChange(false);
        },
        onError: (e) => {
          if (isApiError(e) && e.details?.length) {
            setErrors(Object.fromEntries(e.details.map((d) => [d.field, d.messages[0]])));
          } else toast.error(errorMessage(e));
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Planifier un atelier"
        description={`Une séance collective pour tous les membres de « ${groupName} ».`}
      >
        <div className="grid gap-5">
          <Field label="Thème de l’atelier" error={errors.title}>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex. : Réussir son entretien Campus France"
              maxLength={160}
            />
          </Field>
          <Field label="Programme" optional>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ce que les participants vont apprendre, ce qu’il faut préparer."
              maxLength={2000}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Date" error={errors.startsAt}>
              <Input
                type="date"
                min={todayIn(me.timezone)}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="Heure de début">
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
            <Field label="Durée" error={errors.endsAt}>
              <NativeSelect value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {durationLabel(d)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Field
            label="Modalité"
            hint={
              modality === 'IN_PERSON'
                ? undefined
                : 'Une salle de visio privée (Jitsi Meet, service externe) est créée automatiquement.'
            }
          >
            <NativeSelect
              value={modality}
              onChange={(e) => setModality(e.target.value as Modality)}
            >
              {(Object.keys(modalityLabels) as Modality[]).map((m) => (
                <option key={m} value={m}>
                  {modalityLabels[m]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {modality !== 'REMOTE' && (
            <Field label="Lieu" optional error={errors.location}>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ex. : CCFG, salle de conférence"
                maxLength={200}
              />
            </Field>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={submit} loading={create.isPending}>
            <CalendarPlus aria-hidden />
            Planifier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Ateliers à venir d'un groupe, avec la planification pour son responsable. */
export function GroupWorkshopsDialog({
  groupId,
  groupName,
  isOwner,
  me,
  open,
  onOpenChange,
}: {
  groupId: string;
  groupName: string;
  isOwner: boolean;
  me: Me;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const list = useGroupWorkshops(open ? groupId : null);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          title={`Ateliers · ${groupName}`}
          description="Séances collectives planifiées pour les membres du groupe."
          className="sm:max-w-2xl"
        >
          {list.isError ? (
            <ErrorState error={list.error} onRetry={() => void list.refetch()} />
          ) : list.isPending ? (
            <Skeleton className="h-28" />
          ) : list.data.length === 0 ? (
            <EmptyState
              icon={Presentation}
              title="Aucun atelier à venir"
              description={
                isOwner
                  ? 'Réunissez vos mentorés autour d’un thème : CV, entretien, prise de parole…'
                  : 'Le mentor responsable du groupe n’a pas encore planifié d’atelier.'
              }
            />
          ) : (
            <ul className="grid gap-3">
              {list.data.map((w) => (
                <li key={w.id}>
                  <WorkshopCard workshop={w} me={me} showGroup={false} />
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
            {isOwner && (
              <Button onClick={() => setCreating(true)}>
                <CalendarPlus aria-hidden />
                Planifier un atelier
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {isOwner && (
        <CreateWorkshopDialog
          groupId={groupId}
          groupName={groupName}
          me={me}
          open={creating}
          onOpenChange={setCreating}
        />
      )}
    </>
  );
}
