'use client';

import { Globe2, MapPin, MonitorSmartphone } from 'lucide-react';
import type { ReactNode } from 'react';
import { Controller, useWatch, type FieldPath, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { DomainIcon } from '@/components/domain-icon';
import { ChoiceGroup, TagInput } from '@/components/ui/choices';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { CAMPUS_FRANCE_NOTICE, LANGUAGES, isCampusFrance, modalityLabels } from '@/lib/labels';
import type { Domain, Modality, ProfileMe } from '@/lib/types';

const modalityIcons: Record<Modality, ReactNode> = {
  REMOTE: <MonitorSmartphone className="size-4" aria-hidden />,
  IN_PERSON: <MapPin className="size-4" aria-hidden />,
  HYBRID: <Globe2 className="size-4" aria-hidden />,
};

export const modalityOptions = (Object.keys(modalityLabels) as Modality[]).map((m) => ({
  value: m,
  label: modalityLabels[m],
  icon: modalityIcons[m],
}));

export function domainOptions(domains: Domain[]) {
  return domains.map((d) => ({
    value: d.id,
    label: d.name,
    description: isCampusFrance(d.slug) ? CAMPUS_FRANCE_NOTICE : d.topics.slice(0, 3).join(' · '),
    icon: <DomainIcon name={d.icon} className="size-4" />,
  }));
}

/** Profil mentor : mêmes règles que l'API (UpsertMentorProfileDto). */
export const mentorSchema = z.object({
  headline: z
    .string()
    .trim()
    .min(10, '10 caractères au minimum.')
    .max(140, '140 caractères au maximum.'),
  currentPosition: z.string().trim().max(120).optional(),
  organization: z.string().trim().max(120).optional(),
  yearsExperience: z.coerce
    .number<number>({ error: 'Indiquez un nombre d’années.' })
    .int('Nombre entier attendu.')
    .min(1, 'Au moins 1 an.')
    .max(60, '60 ans au maximum.'),
  city: z.string().trim().max(80).optional(),
  bio: z
    .string()
    .trim()
    .min(80, '80 caractères au minimum.')
    .max(2000, '2 000 caractères au maximum.'),
  expertise: z.array(z.string()).min(1, 'Ajoutez au moins une compétence.').max(15),
  domainIds: z
    .array(z.string())
    .min(1, 'Choisissez au moins un domaine.')
    .max(4, '4 domaines au maximum.'),
  languages: z.array(z.string()).min(1, 'Choisissez au moins une langue.').max(6),
  modalities: z
    .array(z.enum(['REMOTE', 'IN_PERSON', 'HYBRID']))
    .min(1, 'Choisissez au moins une modalité.'),
  sessionDurationMin: z.union([z.literal(30), z.literal(45), z.literal(60), z.literal(90)]),
});
export type MentorValues = z.infer<typeof mentorSchema>;

export const mentorSteps: FieldPath<MentorValues>[][] = [
  ['headline', 'currentPosition', 'organization', 'yearsExperience', 'city', 'bio'],
  ['expertise', 'domainIds', 'languages'],
  ['modalities', 'sessionDurationMin'],
];

export function mentorDefaults(existing: ProfileMe['mentorProfile'] | null | undefined) {
  return {
    headline: existing?.headline ?? '',
    currentPosition: existing?.currentPosition ?? '',
    organization: existing?.organization ?? '',
    yearsExperience: existing?.yearsExperience ?? 5,
    city: existing?.city ?? '',
    bio: existing?.bio ?? '',
    expertise: existing?.expertise ?? [],
    domainIds: existing?.domains.map((d) => d.id) ?? [],
    languages: existing?.languages ?? ['Français'],
    modalities: existing?.modalities ?? ['REMOTE'],
    sessionDurationMin: (existing?.sessionDurationMin as 30 | 45 | 60 | 90) ?? 60,
  } satisfies MentorValues;
}

/** Valeurs prêtes pour l'API (champs facultatifs vides retirés). */
export function mentorPayload(v: MentorValues) {
  return {
    ...v,
    currentPosition: v.currentPosition || undefined,
    organization: v.organization || undefined,
    city: v.city || undefined,
  };
}

/** Champs d'une étape du profil mentor (0 : parcours, 1 : expertise, 2 : modalités). */
export function MentorStepFields<T extends MentorValues>({
  step,
  form,
  domains,
}: {
  step: 0 | 1 | 2;
  form: UseFormReturn<T>;
  domains: Domain[];
}) {
  // Les champs du profil mentor sont communs à plusieurs formulaires (onboarding, candidature).
  const { control, register, formState } = form as unknown as UseFormReturn<MentorValues>;
  const errors = formState.errors;
  const headlineLen = useWatch({ control, name: 'headline' })?.length ?? 0;
  const bioLen = useWatch({ control, name: 'bio' })?.length ?? 0;
  const selectedDomains = useWatch({ control, name: 'domainIds' }) ?? [];

  if (step === 0) {
    return (
      <>
        <Field
          label="Titre de profil"
          error={errors.headline?.message}
          counter={{ value: headlineLen, min: 10, max: 140 }}
          hint="Ex. : « Ingénieure logicielle — j’accompagne les débutants vers leur premier emploi tech »"
        >
          <Input {...register('headline')} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Poste actuel" optional error={errors.currentPosition?.message}>
            <Input autoComplete="organization-title" {...register('currentPosition')} />
          </Field>
          <Field label="Organisation" optional error={errors.organization?.message}>
            <Input autoComplete="organization" {...register('organization')} />
          </Field>
          <Field label="Années d’expérience" error={errors.yearsExperience?.message}>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={60}
              {...register('yearsExperience')}
            />
          </Field>
          <Field label="Ville" optional error={errors.city?.message}>
            <Input placeholder="Conakry" {...register('city')} />
          </Field>
        </div>
        <Field
          label="Présentation"
          error={errors.bio?.message}
          counter={{ value: bioLen, min: 80, max: 2000 }}
          hint="Votre expérience, ce que vous aimez transmettre et votre façon d’accompagner."
        >
          <Textarea rows={6} {...register('bio')} />
        </Field>
      </>
    );
  }

  if (step === 1) {
    return (
      <>
        <Controller
          control={control}
          name="domainIds"
          render={({ field }) => (
            <ChoiceGroup
              label="Domaines d’accompagnement"
              columns="cards"
              multiple
              max={4}
              options={domainOptions(domains)}
              value={field.value}
              onChange={field.onChange}
              error={errors.domainIds?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="expertise"
          render={({ field }) => (
            <TagInput
              label="Compétences"
              value={field.value}
              onChange={field.onChange}
              placeholder="Ex. : React, levée de fonds, CV…"
              suggestions={domains
                .filter((d) => selectedDomains.includes(d.id))
                .flatMap((d) => d.topics)}
              error={errors.expertise?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="languages"
          render={({ field }) => (
            <ChoiceGroup
              label="Langues parlées"
              multiple
              max={6}
              options={LANGUAGES.map((l) => ({ value: l, label: l }))}
              value={field.value}
              onChange={field.onChange}
              error={errors.languages?.message}
            />
          )}
        />
      </>
    );
  }

  return (
    <>
      <Controller
        control={control}
        name="modalities"
        render={({ field }) => (
          <ChoiceGroup
            label="Modalités proposées"
            multiple
            max={3}
            options={modalityOptions}
            value={field.value}
            onChange={field.onChange}
            error={errors.modalities?.message}
          />
        )}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Controller
          control={control}
          name="sessionDurationMin"
          render={({ field }) => (
            <Field label="Durée habituelle d’une séance">
              <NativeSelect
                value={field.value}
                onChange={(e) => field.onChange(Number(e.target.value))}
              >
                {[30, 45, 60, 90].map((d) => (
                  <option key={d} value={d}>
                    {d} minutes
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
        />
      </div>
    </>
  );
}
