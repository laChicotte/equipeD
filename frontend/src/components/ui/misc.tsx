'use client';

import {
  Checkbox as CheckboxPrimitive,
  DropdownMenu as DM,
  Progress as ProgressPrimitive,
  Separator as SeparatorPrimitive,
  Slider as SliderPrimitive,
  Tabs as TabsPrimitive,
} from 'radix-ui';
import { Check } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/* ── Tabs ─────────────────────────────────────────────────────────────── */

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        'scrollbar-thin inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-md border border-border bg-surface-muted p-1',
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-2 rounded-[7px] px-3.5 text-sm font-semibold text-muted-foreground transition-colors duration-150 hover:text-foreground data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-card [&_svg]:size-4',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn(
        'mt-5 focus-visible:outline-none data-[state=active]:animate-fade-in',
        className,
      )}
      {...props}
    />
  );
}

/* ── Checkbox ─────────────────────────────────────────────────────────── */

export function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'peer inline-flex size-5 shrink-0 items-center justify-center rounded-[5px] border border-border-strong bg-surface transition-colors duration-150 hover:border-accent data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=checked]:text-white',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Check className="size-3.5" strokeWidth={3} aria-hidden />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

/* ── Progress ─────────────────────────────────────────────────────────── */

export function Progress({
  value,
  className,
  label,
}: {
  value: number;
  className?: string;
  label?: string;
}) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <ProgressPrimitive.Root
      value={v}
      aria-label={label ?? 'Progression'}
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-ink-100', className)}
    >
      <ProgressPrimitive.Indicator
        className="h-full rounded-full bg-teal-600 transition-[width] duration-300 ease-out"
        style={{ width: `${v}%` }}
      />
    </ProgressPrimitive.Root>
  );
}

/* ── Slider ───────────────────────────────────────────────────────────── */

export function Slider({ className, ...props }: ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      className={cn('relative flex h-6 w-full touch-none items-center select-none', className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 grow overflow-hidden rounded-full bg-ink-100">
        <SliderPrimitive.Range className="absolute h-full bg-teal-600" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label="Progression"
        className="block size-5 rounded-full border-2 border-teal-700 bg-surface shadow-card transition-shadow hover:shadow-focus focus-visible:shadow-focus focus-visible:outline-none"
      />
    </SliderPrimitive.Root>
  );
}

/* ── Separator ────────────────────────────────────────────────────────── */

export function Separator({ className, ...props }: ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      className={cn(
        'shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px',
        className,
      )}
      {...props}
    />
  );
}

/* ── Dropdown menu ────────────────────────────────────────────────────── */

export const DropdownMenu = DM.Root;
export const DropdownMenuTrigger = DM.Trigger;

export function DropdownMenuContent({ className, ...props }: ComponentProps<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content
        sideOffset={8}
        align="end"
        className={cn(
          'z-50 min-w-56 rounded-lg border border-border bg-surface p-1.5 shadow-raised data-[state=open]:animate-scale-in',
          className,
        )}
        {...props}
      />
    </DM.Portal>
  );
}

export function DropdownMenuItem({ className, ...props }: ComponentProps<typeof DM.Item>) {
  return (
    <DM.Item
      className={cn(
        'flex min-h-10 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-sm text-foreground outline-none transition-colors data-[highlighted]:bg-surface-muted [&_svg]:size-4 [&_svg]:text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof DM.Label>) {
  return <DM.Label className={cn('px-2.5 py-2', className)} {...props} />;
}

export function DropdownMenuSeparator() {
  return <DM.Separator className="my-1 h-px bg-border" />;
}

/* ── Skeleton ─────────────────────────────────────────────────────────── */

export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-md bg-ink-100/70', className)}
      {...props}
    />
  );
}
