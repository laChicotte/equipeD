import type { Metadata } from 'next';
import { BecomeMentorPage } from '@/features/verification/verification-views';

export const metadata: Metadata = { title: 'Devenir mentor' };

export default function DevenirMentorPage() {
  return <BecomeMentorPage />;
}
