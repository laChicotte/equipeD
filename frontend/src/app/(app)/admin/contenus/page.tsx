import type { Metadata } from 'next';
import { ContentView } from '@/features/platform/views';

export const metadata: Metadata = { title: 'Contenus' };

export default function Page() {
  return <ContentView />;
}
