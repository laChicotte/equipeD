import { Suspense } from 'react';
import { AdaptiveShell, ShellSkeleton } from '@/components/layout/app-shell';

export default function DirectoryLayout({ children }: LayoutProps<'/'>) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <AdaptiveShell>{children}</AdaptiveShell>
    </Suspense>
  );
}
