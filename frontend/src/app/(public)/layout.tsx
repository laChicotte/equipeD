import { PublicAssistant } from '@/features/ai/assistant-widget';
import { Suspense } from 'react';
import { PublicFooter, PublicHeader } from '@/components/layout/public-header';

export default function PublicLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Suspense fallback={<div className="h-16 bg-background" />}>
        <PublicHeader />
      </Suspense>
      <main id="contenu" className="flex-1">
        {children}
      </main>
      <Suspense fallback={<div className="min-h-[70svh] bg-ink-950" />}>
        <PublicFooter />
      </Suspense>
      <PublicAssistant />
    </div>
  );
}
