import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/misc';
import { VerifyEmail } from '@/features/auth/components/verify-email';

export const metadata: Metadata = { title: 'Confirmer mon adresse email' };

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<Skeleton className="h-56" />}>
      <VerifyEmail />
    </Suspense>
  );
}
