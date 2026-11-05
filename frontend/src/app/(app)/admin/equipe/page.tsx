import type { Metadata } from 'next';
import { TeamView } from '@/features/superadmin/views';

export const metadata: Metadata = { title: 'Équipe' };

export default function Page() {
  return <TeamView />;
}
