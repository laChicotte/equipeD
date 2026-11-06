import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/misc';
import { ResourceDetailView } from '@/features/resources/resource-detail';

export const metadata: Metadata = { title: 'Ressource · Bibliothèque' };

export default function ResourcePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <ResourceDetailView />
    </Suspense>
  );
}
