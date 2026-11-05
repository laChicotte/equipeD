import type { Metadata } from 'next';
import { AuditView } from '@/features/superadmin/views';

export const metadata: Metadata = { title: 'Journal d’audit' };

export default function Page() {
  return <AuditView />;
}
