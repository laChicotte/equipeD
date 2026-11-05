import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/misc';
import { OfflineWorkspace } from '@/features/mentorships/workspace';

export const metadata: Metadata = { title: 'Espace de mentorat' };

/**
 * Espace de mentorat sans réseau : route statique (`?id=`), car la copie d'une route dynamique
 * ne peut pas s'afficher sans le serveur. Le service worker y redirige `/mentorats/<id>` hors ligne.
 */
export default function OfflineMentorshipPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <OfflineWorkspace />
    </Suspense>
  );
}
