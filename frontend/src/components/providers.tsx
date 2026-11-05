'use client';

import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import { isApiError } from '@/lib/api';
import { TooltipProvider } from '@/components/ui/tooltip';
import { meQuery } from '@/features/auth/api';
import { CallProvider } from '@/features/calls/call-provider';
import { useServiceWorker } from '@/lib/pwa';
import { RealtimeProvider } from '@/lib/realtime';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) => {
          if (isApiError(error) && error.statusCode >= 400 && error.statusCode < 500) return false;
          return failureCount < 2;
        },
      },
      mutations: { retry: false },
    },
  });
}

/**
 * Canal temps réel et appels montés à la racine : ils survivent aux changements de page
 * (un appel en cours n'est pas coupé en passant de la messagerie à l'annuaire).
 */
function SessionServices({ children }: { children: ReactNode }) {
  // Observation passive de la session (sans requête) : un `useMe` à la racine résoudrait la session
  // avant l'hydratation des zones Suspense et provoquerait une erreur d'hydratation.
  const { data: me } = useQuery({ ...meQuery, enabled: false });
  return (
    <RealtimeProvider enabled={!!me}>
      <CallProvider>{children}</CallProvider>
    </RealtimeProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(makeQueryClient);
  useServiceWorker();
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider delayDuration={200}>
        <SessionServices>{children}</SessionServices>
      </TooltipProvider>
      <Toaster
        position="top-right"
        closeButton
        toastOptions={{
          classNames: {
            toast:
              'rounded-lg border border-border bg-surface text-foreground shadow-raised font-sans text-sm',
            description: 'text-muted-foreground',
          },
        }}
      />
    </QueryClientProvider>
  );
}
