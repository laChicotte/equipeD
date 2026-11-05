import type { Metadata } from 'next';
import { Dashboard } from '@/features/dashboard/dashboard';
import { HomeLayout } from '@/features/dashboard/home-layout';

export const metadata: Metadata = { title: 'Accueil' };

export default function DashboardPage() {
  return (
    <HomeLayout>
      <Dashboard />
    </HomeLayout>
  );
}
