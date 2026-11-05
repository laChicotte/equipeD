'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState, type ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** Champ de mot de passe avec affichage à la demande : utile sur un clavier de téléphone. */
export function PasswordInput({ className, ...props }: ComponentProps<'input'>) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative block">
      <Input {...props} type={visible ? 'text' : 'password'} className={cn('pr-12', className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute top-1/2 right-1 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground"
        aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        aria-pressed={visible}
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden />
        ) : (
          <Eye className="size-4" aria-hidden />
        )}
      </button>
    </span>
  );
}

/** En-tête commun des pages de compte. */
export function AuthHeading({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header className="text-center">
      <h1 className="font-display text-[28px] leading-tight font-semibold tracking-[-0.02em] text-ink-900">
        {title}
      </h1>
      {children && (
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{children}</p>
      )}
    </header>
  );
}
