import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/misc';
import { AccountView } from '@/features/account/account-view';

export const metadata: Metadata = { title: 'Mon compte' };

export default function AccountPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-[600px] max-w-[1040px]" />}>
      <AccountView />
    </Suspense>
  );
}
