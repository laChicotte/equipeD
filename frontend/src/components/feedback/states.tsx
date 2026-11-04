'use client';

import { CircleAlert, RotateCw, ShieldAlert, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { errorMessage, isApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-lg border border-dashed border-border-strong bg-surface px-6 py-12 text-center',
        className,
      )}
    >
      <span className="mb-4 inline-flex size-12 items-center justify-center rounded-full bg-teal-50 text-teal-700 ring-8 ring-teal-50/50">
        <Icon className="size-5" aria-hidden />
      </span>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  if (isApiError(error) && error.statusCode === 403) return <AccessDenied message={error.message} />;
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center rounded-lg border border-danger-700/15 bg-danger-50/60 px-6 py-10 text-center',
        className,
      )}
    >
      <CircleAlert className="mb-3 size-6 text-danger-700" aria-hidden />
      <h3 className="text-base font-semibold text-foreground">Le chargement a échoué</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          <RotateCw aria-hidden />
          Réessayer
        </Button>
      )}
    </div>
  );
}

export function AccessDenied({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-border bg-surface px-6 py-14 text-center">
      <span className="mb-4 inline-flex size-12 items-center justify-center rounded-full bg-ink-50 text-ink-900">
        <ShieldAlert className="size-5" aria-hidden />
      </span>
      <h3 className="text-base font-semibold">Accès refusé</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        {message ?? 'Cette page n’est pas accessible avec votre compte.'}
      </p>
      <Button asChild variant="secondary" size="sm" className="mt-5">
        <Link href="/tableau-de-bord">Retour au tableau de bord</Link>
      </Button>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
