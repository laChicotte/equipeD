import type { Metadata } from 'next';
import { AdminOverviewView } from '@/features/admin/admin-views';

export const metadata: Metadata = { title: 'Administration' };

export default function AdminPage() {
  return <AdminOverviewView />;
}
