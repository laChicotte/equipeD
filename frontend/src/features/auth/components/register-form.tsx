'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Check, GraduationCap, Presentation } from 'lucide-react';
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
    icon: GraduationCap,
    title: 'Je cherche un mentor',
    text: 'Étudiant·e, jeune diplômé·e, entrepreneur·e, en reconversion…',
  },
  {
    value: 'MENTOR' as const,
    icon: Presentation,
    title: 'Je deviens mentor',
    text: 'Professionnel·le prêt·e à partager son expérience.',
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
    <div className="animate-fade-in">
      <h1 className="text-[28px] font-semibold tracking-tight">Créer votre compte</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">
        Deux minutes suffisent. Vous compléterez ensuite votre profil.
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-8 grid gap-5">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Vous êtes…</legend>
          <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
            {roles.map(({ value, icon: Icon, title, text }) => {
              const selected = role === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setValue('role', value)}
                  className={cn(
                    'relative flex flex-col items-start gap-2 rounded-lg border bg-surface p-4 text-left transition-[border-color,box-shadow] duration-150',
                    selected
                      ? 'border-accent shadow-[0_0_0_3px_rgb(11_122_115/0.15)]'
                      : 'border-border hover:border-border-strong',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex size-9 items-center justify-center rounded-md',
                      selected ? 'bg-teal-700 text-white' : 'bg-surface-muted text-ink-700',
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="text-sm font-semibold">{title}</span>
                  <span className="text-xs leading-snug text-muted-foreground">{text}</span>
                  {selected && (
                    <span className="absolute top-3 right-3 inline-flex size-5 items-center justify-center rounded-full bg-teal-700 text-white">
                      <Check className="size-3" strokeWidth={3} aria-hidden />
                    </span>
                  )}
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
          <Input type="password" autoComplete="new-password" {...register('password')} />
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

        <Button type="submit" size="lg" loading={registerUser.isPending} className="mt-1 w-full">
          Créer mon compte
          {!registerUser.isPending && <ArrowRight aria-hidden />}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Déjà inscrit·e ?{' '}
        <Link href="/connexion" className="font-semibold text-accent hover:underline">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
