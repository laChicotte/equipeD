import type { Metadata } from 'next';
import { CertificatesAdminView } from '@/features/superadmin/views';

export const metadata: Metadata = { title: 'Certificats' };

export default function Page() {
  return <CertificatesAdminView />;
}
