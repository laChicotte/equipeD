import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/misc';
import { MentorProfile } from '@/features/mentors/mentor-profile';

export const metadata: Metadata = { title: 'Profil mentor' };

export default function MentorPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <MentorProfile />
    </Suspense>
  );
}
