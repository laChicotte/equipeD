'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { homeFor, useLogin } from '@/features/auth/api';
import { api } from '@/lib/api';
import { applyApiError } from '@/lib/forms';
import type { Me } from '@/lib/types';
import { isDemoMode, isStaff } from '@/lib/utils';
import { AuthHeading, PasswordInput } from './password-input';

const schema = z.object({
  email: z.email('Saisissez une adresse email valide.'),
  password: z.string().min(1, 'Saisissez votre mot de passe.'),
});
type Values = z.infer<typeof schema>;

const DEMO_ACCOUNTS = [
  {
    email: 'aminata@demo.talents-connectes.test',
    label: 'Aminata',
    role: 'Mentorée — parcours principal',
  },
  {
    email: 'fatoumata@demo.talents-connectes.test',
    label: 'Fatoumata',
    role: 'Mentore — développement web',
  },
  {
    email: 'mohamed@demo.talents-connectes.test',
    label: 'Mohamed',
    role: 'Mentoré déjà accompagné',
  },
  {
    email: 'thierno@demo.talents-connectes.test',
    label: 'Thierno',
    role: 'Mentor — entrepreneuriat',
  },
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

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });
  const { register, handleSubmit, setError, setValue, formState } = form;

  const onSubmit = handleSubmit((values) => {
    login.mutate(values, {
      onSuccess: async () => {
        const me = await api<Me>('/auth/me');
        const next = safeNext(params.get('next'));
        router.replace(me.hasProfile || isStaff(me.role) ? (next ?? homeFor(me)) : '/onboarding');
      },
      onError: (error) => applyApiError(error, setError, ['email', 'password']),
    });
  });

  return (
    <div>
      <AuthHeading title="Connexion">
        Retrouvez vos demandes, vos séances et vos conversations.
      </AuthHeading>

      <form onSubmit={onSubmit} noValidate className="mt-8 grid gap-5">
        <Field label="Adresse email" error={formState.errors.email?.message}>
          <Input type="email" autoComplete="email" inputMode="email" {...register('email')} />
        </Field>
        <div className="grid gap-2">
          <Field label="Mot de passe" error={formState.errors.password?.message}>
            <PasswordInput autoComplete="current-password" {...register('password')} />
          </Field>
          <Link
            href="/mot-de-passe-oublie"
            className="justify-self-end text-sm font-medium text-accent hover:underline"
          >
            Mot de passe oublié ?
          </Link>
        </div>
        <Button type="submit" size="lg" loading={login.isPending} className="w-full">
          Se connecter
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Pas encore de compte ?{' '}
        <Link href="/inscription" className="font-semibold text-accent hover:underline">
          Créer un compte
        </Link>
      </p>

      {isDemoMode && (
        <details className="group mt-8 border-t border-border pt-4 text-sm">
          <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
            Essayer avec un compte de démonstration
          </summary>
          <ul className="mt-2 grid gap-0.5">
            {DEMO_ACCOUNTS.map((a) => (
              <li key={a.email}>
                <button
                  type="button"
                  onClick={() => {
                    setValue('email', a.email, { shouldValidate: true });
                    setValue('password', DEMO_PASSWORD, { shouldValidate: true });
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-surface-muted"
                >
                  <span className="font-semibold">{a.label}</span>
                  <span className="truncate text-xs text-muted-foreground">{a.role}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
