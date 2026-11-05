import type { Metadata } from 'next';
import { TeamView } from '@/features/platform/views';

export const metadata: Metadata = { title: 'Équipe' };

export default function Page() {
  return <TeamView />;
}
