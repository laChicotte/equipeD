import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <nav aria-label="Étapes">
      <p className="mb-3 text-sm font-semibold text-teal-700">
        Étape {current + 1} sur {steps.length}
      </p>
      <ol className="flex items-center gap-2">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={label} className="flex flex-1 items-center gap-2" aria-current={active ? 'step' : undefined}>
              <span
                className={cn(
                  'inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                  done && 'bg-teal-700 text-white',
                  active && 'bg-ink-900 text-white ring-4 ring-ink-100',
                  !done && !active && 'bg-surface text-muted-foreground ring-1 ring-border-strong',
                )}
              >
                {done ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : i + 1}
              </span>
              <span
                className={cn(
                  'hidden truncate text-sm font-medium sm:block',
                  active ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {label}
              </span>
              {i < steps.length - 1 && (
                <span className={cn('h-px min-w-4 flex-1', done ? 'bg-teal-600' : 'bg-border-strong')} aria-hidden />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
