import { FlaskConical } from 'lucide-react';
import { isDemoMode } from '@/lib/utils';

export function DemoBanner() {
  if (!isDemoMode) return null;
  return (
    <div className="flex items-center justify-center gap-2 bg-ink-950 px-4 py-1.5 text-center text-xs font-medium text-ink-100">
      <FlaskConical className="size-3.5 text-amber-400" aria-hidden />
      Environnement de démonstration — données fictives
    </div>
  );
}
