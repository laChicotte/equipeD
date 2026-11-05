'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Send } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { useCreateRequest } from '@/features/requests/api';
import { applyApiError } from '@/lib/forms';
import { fullName } from '@/lib/format';
import type { MentorCard } from '@/lib/types';

const schema = z.object({
  domainId: z.string().optional(),
  goal: z
    .string()
    .trim()
    .min(10, '10 caractères au minimum.')
    .max(200, '200 caractères au maximum.'),
  message: z
    .string()
    .trim()
    .min(40, '40 caractères au minimum.')
    .max(2000, '2 000 caractères au maximum.'),
});
type Values = z.infer<typeof schema>;

export function RequestDialog({
  mentor,
  open,
  onOpenChange,
}: {
  mentor: MentorCard;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateRequest();
  const { register, handleSubmit, control, setError, formState, reset } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { domainId: mentor.domains[0]?.id ?? '', goal: '', message: '' },
  });
  const goalLen = useWatch({ control, name: 'goal' })?.length ?? 0;
  const msgLen = useWatch({ control, name: 'message' })?.length ?? 0;

  const onSubmit = handleSubmit((v) => {
    create.mutate(
      { mentorId: mentor.id, goal: v.goal, message: v.message, domainId: v.domainId || undefined },
      {
        onSuccess: () => {
          toast.success('Demande envoyée', {
            description: `${mentor.firstName} sera informé·e et vous répondra depuis son espace.`,
          });
          reset();
          onOpenChange(false);
        },
        onError: (e) => applyApiError(e, setError, ['goal', 'message', 'domainId']),
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={`Demander un accompagnement à ${fullName(mentor)}`}
        description="Une demande claire et motivée a plus de chances d’être acceptée."
      >
        <form onSubmit={onSubmit} noValidate className="grid gap-5">
          {mentor.domains.length > 1 && (
            <Field label="Domaine concerné">
              <NativeSelect {...register('domainId')}>
                {mentor.domains.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
          <Field
            label="Votre objectif"
            error={formState.errors.goal?.message}
            counter={{ value: goalLen, min: 10, max: 200 }}
            hint="En une phrase : ce que vous voulez avoir accompli."
          >
            <Input
              placeholder="Ex. : Construire mon premier portfolio de développeuse web"
              {...register('goal')}
            />
          </Field>
          <Field
            label="Votre message"
            error={formState.errors.message?.message}
            counter={{ value: msgLen, min: 40, max: 2000 }}
            hint="Présentez-vous, expliquez où vous en êtes et pourquoi ce mentor en particulier."
          >
            <Textarea rows={6} {...register('message')} />
          </Field>
          <DialogFooter className="mt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={create.isPending}>
              {!create.isPending && <Send aria-hidden />}
              Envoyer la demande
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
