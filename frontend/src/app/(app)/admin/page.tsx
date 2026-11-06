import type { Metadata } from 'next';
import { AdminDashboard } from '@/features/admin/dashboard';

export const metadata: Metadata = { title: 'Tableau de bord · Administration' };

export default function AdminPage() {
  return <AdminDashboard />;
}
