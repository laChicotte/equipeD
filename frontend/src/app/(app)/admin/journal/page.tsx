import type { Metadata } from 'next';
import { AuditView } from '@/features/platform/views';

export const metadata: Metadata = { title: 'Journal d’audit' };

export default function Page() {
  return <AuditView />;
}
