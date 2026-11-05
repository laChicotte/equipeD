import type { Metadata } from 'next';
import { SessionsView } from '@/features/scheduling/sessions-view';

export const metadata: Metadata = { title: 'Séances' };

export default function SessionsPage() {
  return <SessionsView />;
}
