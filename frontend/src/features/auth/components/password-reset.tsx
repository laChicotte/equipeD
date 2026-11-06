'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Check, Copy, KeyRound, MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/misc';
import { api, errorMessage } from '@/lib/api';
import { fullName, formatTime } from '@/lib/format';
import { applyApiError } from '@/lib/forms';
import { AuthHeading, PasswordInput } from './password-input';

/* ── Page « Mot de passe oublié » ─────────────────────────────────────── */

const TEAM_STEPS = [
  'Contactez l’équipe de la plateforme, sur le stand du programme ou auprès de votre structure, avec l’adresse email de votre compte.',
  'Après vérification de votre identité, elle vous remet un lien personnel, valable 2 heures et utilisable une seule fois.',
  'Ouvrez ce lien et choisissez un nouveau mot de passe. Vos anciennes sessions sont alors fermées.',
];

function TeamSteps() {
  return (
    <ol className="mt-6 grid gap-4">
      {TEAM_STEPS.map((step, i) => (
        <li key={step} className="flex gap-3.5 text-[14px] leading-relaxed text-foreground">
          <span
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-ink-50 text-[13px] font-semibold text-ink-900 tabular-nums"
            aria-hidden
          >
            {i + 1}
          </span>
          {step}
        </li>
      ))}
    </ol>
  );
}

const forgotSchema = z.object({
  email: z.string().trim().toLowerCase().email('Adresse email invalide.'),
});

/**
 * Mot de passe oublié : un lien est envoyé par email. La réponse est la même que l'adresse
 * corresponde à un compte ou non. Sans service d'email, la marche à suivre passe par l'équipe.
 */
export function ForgotPassword() {
  const [result, setResult] = useState<{ email: string; emailEnabled: boolean } | null>(null);
  const request = useMutation({
    mutationFn: (email: string) =>
      api<{ ok: true; emailEnabled: boolean }>('/auth/password-reset/request', {
        method: 'POST',
        body: { email },
      }),
  });
  const form = useForm<z.infer<typeof forgotSchema>>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });
  const onSubmit = form.handleSubmit((v) =>
    request.mutate(v.email, {
      onSuccess: (res) => setResult({ email: v.email, emailEnabled: res.emailEnabled }),
      onError: (e) => applyApiError(e, form.setError, ['email']),
    }),
  );

  if (result && !result.emailEnabled) {
    return (
      <div>
        <AuthHeading title="Mot de passe oublié">
          L’équipe de la plateforme vous aide à récupérer votre compte, en trois étapes.
        </AuthHeading>
        <TeamSteps />
        <Button asChild variant="secondary" size="lg" className="mt-8 w-full">
          <Link href="/connexion">
            <ArrowLeft aria-hidden />
            Retour à la connexion
          </Link>
        </Button>
      </div>
    );
  }

  if (result) {
    return (
      <div className="text-center">
        <span className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-success-50 text-success-700">
          <MailCheck className="size-6" aria-hidden />
        </span>
        <AuthHeading title="Vérifiez votre boîte mail">
          Si un compte existe pour <strong className="text-ink-900">{result.email}</strong>, un lien
          pour choisir un nouveau mot de passe vient de lui être envoyé. Il est valable 2 heures.
        </AuthHeading>
        <p className="mt-4 text-[13px] text-muted-foreground">
          Rien reçu après quelques minutes ? Regardez dans les courriers indésirables, ou réessayez.
        </p>
        <div className="mt-8 grid gap-2">
          <Button asChild size="lg" className="w-full">
            <Link href="/connexion">Retour à la connexion</Link>
          </Button>
          <Button variant="ghost" size="lg" className="w-full" onClick={() => setResult(null)}>
            Utiliser une autre adresse
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <AuthHeading title="Mot de passe oublié">
        Indiquez l’adresse email de votre compte : nous vous envoyons un lien pour choisir un
        nouveau mot de passe.
      </AuthHeading>
      <form onSubmit={onSubmit} noValidate className="mt-8 grid gap-5">
        <Field label="Adresse email" error={form.formState.errors.email?.message}>
          <Input
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="vous@exemple.com"
            {...form.register('email')}
          />
        </Field>
        <Button type="submit" size="lg" loading={request.isPending} className="w-full">
          Recevoir le lien
        </Button>
      </form>
      <details className="mt-8 border-t border-border pt-4 text-sm">
        <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
          Vous n’avez plus accès à votre boîte mail ?
        </summary>
        <TeamSteps />
      </details>
      <p className="mt-6 text-center text-sm">
        <Link href="/connexion" className="font-semibold text-accent hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </div>
  );
}

/* ── Page « Nouveau mot de passe » (lien reçu par email ou remis par l'équipe) ── */

