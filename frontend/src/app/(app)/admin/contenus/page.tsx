import type { Metadata } from 'next';
import { ContentView } from '@/features/superadmin/views';

export const metadata: Metadata = { title: 'Contenus' };

export default function Page() {
  return <ContentView />;
}
