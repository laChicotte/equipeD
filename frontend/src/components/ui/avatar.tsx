import { cn } from '@/lib/utils';
import { initials } from '@/lib/format';

const sizes = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-lg',
  xl: 'size-20 text-2xl',
} as const;

const tones = [
  'bg-teal-50 text-teal-800 ring-teal-100',
  'bg-ink-50 text-ink-900 ring-ink-100',
  'bg-amber-50 text-[#7a4a0f] ring-amber-100',
] as const;

function toneFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return tones[h % tones.length];
}

/** Avatar à initiales : aucune photo inventée (handoff §6). */
export function Avatar({
  person,
  size = 'md',
  className,
}: {
  person: { id?: string; firstName: string; lastName: string };
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold tracking-tight ring-1 ring-inset',
        sizes[size],
        toneFor(person.id ?? `${person.firstName}${person.lastName}`),
        className,
      )}
    >
      {initials(person)}
    </span>
  );
}
