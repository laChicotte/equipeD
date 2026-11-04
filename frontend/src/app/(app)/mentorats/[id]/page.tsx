import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/misc';
import { Workspace } from '@/features/mentorships/workspace';

export const metadata: Metadata = { title: 'Espace de mentorat' };

export default function MentorshipPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Workspace />
    </Suspense>
  );
}
