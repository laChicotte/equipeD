import type { Metadata } from 'next';
import { PilotageView } from '@/features/superadmin/views';

export const metadata: Metadata = { title: 'Pilotage' };

export default function Page() {
  return <PilotageView />;
}
