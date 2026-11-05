'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, BadgeCheck, GraduationCap, Info, Send } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ErrorState, PageHeader } from '@/components/feedback/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/misc';
import { useMe } from '@/features/auth/api';
import { useDomains } from '@/features/catalog/api';
import {
  mentorDefaults,
  mentorPayload,
  mentorSchema,
  MentorStepFields,
} from '@/features/onboarding/mentor-fields';
import { applyApiError } from '@/lib/forms';
import { useMyVerification, useVerificationMutations } from './api';
import { ProofPicker, RequestSummary } from './parts';

const httpsUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === '' || /^https:\/\/\S+\.\S+/.test(v), 'Adresse https attendue.')
  .optional();

function warnFailed(failed: string[]) {
  if (failed.length) {
    toast.warning(
      `Demande envoyée, mais ${failed.length > 1 ? 'ces justificatifs n’ont' : 'ce justificatif n’a'} pas pu être joint${failed.length > 1 ? 's' : ''} : ${failed.join(', ')}. Ajoutez-les depuis le suivi de la demande.`,
    );
  }
}

/* ── Mentor : demande de vérification (page « Mon compte ») ─────────────── */

const verificationSchema = z.object({
  message: z
    .string()
    .trim()
    .min(30, '30 caractères au minimum.')
    .max(2000, '2 000 caractères au maximum.'),
  profileUrl: httpsUrl,
});
type VerificationValues = z.infer<typeof verificationSchema>;

function VerificationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { requestVerification } = useVerificationMutations();
  const [files, setFiles] = useState<File[]>([]);
  const form = useForm<VerificationValues>({
    resolver: zodResolver(verificationSchema),
    defaultValues: { message: '', profileUrl: '' },
  });
  const messageLen = useWatch({ control: form.control, name: 'message' })?.length ?? 0;
  const errors = form.formState.errors;

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      form.reset();
      setFiles([]);
    }
  };

  const submit = form.handleSubmit((v) =>
    requestVerification.mutate(
      { message: v.message, profileUrl: v.profileUrl || undefined, files },
      {
        onSuccess: ({ failed }) => {
          toast.success('Demande envoyée : l’équipe va examiner votre profil.');
          warnFailed(failed);
          close(false);
        },
        onError: (e) => applyApiError(e, form.setError, ['message', 'profileUrl']),
      },
    ),
  );

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        title="Faire vérifier mon profil"
        description="L’équipe vérifie votre parcours avant d’attribuer le badge « Profil vérifié »."
        className="sm:max-w-xl"
      >
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <Field
            label="Votre parcours en quelques lignes"
            error={errors.message?.message}
            counter={{ value: messageLen, min: 30, max: 2000 }}
            hint="Postes occupés, employeurs, diplômes, références : ce que l’équipe peut vérifier."
          >
            <Textarea rows={5} {...form.register('message')} />
          </Field>
          <Field
            label="Profil professionnel en ligne"
            optional
            error={errors.profileUrl?.message}
            hint="LinkedIn, site professionnel ou portfolio (adresse https)."
          >
            <Input
              type="url"
              inputMode="url"
              placeholder="https://www.linkedin.com/in/…"
              {...form.register('profileUrl')}
            />
          </Field>
          <ProofPicker files={files} onChange={setFiles} />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => close(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={requestVerification.isPending}>
              <Send aria-hidden />
              Envoyer la demande
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Section « Vérification du profil » d'un mentor. */
export function MentorVerificationSection() {
  const mine = useMyVerification();
  const [open, setOpen] = useState(false);
  if (mine.isPending) return <Skeleton className="h-24" />;
  if (mine.isError) return <ErrorState error={mine.error} onRetry={() => void mine.refetch()} />;

  const status = mine.data.mentorProfile?.verificationStatus ?? 'UNVERIFIED';
  const latest = mine.data.requests[0];

  if (status === 'VERIFIED') {
    return (
      <p className="flex items-center gap-2 text-[15px] text-ink-900">
        <BadgeCheck className="size-5 fill-amber-400 text-white" aria-hidden />
        Votre profil est vérifié : le badge apparaît sur votre fiche et dans l’annuaire.
      </p>
    );
  }
  if (latest?.status === 'PENDING') return <RequestSummary request={latest} />;

  return (
    <div className="grid gap-4">
      {latest?.status === 'REJECTED' && <RequestSummary request={latest} />}
      <p className="text-[15px] text-foreground">
        Les mentorés font davantage confiance à un profil vérifié. Présentez votre parcours et
        joignez vos justificatifs : l’équipe vous répond dans les meilleurs délais.
      </p>
      <Button className="justify-self-start" onClick={() => setOpen(true)}>
        <BadgeCheck aria-hidden />
        {latest?.status === 'REJECTED'
          ? 'Envoyer une nouvelle demande'
          : 'Demander la vérification'}
      </Button>
      <VerificationDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

/** Section « Devenir mentor » d'un mentoré (page « Mon compte »). */
export function BecomeMentorSection() {
  const mine = useMyVerification();
  if (mine.isPending) return <Skeleton className="h-24" />;
  if (mine.isError) return <ErrorState error={mine.error} onRetry={() => void mine.refetch()} />;
  const latest = mine.data.requests.find((r) => r.kind === 'MENTOR_APPLICATION');
  if (latest?.status === 'PENDING') return <RequestSummary request={latest} />;
  return (
    <div className="grid gap-4">
      {latest?.status === 'REJECTED' && <RequestSummary request={latest} />}
      <p className="text-[15px] text-foreground">
        Vous avez progressé et vous voulez transmettre à votre tour ? Présentez votre parcours et
        vos compétences : après validation par l’équipe, votre compte devient un compte mentor.
      </p>
      <Button asChild className="justify-self-start">
        <Link href="/devenir-mentor">
          <GraduationCap aria-hidden />
          {latest?.status === 'REJECTED' ? 'Déposer une nouvelle candidature' : 'Devenir mentor'}
        </Link>
      </Button>
    </div>
  );
}

/* ── Mentoré : candidature pour devenir mentor ──────────────────────────── */

const applicationSchema = mentorSchema.extend({
  message: z
    .string()
    .trim()
    .min(30, '30 caractères au minimum.')
    .max(2000, '2 000 caractères au maximum.'),
  profileUrl: httpsUrl,
});
type ApplicationValues = z.infer<typeof applicationSchema>;

function ApplicationForm() {
  const router = useRouter();
  const domains = useDomains();
  const { apply } = useVerificationMutations();
  const [files, setFiles] = useState<File[]>([]);
  const form = useForm<ApplicationValues>({
    resolver: zodResolver(applicationSchema),
    defaultValues: { ...mentorDefaults(null), yearsExperience: 1, message: '', profileUrl: '' },
  });
  const messageLen = useWatch({ control: form.control, name: 'message' })?.length ?? 0;
  const errors = form.formState.errors;

  if (domains.isPending) return <Skeleton className="h-96" />;
  if (domains.isError)
    return <ErrorState error={domains.error} onRetry={() => void domains.refetch()} />;

  const submit = form.handleSubmit(
    (v) => {
      const { message, profileUrl, ...profile } = v;
      apply.mutate(
        { ...mentorPayload(profile), message, profileUrl: profileUrl || undefined, files },
        {
          onSuccess: ({ failed }) => {
            toast.success('Candidature envoyée : l’équipe va l’examiner.');
            warnFailed(failed);
            router.push('/compte');
          },
          onError: (e) => applyApiError(e, form.setError, Object.keys(applicationSchema.shape)),
        },
      );
    },
    () => toast.error('Certains champs sont à compléter : vérifiez les sections en rouge.'),
  );

  const section = (n: number, title: string, description: string, children: React.ReactNode) => (
    <Card className="p-5 sm:p-8">
      <h2 className="font-display text-[19px] font-semibold tracking-[-0.02em] text-ink-900">
        {n}. {title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-6 grid gap-6">{children}</div>
    </Card>
  );

  return (
    <form onSubmit={submit} noValidate className="grid gap-6">
      {section(
        1,
        'Votre parcours',
        'Ce que les mentorés verront sur votre fiche si votre candidature est acceptée.',
        <MentorStepFields step={0} form={form} domains={domains.data} />,
      )}
      {section(
        2,
        'Votre expertise',
        'Les domaines et compétences dans lesquels vous pouvez accompagner.',
        <MentorStepFields step={1} form={form} domains={domains.data} />,
      )}
      {section(
        3,
        'Modalités',
        'Comment vous accompagnerez, une fois mentor.',
        <MentorStepFields step={2} form={form} domains={domains.data} />,
      )}
      {section(
        4,
        'Motivation et justificatifs',
        'Ce qui permet à l’équipe d’évaluer votre candidature.',
        <>
          <Field
            label="Pourquoi souhaitez-vous devenir mentor ?"
            error={errors.message?.message}
            counter={{ value: messageLen, min: 30, max: 2000 }}
            hint="Votre parcours depuis votre accompagnement, votre expérience, ce que vous voulez transmettre."
          >
            <Textarea rows={5} {...form.register('message')} />
          </Field>
          <Field
            label="Profil professionnel en ligne"
            optional
            error={errors.profileUrl?.message}
            hint="LinkedIn, site professionnel ou portfolio (adresse https)."
          >
            <Input
              type="url"
              inputMode="url"
              placeholder="https://www.linkedin.com/in/…"
              {...form.register('profileUrl')}
            />
          </Field>
          <ProofPicker files={files} onChange={setFiles} />
          <p className="flex gap-2.5 rounded-md bg-surface-muted p-3.5 text-[13px] text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0 text-teal-700" aria-hidden />
            Vous restez mentoré·e pendant l’examen. Si vous suivez encore un mentorat, il devra être
            clôturé avant que votre compte devienne un compte mentor ; vos demandes en attente
            seront alors annulées. Votre historique d’accompagnement est conservé.
          </p>
        </>,
      )}
      <div className="flex justify-end">
        <Button type="submit" size="lg" loading={apply.isPending}>
          Envoyer ma candidature
          <ArrowRight aria-hidden />
        </Button>
      </div>
    </form>
  );
}

/** Page « Devenir mentor ». */
export function BecomeMentorPage() {
  const { data: me } = useMe();
  const mine = useMyVerification(!!me && me.role === 'MENTEE');
  if (!me) return null;

  const header = (
    <PageHeader
      eyebrow="Évolution du compte"
      title="Devenir mentor"
      description="Vous avez été accompagné·e, vous avez acquis des compétences : transmettez à votre tour."
    />
  );

  if (me.role !== 'MENTEE') {
    return (
      <div className="mx-auto max-w-3xl">
        {header}
        <Card className="mt-8 p-6 text-[15px]">
          {me.role === 'MENTOR' ? (
            <>
              Vous êtes déjà mentor.{' '}
              <Link href="/compte" className="font-semibold text-teal-700 hover:underline">
                Faites vérifier votre profil
              </Link>{' '}
              depuis « Mon compte ».
            </>
          ) : (
            'Cette démarche concerne les comptes mentorés.'
          )}
        </Card>
      </div>
    );
  }

  const pending = mine.data?.requests.find(
    (r) => r.kind === 'MENTOR_APPLICATION' && r.status === 'PENDING',
  );
  return (
    <div className="mx-auto max-w-3xl">
      {header}
      <div className="mt-8">
        {mine.isPending ? (
          <Skeleton className="h-96" />
        ) : mine.isError ? (
          <ErrorState error={mine.error} onRetry={() => void mine.refetch()} />
        ) : pending ? (
          <Card className="grid gap-4 p-6">
            <p className="text-[15px]">
              Votre candidature est en cours d’examen. Vous serez notifié·e dès que l’équipe aura
              pris sa décision.
            </p>
            <RequestSummary request={pending} />
          </Card>
        ) : (
          <ApplicationForm />
        )}
      </div>
    </div>
  );
}