const schema = z
  .object({
    newPassword: z
      .string()
      .min(10, 'Au moins 10 caractères.')
      .max(128, '128 caractères au maximum.')
      .regex(/(?=.*[A-Za-z])(?=.*\d)/, 'Au moins une lettre et un chiffre.'),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, {
    path: ['confirm'],
    message: 'Les deux mots de passe ne correspondent pas.',
  });
type Values = z.infer<typeof schema>;

export function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('jeton') ?? '';
  const check = useQuery({
    queryKey: ['password-reset', token],
    queryFn: () =>
      api<{ valid: true; firstName: string; expiresAt: string }>('/auth/password-reset/check', {
        method: 'POST',
        body: { token },
      }),
    enabled: token.length >= 20,
    retry: false,
    staleTime: Infinity,
  });
  const reset = useMutation({
    mutationFn: (newPassword: string) =>
      api<{ ok: true }>('/auth/password-reset', { method: 'POST', body: { token, newPassword } }),
  });
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: '', confirm: '' },
  });

  const onSubmit = form.handleSubmit((v) =>
    reset.mutate(v.newPassword, {
      onSuccess: () => {
        toast.success('Mot de passe modifié. Connectez-vous avec le nouveau.');
        router.replace('/connexion');
      },
      onError: (e) => applyApiError(e, form.setError, ['newPassword']),
    }),
  );

  if (token.length < 20 || check.isError) {
    return (
      <div>
        <AuthHeading title="Ce lien ne fonctionne pas">
          {check.isError
            ? errorMessage(check.error)
            : 'Il est incomplet. Vérifiez qu’il a été copié en entier.'}
        </AuthHeading>
        <Button asChild variant="secondary" size="lg" className="mt-8 w-full">
          <Link href="/mot-de-passe-oublie">Demander un nouveau lien</Link>
        </Button>
      </div>
    );
  }
  if (check.isPending) return <Skeleton className="h-72" />;

  return (
    <div>
      <AuthHeading title="Nouveau mot de passe">
        Bonjour {check.data.firstName}, choisissez votre nouveau mot de passe. Ce lien expire à{' '}
        {formatTime(check.data.expiresAt)}.
      </AuthHeading>
      <form onSubmit={onSubmit} noValidate className="mt-8 grid gap-5">
        <Field
          label="Nouveau mot de passe"
          hint="10 caractères au moins, dont une lettre et un chiffre."
          error={form.formState.errors.newPassword?.message}
        >
          <PasswordInput autoComplete="new-password" {...form.register('newPassword')} />
        </Field>
        <Field label="Confirmation" error={form.formState.errors.confirm?.message}>
          <PasswordInput autoComplete="new-password" {...form.register('confirm')} />
        </Field>
        <Button type="submit" size="lg" loading={reset.isPending} className="w-full">
          Enregistrer le mot de passe
        </Button>
      </form>
    </div>
  );
}

/* ── Administration : émission d'un lien ──────────────────────────────── */

interface IssuedLink {
  path: string;
  expiresAt: string;
}

/** Bouton « Lien de réinitialisation » d'une ligne de la liste des comptes. */
export function ResetLinkButton({
  user,
}: {
  user: { id: string; firstName: string; lastName: string };
}) {
  const [link, setLink] = useState<IssuedLink | null>(null);
  const [copied, setCopied] = useState(false);
  const issue = useMutation({
    mutationFn: () =>
      api<IssuedLink>(`/admin/users/${user.id}/password-reset-link`, {
        method: 'POST',
        body: {},
      }),
  });
  const url = link ? `${window.location.origin}${link.path}` : '';

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        loading={issue.isPending}
        onClick={() =>
          issue.mutate(undefined, {
            onSuccess: (res) => {
              setCopied(false);
              setLink(res);
            },
            onError: (e) => toast.error(errorMessage(e)),
          })
        }
      >
        <KeyRound aria-hidden />
        <span className="sr-only sm:not-sr-only">Réinitialiser</span>
      </Button>
      <Dialog open={!!link} onOpenChange={(o) => !o && setLink(null)}>
        <DialogContent
          title="Lien de réinitialisation"
          description={`Pour ${fullName(user)} : à usage unique, valable jusqu’à ${
            link ? formatTime(link.expiresAt) : ''
          }.`}
        >
          <p className="text-sm leading-relaxed text-muted-foreground">
            Vérifiez l’identité de la personne avant de lui transmettre ce lien. Il donne accès au
            compte : ne le publiez nulle part. Générer un nouveau lien annule celui-ci.
          </p>
          <div className="mt-4 flex gap-2">
            <Input readOnly value={url} aria-label="Lien" onFocus={(e) => e.target.select()} />
            <Button
              variant="secondary"
              onClick={() =>
                void navigator.clipboard.writeText(url).then(
                  () => setCopied(true),
                  () => toast.error('Copie impossible : sélectionnez le lien manuellement.'),
                )
              }
            >
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied ? 'Copié' : 'Copier'}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setLink(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
