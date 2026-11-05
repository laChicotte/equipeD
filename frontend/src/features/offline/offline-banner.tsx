'use client';

import { useQueryClient } from '@tanstack/react-query';
import { CloudOff, RefreshCw } from 'lucide-react';
import { useOnline } from '@/lib/connectivity';
import { formatDate, formatTime } from '@/lib/format';
import { shouldPersistQuery } from './cache';
import { useOutbox } from './outbox';

/** Date de la donnée la plus récente reçue du serveur (session mise à part). */
function useLastSync() {
  const qc = useQueryClient();
  const times = qc
    .getQueryCache()
    .getAll()
    .filter((q) => shouldPersistQuery(q) && q.queryKey[0] !== 'auth')
    .map((q) => q.state.dataUpdatedAt);
  return times.length ? new Date(Math.max(...times)).toISOString() : null;
}

/** Bandeau d'état : hors ligne avec la date des données, ou envoi de la file d'attente. */
export function OfflineBanner() {
  const online = useOnline();
  const outbox = useOutbox();
  const lastSync = useLastSync();
  const waiting = outbox.filter((e) => !e.error).length;
  if (online && waiting === 0) return null;

  const pending =
    waiting > 0 ? `${waiting} message${waiting > 1 ? 's' : ''} en attente d’envoi` : '';

  return (
    <div
      role="status"
      data-testid="bandeau-hors-ligne"
      className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-1.5 text-center text-[13px] font-medium text-[#7a4a0f] print:hidden"
    >
      {online ? (
        <>
          <RefreshCw className="size-3.5 shrink-0 animate-spin" aria-hidden />
          Envoi en cours : {pending}
        </>
      ) : (
        <>
          <CloudOff className="size-3.5 shrink-0" aria-hidden />
          <span>
            Hors ligne
            {lastSync && (
              <>
                , données du {formatDate(lastSync)} à {formatTime(lastSync)}
              </>
            )}
            {pending && ` · ${pending}, envoi au retour du réseau`}
          </span>
        </>
      )}
    </div>
  );
}
