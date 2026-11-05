import type { ReactNode } from 'react';
import { Logo } from '@/components/layout/logo';

/** Pages de compte : le logo et le formulaire, centrés, rien d'autre. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main
      id="contenu"
      className="flex flex-1 flex-col items-center justify-center bg-surface px-5 py-10 sm:bg-background"
    >
      <Logo compactOnMobile={false} />
      <div className="mt-8 w-full max-w-[420px] sm:rounded-xl sm:bg-surface sm:p-8 sm:shadow-card sm:ring-1 sm:ring-border/70">
        {children}
      </div>
    </main>
  );
}
