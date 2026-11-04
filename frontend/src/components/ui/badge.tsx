import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export const badgeVariants = cva(
  'inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-sm border px-2 py-0.5 text-xs font-semibold leading-5 [&_svg]:size-3.5 [&_svg]:shrink-0',
  {
    variants: {
      tone: {
        neutral: 'border-border bg-surface-muted text-ink-700',
        teal: 'border-teal-100 bg-teal-50 text-teal-800',
        ink: 'border-ink-100 bg-ink-50 text-ink-900',
        amber: 'border-amber-100 bg-amber-50 text-[#7a4a0f]',
        verified: 'border-amber-400 bg-amber-400 text-highlight-foreground',
        success: 'border-success-700/15 bg-success-50 text-success-700',
        warning: 'border-warning-700/15 bg-warning-50 text-warning-700',
        danger: 'border-danger-700/15 bg-danger-50 text-danger-700',
        outline: 'border-border bg-surface text-foreground',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
