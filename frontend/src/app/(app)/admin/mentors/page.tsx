import type { Metadata } from 'next';
import { AdminMentorsView } from '@/features/admin/admin-views';

export const metadata: Metadata = { title: 'Mentors' };

export default function AdminMentorsPage() {
  return <AdminMentorsView />;
}
