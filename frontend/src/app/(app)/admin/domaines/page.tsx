import type { Metadata } from 'next';
import { DomainsAdmin } from '@/features/admin/domains-admin';

export const metadata: Metadata = { title: 'Domaines · Administration' };

export default function AdminDomainsPage() {
  return <DomainsAdmin />;
}
