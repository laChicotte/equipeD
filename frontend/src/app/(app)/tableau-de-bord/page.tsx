import type { Metadata } from 'next';
import { Dashboard } from '@/features/dashboard/dashboard';

export const metadata: Metadata = { title: 'Tableau de bord' };

export default function DashboardPage() {
  return <Dashboard />;
}
