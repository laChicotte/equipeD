'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MailCheck, MailWarning, X } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { meKey, useMe } from '@/features/auth/api';
import { api, errorMessage } from '@/lib/api';
import type { Me } from '@/lib/types';
import { AuthHeading } from './password-input';

/** Page ouverte depuis le lien reçu par email. */
export function VerifyEmail() {
  const token = useSearchParams().get('jeton') ?? '';
  const qc = useQueryClient();
  const { data: me } = useMe();
  const verify = useMutation({
    mutationFn: () =>
      api<{ verified: true; email: string }>('/auth/email/verify', {
        method: 'POST',
        body: { token },
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: meKey }),
  });
  const started = useRef(false);
  useEffect(() => {
    if (started.current || token.length < 20) return;
    started.current = true;
    verify.mutate();
  }, [token, verify]);

  if (token.length < 20 || verify.isError) {
    return (
      <div className="text-center">
        <span className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-danger-50 text-danger-700">
          <MailWarning className="size-6" aria-hidden />
        </span>
        <AuthHeading title="Ce lien ne fonctionne pas">
          {verify.isError
            ? errorMessage(verify.error)
            : 'Il est incomplet. Vérifiez qu’il a été copié en entier.'}
        </AuthHeading>
        <Button asChild size="lg" className="mt-8 w-full">
          <Link href={me ? '/tableau-de-bord' : '/connexion'}>
            {me ? 'Recevoir un nouveau lien' : 'Se connecter'}
          </Link>
        </Button>
      </div>
    );
  }
  if (!verify.isSuccess) return <Skeleton className="h-56" />;

  return (
    <div className="text-center">
      <span className="mx-auto inline-flex size-14 animate-scale-in items-center justify-center rounded-full bg-success-50 text-success-700">
        <MailCheck className="size-6" aria-hidden />
      </span>
      <AuthHeading title="Adresse confirmée">
        Merci ! <strong className="text-ink-900">{verify.data.email}</strong> est confirmée. Vous
        pouvez maintenant envoyer des demandes de mentorat et partager des ressources.
      </AuthHeading>
      <Button asChild size="lg" className="mt-8 w-full">
        <Link href={me ? '/tableau-de-bord' : '/connexion'}>
          {me ? 'Continuer' : 'Se connecter'}
        </Link>
      </Button>
    </div>
  );
}

/** Bandeau de l'espace connecté tant que l'adresse n'est pas confirmée. */
export function VerifyEmailBanner({ me }: { me: Me }) {
  const [hidden, setHidden] = useState(false);
  const resend = useMutation({
    mutationFn: () =>
      api<{ sent: boolean; reason?: 'TOO_MANY' }>('/auth/email/resend', { method: 'POST' }),
  });
  if (!me.emailVerificationRequired || hidden) return null;
  return (
    <div className="mb-5 flex animate-slide-up flex-col gap-3 rounded-xl border border-amber-100 bg-amber-50 p-4 text-[#7a4a0f] sm:flex-row sm:items-center sm:px-5">
      <span className="hidden size-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 sm:inline-flex">
        <MailWarning className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 text-[14px]">
        <p className="font-semibold">Confirmez votre adresse email</p>
        <p>
          Un lien a été envoyé à <strong>{me.email}</strong>. Il faut l’ouvrir pour envoyer une
          demande de mentorat ou publier une ressource.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          loading={resend.isPending}
          disabled={resend.isSuccess && resend.data.sent}
          onClick={() =>
            resend.mutate(undefined, {
              onSuccess: (r) =>
                r.sent
                  ? toast.success('Email renvoyé', {
                      description: `Vérifiez la boîte ${me.email}.`,
                    })
                  : toast.error(
                      r.reason === 'TOO_MANY'
                        ? 'Plusieurs emails ont déjà été envoyés : patientez un peu et regardez les courriers indésirables.'
                        : 'L’email n’a pas pu être envoyé. Réessayez plus tard.',
                    ),
              onError: (e) => toast.error(errorMessage(e)),
            })
          }
        >
          {resend.isSuccess && resend.data.sent ? 'Email renvoyé' : 'Renvoyer l’email'}
        </Button>
        <button
          type="button"
          onClick={() => setHidden(true)}
          aria-label="Masquer"
          className="rounded-md p-1 hover:bg-amber-100"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
