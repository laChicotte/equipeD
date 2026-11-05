'use client';

import { CalendarPlus, CalendarX2, Clock, Lock, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { AccessDenied, EmptyState, ErrorState, PageHeader } from '@/components/feedback/states';
import { StatusBadge } from '@/components/feedback/status-badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/misc';
import { Tooltip } from '@/components/ui/tooltip';
import { useMe } from '@/features/auth/api';
import { errorMessage } from '@/lib/api';
import {
  DEFAULT_TZ,
  dayKey,
  durationMinutes,
  formatLongDate,
  formatTime,
  fullName,
  zonedToIso,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import { useCreateSlot, useDeleteSlot, useMyAvailability } from './api';
import { groupByDay } from './book-dialog';

const DURATIONS = [30, 45, 60, 90, 120];

function tomorrow(tz: string) {
  return dayKey(new Date(Date.now() + 86_400_000).toISOString(), tz);
}

function AddSlotForm({ tz }: { tz: string }) {
  const create = useCreateSlot();
  const [date, setDate] = useState(() => tomorrow(tz));
  const [time, setTime] = useState('10:00');
  const [duration, setDuration] = useState(60);
  const [repeat, setRepeat] = useState(1);
  const [error, setError] = useState<string>();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    if (!date || !time) return setError('Choisissez une date et une heure.');
    const start = new Date(zonedToIso(date, time, tz));
    if (start.getTime() <= Date.now()) return setError('Le créneau doit être dans le futur.');

    let created = 0;
    for (let i = 0; i < repeat; i++) {
      const s = new Date(start.getTime() + i * 7 * 86_400_000);
      const end = new Date(s.getTime() + duration * 60_000);
      try {
        await create.mutateAsync({
          startsAt: s.toISOString(),
          endsAt: end.toISOString(),
          timezone: tz,
        });
        created++;
      } catch (err) {
        if (created === 0) {
          setError(errorMessage(err));
          return;
        }
        toast.warning(
          `${created} créneau(x) ajouté(s). Le suivant a été refusé : ${errorMessage(err)}`,
        );
        return;
      }
    }
    toast.success(created > 1 ? `${created} créneaux ajoutés` : 'Créneau ajouté', {
      description: 'Il est visible sur votre fiche publique.',
    });
  };

  return (
    <Card className="p-5 sm:p-6 lg:sticky lg:top-24">
      <h2 className="flex items-center gap-2 font-semibold tracking-tight">
        <CalendarPlus className="size-5 text-teal-700" aria-hidden />
        Ajouter un créneau
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">Heure de Conakry (UTC+0).</p>
      <form onSubmit={submit} noValidate className="mt-5 grid gap-4">
        <Field label="Date">
          <Input
            type="date"
            value={date}
            min={dayKey(new Date().toISOString(), tz)}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Début">
            <Input type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <Field label="Durée">
            <NativeSelect value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d < 60 ? `${d} min` : `${d / 60} h${d % 60 ? ` ${d % 60}` : ''}`}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <Field label="Répéter" hint="Le même créneau, chaque semaine.">
          <NativeSelect value={repeat} onChange={(e) => setRepeat(Number(e.target.value))}>
            <option value={1}>Une seule fois</option>
            <option value={2}>2 semaines</option>
            <option value={4}>4 semaines</option>
          </NativeSelect>
        </Field>
        {error && (
          <p
            role="alert"
            className="rounded-md bg-danger-50 px-3 py-2 text-sm font-medium text-danger-700"
          >
            {error}
          </p>
        )}
        <Button type="submit" loading={create.isPending}>
          {!create.isPending && <Plus aria-hidden />}
          Publier le créneau
        </Button>
      </form>
    </Card>
  );
}

export function AvailabilityView() {
  const { data: me } = useMe();
  const isMentor = me?.role === 'MENTOR';
  const slots = useMyAvailability(isMentor);
  const del = useDeleteSlot();
  const tz = me?.timezone ?? DEFAULT_TZ;

  if (!me) return null;
  if (!isMentor) return <AccessDenied message="Les disponibilités sont gérées par les mentors." />;

  return (
    <>
      <PageHeader
        title="Disponibilités"
        description="Publiez des créneaux : vos mentorés réservent directement, sans risque de double réservation."
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="order-2 lg:order-1">
          {slots.isError ? (
            <ErrorState error={slots.error} onRetry={() => void slots.refetch()} />
          ) : slots.isPending ? (
            <div className="grid gap-3">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          ) : slots.data.length === 0 ? (
            <EmptyState
              icon={CalendarX2}
              title="Aucun créneau publié"
              description="Ajoutez vos premiers créneaux avec le formulaire. Ils apparaîtront sur votre fiche."
            />
          ) : (
            <div className="grid gap-6">
              {groupByDay(slots.data, tz).map(([day, daySlots]) => (
                <section key={day} aria-label={formatLongDate(daySlots[0].startsAt, tz)}>
                  <h2 className="mb-2.5 text-sm font-semibold capitalize text-foreground">
                    {formatLongDate(daySlots[0].startsAt, tz)}
                  </h2>
                  <ul className="grid gap-2">
                    {daySlots.map((s) => {
                      const booking = s.sessions.find(
                        (x) => x.status === 'REQUESTED' || x.status === 'CONFIRMED',
                      );
                      return (
                        <li
                          key={s.id}
                          className={cn(
                            'flex items-center gap-4 rounded-lg border bg-surface px-4 py-3',
                            booking ? 'border-teal-200 bg-teal-50/40' : 'border-border',
                          )}
                        >
                          <div className="flex shrink-0 items-center gap-2 text-sm font-semibold whitespace-nowrap tabular-nums">
                            <Clock className="size-4 text-muted-foreground" aria-hidden />
                            {formatTime(s.startsAt, tz)} – {formatTime(s.endsAt, tz)}
                          </div>
                          <div className="min-w-0 flex-1">
                            {booking ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <StatusBadge kind="session" status={booking.status} />
                                <span className="truncate text-sm">
                                  <span className="font-semibold">{fullName(booking.mentee)}</span>
                                  <span className="text-muted-foreground"> · {booking.topic}</span>
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                Libre · {durationMinutes(s.startsAt, s.endsAt)} min
                              </span>
                            )}
                          </div>
                          {booking ? (
                            <Tooltip content="Créneau réservé : annulez d’abord la séance pour le libérer.">
                              <span
                                className="inline-flex size-9 items-center justify-center text-muted-foreground"
                                aria-label="Créneau réservé"
                                role="img"
                              >
                                <Lock className="size-4" aria-hidden />
                              </span>
                            </Tooltip>
                          ) : (
                            <Button
                              variant="danger-ghost"
                              size="icon-sm"
                              aria-label={`Supprimer le créneau de ${formatTime(s.startsAt, tz)}`}
                              loading={del.isPending && del.variables === s.id}
                              onClick={() =>
                                del.mutate(s.id, {
                                  onSuccess: () => toast.success('Créneau supprimé.'),
                                  onError: (e) => toast.error(errorMessage(e)),
                                })
                              }
                            >
                              {!(del.isPending && del.variables === s.id) && <Trash2 aria-hidden />}
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
        <div className="order-1 lg:order-2">
          <AddSlotForm tz={tz} />
        </div>
      </div>
    </>
  );
}
