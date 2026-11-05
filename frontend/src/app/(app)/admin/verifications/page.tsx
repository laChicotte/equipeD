import type { Metadata } from 'next';
import { AdminVerificationsView } from '@/features/verification/admin-view';

export const metadata: Metadata = { title: 'Vérifications' };

export default function VerificationsPage() {
  return <AdminVerificationsView />;
}
