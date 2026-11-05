import type { Metadata } from 'next';
import { Library } from '@/features/resources/library';

export const metadata: Metadata = { title: 'Ressources et conseils' };

export default function ResourcesPage() {
  return <Library />;
}
