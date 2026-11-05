import type { Metadata } from 'next';
import { OpportunitiesView } from '@/features/opportunities/opportunities-view';

export const metadata: Metadata = { title: 'Opportunités' };

export default function OpportunitiesPage() {
  return <OpportunitiesView />;
}
