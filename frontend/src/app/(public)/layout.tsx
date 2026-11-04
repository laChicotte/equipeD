import { Suspense } from 'react';
import { DemoBanner } from '@/components/layout/demo-banner';
import { PublicFooter, PublicHeader } from '@/components/layout/public-header';

export default function PublicLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <DemoBanner />
      <Suspense fallback={<div className="h-16 border-b border-border bg-surface" />}>
        <PublicHeader />
      </Suspense>
      <main id="contenu" className="flex-1">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
