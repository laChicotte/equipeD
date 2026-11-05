import { Suspense } from 'react';
import { AppShell, ShellSkeleton } from '@/components/layout/app-shell';

export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
