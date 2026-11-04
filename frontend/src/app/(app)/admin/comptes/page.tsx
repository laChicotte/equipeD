import type { Metadata } from 'next';
import { AdminUsersView } from '@/features/admin/admin-views';

export const metadata: Metadata = { title: 'Comptes' };

export default function AdminUsersPage() {
  return <AdminUsersView />;
}
