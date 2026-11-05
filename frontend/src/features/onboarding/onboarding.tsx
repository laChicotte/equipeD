'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Globe2,
  MapPin,
  MonitorSmartphone,
  Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Controller, useForm, useWatch, type FieldPath } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { DomainIcon } from '@/components/domain-icon';
import { ErrorState } from '@/components/feedback/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChoiceGroup, TagInput } from '@/components/ui/choices';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/misc';
import { useMe } from '@/features/auth/api';
import { useDomains, useProfile, useSaveProfile } from '@/features/catalog/api';
import { applyApiError } from '@/lib/forms';
import {
  CAMPUS_FRANCE_NOTICE,
  LANGUAGES,
  isCampusFrance,
  modalityLabels,
  situationLabels,
} from '@/lib/labels';
import type { Domain, MenteeSituation, Modality, ProfileMe } from '@/lib/types';
import { Stepper } from './stepper';

const modalityIcons: Record<Modality, ReactNode> = {
  REMOTE: <MonitorSmartphone className="size-4" aria-hidden />,
  IN_PERSON: <MapPin className="size-4" aria-hidden />,
  HYBRID: <Globe2 className="size-4" aria-hidden />,
};
const modalityOptions = (Object.keys(modalityLabels) as Modality[]).map((m) => ({
  value: m,
  label: modalityLabels[m],
  icon: modalityIcons[m],
}));

function domainOptions(domains: Domain[]) {
  return domains.map((d) => ({
    value: d.id,
    label: d.name,
    description: isCampusFrance(d.slug) ? CAMPUS_FRANCE_NOTICE : d.topics.slice(0, 3).join(' · '),
    icon: <DomainIcon name={d.icon} className="size-4" />,
  }));
}

function StepShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="animate-fade-in">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-6 grid gap-6">{children}</div>
    </div>
  );
}

function Nav({
  step,
  total,
  onBack,
  onNext,
  saving,
}: {
  step: number;
  total: number;
  onBack: () => void;
  onNext: () => void;
  saving: boolean;
}) {
  const last = step === total - 1;
  return (
    <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-5">
      <Button type="button" variant="ghost" onClick={onBack} disabled={step === 0 || saving}>
        <ArrowLeft aria-hidden />
        Retour
      </Button>
      <Button
        type={last ? 'submit' : 'button'}
        onClick={last ? undefined : onNext}
        loading={saving}
      >
        {last ? 'Enregistrer mon profil' : 'Continuer'}
        {!last && <ArrowRight aria-hidden />}
      </Button>
    </div>
  );
}

/* ── Mentoré ─────────────────────────────────────────────────────────── */

const menteeSchema = z.object({
  situation: z.enum(Object.keys(situationLabels) as [MenteeSituation, ...MenteeSituation[]], {
    error: 'Choisissez votre situation.',
  }),
  city: z.string().trim().max(80).optional(),
  interestDomainIds: z
    .array(z.string())
    .min(1, 'Choisissez au moins un domaine.')
    .max(5, '5 domaines au maximum.'),
  desiredSkills: z.array(z.string()).max(15),
  goalsSummary: z
    .string()
    .trim()
    .min(20, 'Décrivez votre objectif en 20 caractères au moins.')
    .max(1000, '1 000 caractères au maximum.'),
  preferredModality: z.enum(['REMOTE', 'IN_PERSON', 'HYBRID'], {
    error: 'Choisissez une modalité.',
  }),
});
type MenteeValues = z.infer<typeof menteeSchema>;

const menteeSteps: FieldPath<MenteeValues>[][] = [
  ['situation', 'city'],
  ['interestDomainIds', 'desiredSkills'],
  ['goalsSummary', 'preferredModality'],
];

