import type { Metadata } from 'next';
import { MentorshipsList } from '@/features/mentorships/mentorships-list';

export const metadata: Metadata = { title: 'Mentorats' };

export default function MentorshipsPage() {
  return <MentorshipsList />;
}
