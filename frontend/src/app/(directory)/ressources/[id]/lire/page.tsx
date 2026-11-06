import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/misc';
import { ResourceReader } from '@/features/resources/resource-reader';

export const metadata: Metadata = { title: 'Lecture · Bibliothèque' };

export default function ResourceReadPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <ResourceReader />
    </Suspense>
  );
}
