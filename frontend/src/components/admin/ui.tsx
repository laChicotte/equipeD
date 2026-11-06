'use client';

import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { formatNumber, Sparkline, type Point } from './charts';

/** Somme des 7 derniers jours comparée aux 7 précédents. */
export function weekDelta(points: Point[]) {
  const sum = (a: Point[]) => a.reduce((s, p) => s + p.count, 0);
  const current = sum(points.slice(-7));
  const previous = sum(points.slice(-14, -7));
  return { current, previous, diff: current - previous };
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  trend,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  hint?: ReactNode;
  /** Activité quotidienne : mini-courbe et variation sur 7 jours. */
  trend?: Point[];
}) {
  const delta = trend ? weekDelta(trend) : null;
  return (
    <div className="group relative min-w-0 overflow-hidden rounded-xl bg-surface p-3.5 shadow-card sm:p-5 ring-1 ring-border/70 transition-shadow hover:shadow-raised">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-[12px] font-medium text-muted-foreground sm:text-[13px]">
          {label}
        </span>
        <span
          className="hidden size-9 shrink-0 items-center justify-center rounded-lg bg-ink-50 sm:inline-flex text-ink-800 transition-colors group-hover:bg-ink-900 group-hover:text-amber-400"
          aria-hidden
        >
          <Icon className="size-[18px]" />
        </span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-3 sm:mt-3">
        <p className="font-display text-[24px] leading-none font-semibold text-ink-900 sm:text-[30px]">
          {typeof value === 'number' ? formatNumber(value) : value}
        </p>
        {trend && (
          <span className="hidden sm:block">
            <Sparkline points={trend} />
          </span>
        )}
      </div>
      <div className="mt-2 flex min-h-5 items-center gap-2 text-[12px] text-muted-foreground sm:mt-3">
        {delta && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold tabular-nums',
              delta.diff > 0 && 'bg-success-50 text-success-700',
              delta.diff < 0 && 'bg-warning-50 text-warning-700',
              delta.diff === 0 && 'bg-surface-muted text-ink-700',
            )}
          >
            {delta.diff > 0 ? (
              <ArrowUpRight className="size-3.5" aria-hidden />
            ) : delta.diff < 0 ? (
              <ArrowDownRight className="size-3.5" aria-hidden />
            ) : (
              <Minus className="size-3.5" aria-hidden />
            )}
            {delta.diff > 0 ? '+' : ''}
            {delta.diff}
          </span>
        )}
        <span className="hidden truncate sm:inline">
          {hint ?? (delta ? 'vs les 7 jours précédents' : '')}
        </span>
      </div>
    </div>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('rounded-xl bg-surface shadow-card ring-1 ring-border/70', className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6">
        <div className="min-w-0">
          <h2 className="font-display text-[16px] font-semibold text-ink-900">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
        </div>
        {action}
      </header>
      <div className={cn('p-5 sm:px-6', bodyClassName)}>{children}</div>
    </section>
  );
}

export function Segmented<V extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: V;
  options: { value: V; label: string; hint?: string }[];
  onChange: (v: V) => void;
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="scrollbar-none inline-flex max-w-full overflow-x-auto rounded-lg bg-surface-muted p-1"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-[13px] font-semibold whitespace-nowrap transition-all duration-150',
            value === o.value
              ? 'bg-surface text-ink-900 shadow-card'
              : 'text-muted-foreground hover:text-ink-900',
          )}
        >
          {o.label}
          {o.hint && (
            <span className="text-[12px] font-normal text-muted-foreground tabular-nums">
              {o.hint}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
