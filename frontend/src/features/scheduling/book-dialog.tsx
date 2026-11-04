'use client';

import { CalendarCheck2, CalendarX2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState, ErrorState } from '@/components/feedback/states';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/misc';
import { useMentorAvailability } from '@/features/catalog/api';
import { errorMessage, isApiError } from '@/lib/api';
import { formatLongDate, formatTime, dayKey, durationMinutes } from '@/lib/format';
import type { Slot } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useBookSession } from './api';

export function groupByDay<T extends { startsAt: string }>(items: T[], tz?: string) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = dayKey(item.startsAt, tz);
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }
  return [...groups.entries()];
}

export function BookDialog({
  mentorId,
  mentorFirstName,
  open,
  onOpenChange,
  timezone,
}: {
  mentorId: string;
  mentorFirstName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timezone?: string;
}) {
  const slots = useMentorAvailability(mentorId, open);
  const book = useBookSession();
  const [selected, setSelected] = useState<Slot | null>(null);
  const [topic, setTopic] = useState('');
  const [topicError, setTopicError] = useState<string>();

  const submit = () => {
    if (!selected) return;
    const t = topic.trim();
    if (t.length < 5 || t.length > 200) {
      setTopicError('Le sujet doit contenir entre 5 et 200 caractères.');
      return;
    }
    setTopicError(undefined);
    book.mutate(
      { slotId: selected.id, topic: t },
      {
        onSuccess: () => {
          toast.success('Séance demandée', {
            description: `${mentorFirstName} doit maintenant la confirmer.`,
          });
          setSelected(null);
          setTopic('');
          onOpenChange(false);
        },
        onError: (e) => {
          if (isApiError(e) && (e.code === 'SLOT_ALREADY_BOOKED' || e.code === 'SLOT_NOT_FOUND')) {
            toast.error('Ce créneau vient d’être réservé.', { description: 'Choisissez-en un autre.' });
            setSelected(null);
            void slots.refetch();
            return;
          }
          toast.error(errorMessage(e));
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Réserver une séance"
        description={`Choisissez un créneau libre de ${mentorFirstName}. Horaires affichés en heure de Conakry.`}
        className="sm:max-w-xl"
      >
        {slots.isError ? (
          <ErrorState error={slots.error} onRetry={() => void slots.refetch()} />
        ) : slots.isPending ? (
          <div className="grid gap-3">
            <Skeleton className="h-5 w-40" />
            <div className="grid grid-cols-3 gap-2">
              <Skeleton className="h-11" />
              <Skeleton className="h-11" />
              <Skeleton className="h-11" />
            </div>
          </div>
        ) : slots.data.length === 0 ? (
          <EmptyState
            icon={CalendarX2}
            title="Aucun créneau libre pour le moment"
            description="Écrivez à votre mentor dans la conversation pour convenir d’un moment."
          />
        ) : (
          <div className="grid gap-5">
            <div className="scrollbar-thin grid max-h-72 gap-4 overflow-y-auto pr-1">
              {groupByDay(slots.data, timezone).map(([day, daySlots]) => (
                <div key={day}>
                  <p className="mb-2 text-sm font-semibold capitalize">{formatLongDate(daySlots[0].startsAt, timezone)}</p>
                  <div role="radiogroup" aria-label={formatLongDate(daySlots[0].startsAt, timezone)} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {daySlots.map((s) => {
                      const active = selected?.id === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setSelected(s)}
                          className={cn(
                            'flex h-12 flex-col items-center justify-center rounded-md border text-sm font-semibold tabular-nums transition-[border-color,background-color] duration-150',
                            active
                              ? 'border-accent bg-teal-700 text-white'
                              : 'border-border bg-surface hover:border-accent hover:bg-teal-50',
                          )}
                        >
                          {formatTime(s.startsAt, timezone)}
                          <span className={cn('text-[11px] font-medium', active ? 'text-teal-100' : 'text-muted-foreground')}>
                            {durationMinutes(s.startsAt, s.endsAt)} min
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <Field
              label="Sujet de la séance"
              error={topicError}
              hint="Ex. : Revue de mon CV et de mon portfolio"
              counter={{ value: topic.length, min: 5, max: 200 }}
            >
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} />
            </Field>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={!selected} loading={book.isPending}>
            {!book.isPending && <CalendarCheck2 aria-hidden />}
            {selected ? `Réserver à ${formatTime(selected.startsAt, timezone)}` : 'Choisissez un créneau'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
