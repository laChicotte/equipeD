import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/misc';
import { CertificatePage as CertificateScreen } from '@/features/certificates/certificates';

export const metadata: Metadata = { title: 'Certificat d’accompagnement' };

export default function CertificatePage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-[560px] max-w-[900px]" />}>
      <CertificateScreen />
    </Suspense>
  );
}
