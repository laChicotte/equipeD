import type { Metadata } from 'next';
import { AvailabilityView } from '@/features/scheduling/availability-view';

export const metadata: Metadata = { title: 'Disponibilités' };

export default function AvailabilityPage() {
  return <AvailabilityView />;
}
