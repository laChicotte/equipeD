import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Directory } from '@/features/mentors/directory';

export const metadata: Metadata = { title: 'Trouver un mentor' };

export default function MentorsPage() {
  return (
    <Suspense>
      <Directory />
    </Suspense>
  );
}
