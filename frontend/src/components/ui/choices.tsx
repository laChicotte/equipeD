'use client';

import { Check, Plus, X } from 'lucide-react';
import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* ── Choix multiples / uniques sous forme de puces ───────────────────── */

interface Option<V extends string> {
  value: V;
  label: string;
  description?: string;
  icon?: ReactNode;
}

export function ChoiceGroup<V extends string>({
  label,
  options,
  value,
  onChange,
  multiple = false,
  max,
  error,
  hint,
  columns = 'auto',
}: {
  label: string;
  options: Option<V>[];
  value: V[];
  onChange: (next: V[]) => void;
  multiple?: boolean;
  max?: number;
  error?: string;
  hint?: ReactNode;
  columns?: 'auto' | 'cards';
}) {
  const id = useId();
  const toggle = (v: V) => {
    if (!multiple) return onChange([v]);
    if (value.includes(v)) return onChange(value.filter((x) => x !== v));
    if (max && value.length >= max) return;
    onChange([...value, v]);
  };

  return (
    <fieldset aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}>
      <legend className="mb-2 flex w-full items-baseline justify-between gap-3 text-sm font-semibold">
        {label}
        {multiple && max && (
          <span className="text-xs font-normal text-muted-foreground tabular-nums">
            {value.length}/{max}
          </span>
        )}
      </legend>
      <div
        role={multiple ? 'group' : 'radiogroup'}
        className={cn(columns === 'cards' ? 'grid gap-2.5 sm:grid-cols-2' : 'flex flex-wrap gap-2')}
      >
        {options.map((o) => {
          const selected = value.includes(o.value);
          const disabled = !selected && multiple && !!max && value.length >= max;
          return (
            <button
              key={o.value}
              type="button"
              role={multiple ? 'checkbox' : 'radio'}
              aria-checked={selected}
              disabled={disabled}
              onClick={() => toggle(o.value)}
              className={cn(
                'relative text-left transition-[border-color,background-color,box-shadow] duration-150 disabled:cursor-not-allowed disabled:opacity-45',
                columns === 'cards'
                  ? 'flex min-h-14 items-start gap-3 rounded-lg border p-3.5 pr-10'
                  : 'inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-medium',
                selected
                  ? 'border-accent bg-teal-50 text-teal-800 shadow-[0_0_0_1px_var(--color-accent)]'
                  : 'border-border bg-surface text-foreground hover:border-border-strong',
              )}
            >
              {o.icon && (
                <span className={cn('shrink-0', selected ? 'text-teal-700' : 'text-muted-foreground')}>{o.icon}</span>
              )}
              {columns === 'cards' ? (
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{o.label}</span>
                  {o.description && (
                    <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{o.description}</span>
                  )}
                </span>
              ) : (
                o.label
              )}
              {selected &&
                (columns === 'cards' ? (
                  <span className="absolute top-3.5 right-3.5 inline-flex size-5 items-center justify-center rounded-full bg-teal-700 text-white">
                    <Check className="size-3" strokeWidth={3} aria-hidden />
                  </span>
                ) : (
                  <Check className="size-3.5" strokeWidth={3} aria-hidden />
                ))}
            </button>
          );
        })}
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-2 text-[13px] text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-2 text-[13px] font-medium text-danger-700">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/* ── Saisie de mots-clés ─────────────────────────────────────────────── */

export function TagInput({
  label,
  value,
  onChange,
  max = 15,
  placeholder,
  suggestions = [],
  error,
  hint,
  optional,
}: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
  placeholder?: string;
  suggestions?: string[];
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState('');

  const add = (raw: string) => {
    const tag = raw.trim().replace(/\s+/g, ' ');
    if (!tag || tag.length > 60 || value.length >= max) return;
    if (value.some((v) => v.toLowerCase() === tag.toLowerCase())) return;
    onChange([...value, tag]);
    setDraft('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(draft);
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  const remaining = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()));

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
          {optional && <span className="ml-1.5 font-normal text-muted-foreground">(facultatif)</span>}
        </label>
        <span className="text-xs text-muted-foreground tabular-nums">
          {value.length}/{max}
        </span>
      </div>
      <div
        className={cn(
          'flex min-h-11 flex-wrap items-center gap-1.5 rounded-md border bg-surface p-1.5 shadow-card transition-[border-color,box-shadow] focus-within:border-accent focus-within:shadow-focus',
          error ? 'border-danger-700' : 'border-border hover:border-border-strong',
        )}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex h-8 items-center gap-1 rounded-sm bg-ink-50 pr-1 pl-2.5 text-sm font-medium text-ink-900"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((v) => v !== tag))}
              className="inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-ink-100 hover:text-foreground"
              aria-label={`Retirer ${tag}`}
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => add(draft)}
          disabled={value.length >= max}
          placeholder={value.length ? '' : placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : `${id}-hint`}
          className="h-8 min-w-32 flex-1 bg-transparent px-1.5 text-[15px] outline-none placeholder:text-muted-foreground/75"
        />
      </div>
      {remaining.length > 0 && value.length < max && (
        <div className="flex flex-wrap gap-1.5 pt-1" aria-label="Suggestions">
          {remaining.slice(0, 8).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="inline-flex h-8 items-center gap-1 rounded-full border border-dashed border-border-strong px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-accent hover:text-teal-800"
            >
              <Plus className="size-3" aria-hidden />
              {s}
            </button>
          ))}
        </div>
      )}
      {!error && (
        <p id={`${id}-hint`} className="text-[13px] text-muted-foreground">
          {hint ?? 'Appuyez sur Entrée pour ajouter.'}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} role="alert" className="text-[13px] font-medium text-danger-700">
          {error}
        </p>
      )}
    </div>
  );
}
