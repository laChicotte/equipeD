'use client';

import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  counter?: { value: number; min?: number; max: number };
  className?: string;
  children: ReactElement<Record<string, unknown>>;
}

/** Champ de formulaire accessible : label explicite, aide et erreur liées par aria-describedby. */
export function Field({ label, hint, error, optional, counter, className, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy || undefined,
      })
    : children;

  const counterTone =
    counter &&
    (counter.value > counter.max ||
      (counter.min && counter.value > 0 && counter.value < counter.min))
      ? 'text-warning-700'
      : 'text-muted-foreground';

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-foreground">
          {label}
          {optional && (
            <span className="ml-1.5 font-normal text-muted-foreground">(facultatif)</span>
          )}
        </label>
        {counter && (
          <span className={cn('text-xs tabular-nums', counterTone)} aria-live="polite">
            {counter.value}/{counter.max}
            {counter.min ? (
              <span className="sr-only"> caractères, minimum {counter.min}</span>
            ) : null}
          </span>
        )}
      </div>
      {control}
      {hint && !error && (
        <p id={hintId} className="text-[13px] leading-snug text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="text-[13px] font-medium leading-snug text-danger-700"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export function FieldGroupLabel({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p id={id} className="text-sm font-semibold text-foreground">
      {children}
    </p>
  );
}
