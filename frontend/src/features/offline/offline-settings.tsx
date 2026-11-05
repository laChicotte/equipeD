'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmButton } from '@/components/ui/confirm';
import { NativeSelect } from '@/components/ui/input';
import {
  setDataSaverPreference,
  useDataSaver,
  useDataSaverPreference,
  type DataSaverPreference,
} from '@/lib/data-saver';
import { clearOfflineData } from './cache';
import { resetOutbox, useOutbox } from './outbox';

/** Réglage de l'économie de données (section « Données » de la page Mon compte). */
export function DataSaverSetting() {
  const preference = useDataSaverPreference();
  const active = useDataSaver();
  return (
    <div className="grid gap-1.5 sm:justify-items-end">
      <label htmlFor="economie-donnees" className="sr-only">
        Économie de données
      </label>
      <NativeSelect
        id="economie-donnees"
        className="h-10 w-full sm:w-52"
        value={preference}
        onChange={(e) => setDataSaverPreference(e.target.value as DataSaverPreference)}
      >
        <option value="auto">Automatique</option>
        <option value="on">Activée</option>
        <option value="off">Désactivée</option>
      </NativeSelect>
      <span className="text-[13px] text-muted-foreground">
        {active ? 'Active en ce moment' : 'Inactive en ce moment'}
      </span>
    </div>
  );
}

/** Effacement immédiat des données gardées pour la consultation hors ligne. */
export function ClearOfflineButton() {
  const qc = useQueryClient();
  const waiting = useOutbox().length;
  const [busy, setBusy] = useState(false);
  return (
    <ConfirmButton
      variant="secondary"
      title="Effacer les données de cet appareil ?"
      description={
        waiting > 0
          ? `${waiting} message(s) en attente d’envoi seront perdus. Le reste se téléchargera de nouveau avec du réseau.`
          : 'Elles se téléchargeront de nouveau avec du réseau. Vos données sur la plateforme ne changent pas.'
      }
      confirmLabel="Effacer"
      loading={busy}
      onConfirm={() => {
        setBusy(true);
        resetOutbox();
        void clearOfflineData().finally(() => {
          setBusy(false);
          void qc.invalidateQueries();
          toast.success('Données hors ligne effacées de cet appareil');
        });
      }}
    >
      <Trash2 aria-hidden />
      Effacer
    </ConfirmButton>
  );
}
