'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Check, Copy, KeyRound } from 'lucide-react';
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

/**
 * La plateforme n'envoie pas encore d'emails : on le dit, et on explique la marche à suivre
 * plutôt que d'afficher un faux formulaire « recevoir un lien par email ».
 */
export function ForgotPassword() {
  const steps = [
    'Contactez l’équipe de la plateforme, sur le stand du programme ou auprès de votre structure, avec l’adresse email de votre compte.',
    'Après vérification de votre identité, elle vous remet un lien personnel, valable 2 heures et utilisable une seule fois.',
    'Ouvrez ce lien et choisissez un nouveau mot de passe. Vos anciennes sessions sont alors fermées.',
  ];
  return (
    <div>
      <AuthHeading title="Mot de passe oublié">
        L’équipe de la plateforme vous aide à récupérer votre compte, en trois étapes.
      </AuthHeading>
      <ol className="mt-8 grid gap-5">
        {steps.map((step, i) => (
          <li key={step} className="flex gap-3.5 text-[15px] leading-relaxed text-foreground">
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
      <Button asChild variant="secondary" size="lg" className="mt-8 w-full">
        <Link href="/connexion">
          <ArrowLeft aria-hidden />
          Retour à la connexion
        </Link>
      </Button>
    </div>
  );
}

/* ── Page « Nouveau mot de passe » (lien remis par l'équipe) ──────────── */

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
