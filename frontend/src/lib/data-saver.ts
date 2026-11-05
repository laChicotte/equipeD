'use client';

import { useSyncExternalStore } from 'react';
import { DATA_SAVER_STORAGE_KEY } from './data-saver-boot';

/**
 * Économie de données : activée par la personne, ou automatiquement quand le navigateur signale
 * un réseau 2G ou le mode « économie de données » du téléphone.
 * Effets : actualisations espacées, photos décoratives et de profil masquées, photos de
 * conversation chargées à la demande, pas de préchargement pour le mode hors ligne.
 */
export type DataSaverPreference = 'auto' | 'on' | 'off';

const listeners = new Set<() => void>();

interface NetworkInformation extends EventTarget {
  saveData?: boolean;
  effectiveType?: string;
}

const connection = () => (navigator as Navigator & { connection?: NetworkInformation }).connection;

export function getDataSaverPreference(): DataSaverPreference {
  if (typeof window === 'undefined') return 'auto';
  try {
    const value = localStorage.getItem(DATA_SAVER_STORAGE_KEY);
    return value === 'on' || value === 'off' ? value : 'auto';
  } catch {
    return 'auto';
  }
}

function networkIsSlow() {
  const c = connection();
  return !!c && (c.saveData === true || /2g/.test(c.effectiveType ?? ''));
}

export function isDataSaverOn() {
  if (typeof window === 'undefined') return false;
  const preference = getDataSaverPreference();
  return preference === 'on' || (preference === 'auto' && networkIsSlow());
}

function apply() {
  if (isDataSaverOn()) document.documentElement.dataset.saver = '';
  else delete document.documentElement.dataset.saver;
  listeners.forEach((l) => l());
}

export function setDataSaverPreference(preference: DataSaverPreference) {
  try {
    if (preference === 'auto') localStorage.removeItem(DATA_SAVER_STORAGE_KEY);
    else localStorage.setItem(DATA_SAVER_STORAGE_KEY, preference);
  } catch {
    /* stockage indisponible (navigation privée) : le réglage ne survivra pas au rechargement */
  }
  apply();
}

if (typeof window !== 'undefined') connection()?.addEventListener?.('change', apply);

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useDataSaver() {
  return useSyncExternalStore(subscribe, isDataSaverOn, () => false);
}

export function useDataSaverPreference() {
  return useSyncExternalStore(subscribe, getDataSaverPreference, () => 'auto' as const);
}

/** Intervalle d'actualisation : bien plus espacé en économie de données (le WebSocket prévient). */
export function poll(ms: number) {
  return isDataSaverOn() ? Math.max(ms * 4, 30_000) : ms;
}
