import { isDemoMode } from '@/lib/utils';

export function DemoBanner() {
  if (!isDemoMode) return null;
  return (
    <p className="bg-ink-950 px-4 py-1.5 print:hidden text-center text-[13px] font-medium text-ink-100">
      Environnement de démonstration : comptes et profils fictifs
    </p>
  );
}
