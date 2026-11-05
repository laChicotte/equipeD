'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useRegister } from '@/features/auth/api';
import { applyApiError } from '@/lib/forms';
import { cn } from '@/lib/utils';
import { AuthHeading, PasswordInput } from './password-input';

const schema = z.object({
  role: z.enum(['MENTEE', 'MENTOR']),
  firstName: z.string().trim().min(1, 'Saisissez votre prénom.').max(60),
  lastName: z.string().trim().min(1, 'Saisissez votre nom.').max(60),
  email: z.email('Saisissez une adresse email valide.'),
  password: z
    .string()
    .min(10, 'Au moins 10 caractères.')
    .max(128, '128 caractères au maximum.')
    .regex(/[A-Za-zÀ-ÿ]/, 'Au moins une lettre.')
    .regex(/\d/, 'Au moins un chiffre.'),
});
type Values = z.infer<typeof schema>;

const roles = [
  {
    value: 'MENTEE' as const,
    title: 'Je cherche un mentor',
    text: 'Étudiant·e, jeune diplômé·e, entrepreneur·e, en reconversion',
  },
  {
    value: 'MENTOR' as const,
    title: 'Je veux accompagner',
    text: 'Professionnel·le prêt·e à partager son expérience',
  },
];

export function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const registerUser = useRegister();
  const initialRole = params.get('role') === 'MENTOR' ? 'MENTOR' : 'MENTEE';

  const { register, handleSubmit, setError, control, setValue, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { role: initialRole, firstName: '', lastName: '', email: '', password: '' },
  });
  const role = useWatch({ control, name: 'role' });
  const password = useWatch({ control, name: 'password' }) ?? '';
  const rules = [
    { ok: password.length >= 10, label: '10 caractères minimum' },
    { ok: /[A-Za-zÀ-ÿ]/.test(password), label: 'Une lettre' },
    { ok: /\d/.test(password), label: 'Un chiffre' },
  ];

  const onSubmit = handleSubmit((values) => {
    registerUser.mutate(values, {
      onSuccess: () => {
        toast.success('Compte créé. Complétons votre profil.');
        router.replace('/onboarding');
      },
      onError: (error) => {
        applyApiError(error, setError, ['email', 'password', 'firstName', 'lastName', 'role']);
      },
    });
  });

  return (
    <div>
      <AuthHeading title="Créer un compte">
        Deux minutes suffisent. Vous compléterez ensuite votre profil.
      </AuthHeading>

      <form onSubmit={onSubmit} noValidate className="mt-8 grid gap-5">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Votre objectif</legend>
          <div role="radiogroup" className="grid gap-2">
            {roles.map(({ value, title, text }) => {
              const selected = role === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setValue('role', value)}
                  className={cn(
                    'flex items-center gap-3 rounded-md border px-3.5 py-3 text-left transition-colors duration-150',
                    selected
                      ? 'border-ink-900 bg-ink-50'
                      : 'border-border bg-surface hover:border-border-strong',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex size-[18px] shrink-0 items-center justify-center rounded-full border',
                      selected ? 'border-ink-900' : 'border-border-strong',
                    )}
                    aria-hidden
                  >
                    {selected && <span className="size-2.5 rounded-full bg-ink-900" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold text-ink-900">{title}</span>
                    <span className="block text-[13px] leading-snug text-muted-foreground">
                      {text}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Prénom" error={formState.errors.firstName?.message}>
            <Input autoComplete="given-name" {...register('firstName')} />
          </Field>
          <Field label="Nom" error={formState.errors.lastName?.message}>
            <Input autoComplete="family-name" {...register('lastName')} />
          </Field>
        </div>
        <Field label="Adresse email" error={formState.errors.email?.message}>
          <Input type="email" autoComplete="email" inputMode="email" {...register('email')} />
        </Field>
        <Field label="Mot de passe" error={formState.errors.password?.message}>
          <PasswordInput autoComplete="new-password" {...register('password')} />
        </Field>
        <ul className="-mt-2 flex flex-wrap gap-x-4 gap-y-1" aria-label="Règles du mot de passe">
          {rules.map((r) => (
            <li
              key={r.label}
              className={cn(
                'flex items-center gap-1.5 text-xs',
                r.ok ? 'text-success-700' : 'text-muted-foreground',
              )}
            >
              <Check className={cn('size-3.5', !r.ok && 'opacity-30')} aria-hidden />
              {r.label}
              <span className="sr-only">{r.ok ? ' (respectée)' : ' (à respecter)'}</span>
            </li>
          ))}
        </ul>

        <Button type="submit" size="lg" loading={registerUser.isPending} className="w-full">
          Créer mon compte
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Vous avez déjà un compte ?{' '}
        <Link href="/connexion" className="font-semibold text-accent hover:underline">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
