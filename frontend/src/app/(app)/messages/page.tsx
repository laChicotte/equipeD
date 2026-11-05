import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/misc';
import { Messaging } from '@/features/messages/messaging';

export const metadata: Metadata = { title: 'Messagerie' };

export default function MessagesPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-[600px] max-w-[1128px]" />}>
      <Messaging />
    </Suspense>
  );
}