function MenteeOnboarding({ domains, profile }: { domains: Domain[]; profile: ProfileMe }) {
  const router = useRouter();
  const save = useSaveProfile('MENTEE');
  const [step, setStep] = useState(0);
  const existing = profile.menteeProfile;

  const form = useForm<MenteeValues>({
    resolver: zodResolver(menteeSchema),
    defaultValues: {
      situation: existing?.situation,
      city: existing?.city ?? '',
      interestDomainIds: existing?.interests.map((d) => d.id) ?? [],
      desiredSkills: existing?.desiredSkills ?? [],
      goalsSummary: existing?.goalsSummary ?? '',
      preferredModality: existing?.preferredModality ?? 'REMOTE',
    },
  });
  const { control, register, formState, trigger, handleSubmit, setError } = form;
  const errors = formState.errors;
  const goalLength = useWatch({ control, name: 'goalsSummary' })?.length ?? 0;
  const interestIds = useWatch({ control, name: 'interestDomainIds' });

  const next = async () => {
    if (await trigger(menteeSteps[step])) setStep((s) => s + 1);
  };

  const onSubmit = handleSubmit(
    (v) => {
      save.mutate(
        { ...v, city: v.city || undefined },
        {
          onSuccess: () => {
            toast.success(
              existing ? 'Profil mis à jour.' : 'Profil enregistré. Voici des mentors pour vous.',
            );
            router.replace(existing ? '/tableau-de-bord' : '/mentors');
          },
          onError: (e) => {
            if (applyApiError(e, setError, Object.keys(menteeSchema.shape))) {
              const idx = menteeSteps.findIndex((f) => f.some((n) => form.getFieldState(n).error));
              if (idx >= 0) setStep(idx);
            }
          },
        },
      );
    },
    () => {
      const idx = menteeSteps.findIndex((f) => f.some((n) => form.getFieldState(n).error));
      if (idx >= 0) setStep(idx);
    },
  );

  return (
    <form onSubmit={onSubmit} noValidate>
      <Stepper
        steps={['Situation', 'Domaines et compétences', 'Objectif et modalité']}
        current={step}
      />
      <Card className="mt-6 p-5 sm:p-8">
        {step === 0 && (
          <StepShell
            title="Où en êtes-vous ?"
            description="Cela aide les mentors à comprendre votre contexte."
          >
            <Controller
              control={control}
              name="situation"
              render={({ field }) => (
                <ChoiceGroup
                  label="Votre situation actuelle"
                  columns="cards"
                  options={(Object.keys(situationLabels) as MenteeSituation[]).map((s) => ({
                    value: s,
                    label: situationLabels[s],
                  }))}
                  value={field.value ? [field.value] : []}
                  onChange={(v) => field.onChange(v[0])}
                  error={errors.situation?.message}
                />
              )}
            />
            <Field label="Ville" optional error={errors.city?.message}>
              <Input placeholder="Conakry" autoComplete="address-level2" {...register('city')} />
            </Field>
          </StepShell>
        )}
        {step === 1 && (
          <StepShell
            title="Sur quoi souhaitez-vous être accompagné·e ?"
            description="Choisissez jusqu’à 5 domaines, puis les compétences que vous voulez développer."
          >
            <Controller
              control={control}
              name="interestDomainIds"
              render={({ field }) => (
                <ChoiceGroup
                  label="Domaines d’intérêt"
                  columns="cards"
                  multiple
                  max={5}
                  options={domainOptions(domains)}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.interestDomainIds?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="desiredSkills"
              render={({ field }) => (
                <TagInput
                  label="Compétences recherchées"
                  optional
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Ex. : React, prise de parole, business plan…"
                  suggestions={domains
                    .filter((d) => interestIds.includes(d.id))
                    .flatMap((d) => d.topics)}
                />
              )}
            />
          </StepShell>
        )}
        {step === 2 && (
          <StepShell
            title="Quel est votre objectif ?"
            description="Soyez concret : c’est ce que les mentors liront en premier."
          >
            <Field
              label="Votre objectif principal"
              error={errors.goalsSummary?.message}
              counter={{ value: goalLength, min: 20, max: 1000 }}
              hint="Ex. : « Construire un portfolio de 3 projets et décrocher un premier stage en développement web d’ici 6 mois. »"
            >
              <Textarea rows={5} {...register('goalsSummary')} />
            </Field>
            <Controller
              control={control}
              name="preferredModality"
              render={({ field }) => (
                <ChoiceGroup
                  label="Modalité préférée"
                  options={modalityOptions}
                  value={field.value ? [field.value] : []}
                  onChange={(v) => field.onChange(v[0])}
                  error={errors.preferredModality?.message}
                />
              )}
            />
          </StepShell>
        )}
        <Nav
          step={step}
          total={3}
          onBack={() => setStep((s) => s - 1)}
          onNext={next}
          saving={save.isPending}
        />
      </Card>
    </form>
  );
}

/* ── Mentor ──────────────────────────────────────────────────────────── */

const mentorSchema = z.object({
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
type MentorValues = z.infer<typeof mentorSchema>;

const mentorSteps: FieldPath<MentorValues>[][] = [
  ['headline', 'currentPosition', 'organization', 'yearsExperience', 'city', 'bio'],
  ['expertise', 'domainIds', 'languages'],
  ['modalities', 'sessionDurationMin'],
];

function MentorOnboarding({ domains, profile }: { domains: Domain[]; profile: ProfileMe }) {
  const router = useRouter();
  const save = useSaveProfile('MENTOR');
  const [step, setStep] = useState(0);
  const existing = profile.mentorProfile;

  const form = useForm<MentorValues>({
    resolver: zodResolver(mentorSchema),
    defaultValues: {
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
    },
  });
  const { control, register, formState, trigger, handleSubmit, setError } = form;
  const errors = formState.errors;
  const headlineLen = useWatch({ control, name: 'headline' })?.length ?? 0;
  const bioLen = useWatch({ control, name: 'bio' })?.length ?? 0;
  const selectedDomains = useWatch({ control, name: 'domainIds' });

  const goToFirstError = () => {
    const idx = mentorSteps.findIndex((f) => f.some((n) => form.getFieldState(n).error));
    if (idx >= 0) setStep(idx);
  };

  const onSubmit = handleSubmit((v) => {
    save.mutate(
      {
        ...v,
        currentPosition: v.currentPosition || undefined,
        organization: v.organization || undefined,
        city: v.city || undefined,
      },
      {
        onSuccess: () => {
          toast.success(
            existing
              ? 'Profil mis à jour.'
              : 'Profil mentor enregistré. Ajoutez vos premiers créneaux.',
          );
          router.replace(existing ? '/tableau-de-bord' : '/disponibilites');
        },
        onError: (e) => {
          if (applyApiError(e, setError, Object.keys(mentorSchema.shape))) goToFirstError();
        },
      },
    );
  }, goToFirstError);

  return (
    <form onSubmit={onSubmit} noValidate>
      <Stepper
        steps={['Parcours', 'Expertise et domaines', 'Modalités et capacité']}
        current={step}
      />
      <Card className="mt-6 p-5 sm:p-8">
        {step === 0 && (
          <StepShell
            title="Votre parcours"
            description="Ce que les mentorés verront en premier sur votre fiche."
          >
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
          </StepShell>
        )}
        {step === 1 && (
          <StepShell
            title="Votre expertise"
            description="Ces informations alimentent la recherche et les suggestions."
          >
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
          </StepShell>
        )}
        {step === 2 && (
          <StepShell
            title="Modalités et capacité"
            description="Vous pourrez les modifier à tout moment."
          >
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
            <div className="flex gap-3 rounded-lg bg-surface-muted p-4 text-sm text-muted-foreground">
              <Users className="mt-0.5 size-4 shrink-0 text-teal-700" aria-hidden />
              <p>
                Votre profil sera vérifié par l’équipe de la plateforme. Le badge « Profil vérifié »
                apparaît une fois la vérification effectuée.
              </p>
            </div>
          </StepShell>
        )}
        <Nav
          step={step}
          total={3}
          onBack={() => setStep((s) => s - 1)}
          onNext={async () => {
            if (await trigger(mentorSteps[step])) setStep((s) => s + 1);
          }}
          saving={save.isPending}
        />
      </Card>
    </form>
  );
}

export function Onboarding() {
  const { data: me } = useMe();
  const domains = useDomains();
  const profile = useProfile(!!me);

  if (domains.isError || profile.isError) {
    return (
      <ErrorState
        error={domains.error ?? profile.error}
        onRetry={() => {
          void domains.refetch();
          void profile.refetch();
        }}
      />
    );
  }

  const ready = me && domains.data && profile.data;
  const editing = !!(profile.data?.mentorProfile || profile.data?.menteeProfile);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-8">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Building2 className="size-4" aria-hidden />
          {me?.role === 'MENTOR' ? 'Profil mentor' : 'Profil mentoré·e'}
        </p>
        <h1 className="mt-2 text-4xl font-display font-semibold tracking-[-0.03em] text-ink-900">
          {editing ? 'Modifier votre profil' : `Bienvenue${me ? `, ${me.firstName}` : ''} !`}
        </h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">
          {me?.role === 'MENTOR'
            ? 'Présentez votre parcours pour que les mentorés vous trouvent.'
            : 'Quelques informations pour vous proposer les mentors les plus pertinents.'}
        </p>
      </div>
      {!ready ? (
        <div className="grid gap-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : me.role === 'MENTOR' ? (
        <MentorOnboarding domains={domains.data} profile={profile.data} />
      ) : (
        <MenteeOnboarding domains={domains.data} profile={profile.data} />
      )}
    </div>
  );
}
