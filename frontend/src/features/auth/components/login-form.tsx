'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Eye, EyeOff, FlaskConical } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { homeFor, useLogin } from '@/features/auth/api';
import { api } from '@/lib/api';
import { applyApiError } from '@/lib/forms';
import type { Me } from '@/lib/types';
import { isDemoMode } from '@/lib/utils';

const schema = z.object({
  email: z.email('Saisissez une adresse email valide.'),
  password: z.string().min(1, 'Saisissez votre mot de passe.'),
});
type Values = z.infer<typeof schema>;

const DEMO_ACCOUNTS = [
  { email: 'aminata@demo.talents-connectes.test', label: 'Aminata', role: 'Mentorée — parcours principal' },
  { email: 'fatoumata@demo.talents-connectes.test', label: 'Fatoumata', role: 'Mentore — développement web' },
  { email: 'mohamed@demo.talents-connectes.test', label: 'Mohamed', role: 'Mentoré déjà accompagné' },
  { email: 'thierno@demo.talents-connectes.test', label: 'Thierno', role: 'Mentor — entrepreneuriat' },
  { email: 'admin@demo.talents-connectes.test', label: 'Admin', role: 'Modération' },
];
const DEMO_PASSWORD = 'Mentorat2026!';

function safeNext(next: string | null): string | null {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null;
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const login = useLogin();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });
  const { register, handleSubmit, setError, setValue, formState } = form;

  const onSubmit = handleSubmit((values) => {
    login.mutate(values, {
      onSuccess: async () => {
        const me = await api<Me>('/auth/me');
        const next = safeNext(params.get('next'));
        router.replace(me.hasProfile || me.role === 'ADMIN' ? (next ?? homeFor(me)) : '/onboarding');
      },
      onError: (error) => applyApiError(error, setError, ['email', 'password']),
    });
  });

  return (
    <div className="animate-fade-in">
      <h1 className="text-4xl font-display font-semibold tracking-[-0.03em] text-ink-900">Bon retour parmi nous</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">
        Connectez-vous pour retrouver vos demandes, vos séances et vos conversations.
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-8 grid gap-5">
        <Field label="Adresse email" error={formState.errors.email?.message}>
          <Input type="email" autoComplete="email" inputMode="email" {...register('email')} />
        </Field>
        <Field label="Mot de passe" error={formState.errors.password?.message}>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className="pr-12"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute top-1/2 right-1 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground"
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            </button>
          </div>
        </Field>
        <Button type="submit" size="lg" loading={login.isPending} className="mt-1 w-full">
          Se connecter
          {!login.isPending && <ArrowRight aria-hidden />}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Pas encore de compte ?{' '}
        <Link href="/inscription" className="font-semibold text-accent hover:underline">
          Créer un compte
        </Link>
      </p>

      {isDemoMode && (
        <div className="mt-8 rounded-lg border border-dashed border-border-strong bg-surface p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <FlaskConical className="size-3.5 text-amber-500" aria-hidden />
            Comptes de démonstration (fictifs)
          </p>
          <ul className="mt-3 grid gap-1">
            {DEMO_ACCOUNTS.map((a) => (
              <li key={a.email}>
                <button
                  type="button"
                  onClick={() => {
                    setValue('email', a.email, { shouldValidate: true });
                    setValue('password', DEMO_PASSWORD, { shouldValidate: true });
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-surface-muted"
                >
                  <span className="font-semibold">{a.label}</span>
                  <span className="truncate text-xs text-muted-foreground">{a.role}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 px-2.5 text-xs text-muted-foreground">
            Cliquez pour pré-remplir, puis « Se connecter ».
          </p>
        </div>
      )}
    </div>
  );
}
