export const DEFAULT_TZ = 'Africa/Conakry';

function fmt(iso: string, options: Intl.DateTimeFormatOptions, timeZone = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone, ...options }).format(new Date(iso));
}

/** « jeu. 6 nov. » */
export function formatShortDate(iso: string, tz?: string): string {
  return fmt(iso, { weekday: 'short', day: 'numeric', month: 'short' }, tz);
}

/** « jeudi 6 novembre 2026 » */
export function formatLongDate(iso: string, tz?: string): string {
  return fmt(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }, tz);
}

/** « 10:00 » */
export function formatTime(iso: string, tz?: string): string {
  return fmt(iso, { hour: '2-digit', minute: '2-digit' }, tz);
}

/** « jeu. 6 nov. · 10:00 – 11:00 » */
export function formatRange(startIso: string, endIso: string, tz?: string): string {
  return `${formatShortDate(startIso, tz)} · ${formatTime(startIso, tz)} – ${formatTime(endIso, tz)}`;
}

/** « 6 nov. 2026 » */
export function formatDate(iso: string, tz?: string): string {
  return fmt(iso, { day: 'numeric', month: 'short', year: 'numeric' }, tz);
}

/** Clé de regroupement par jour (AAAA-MM-JJ) dans le fuseau donné. */
export function dayKey(iso: string, tz = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

export function durationMinutes(startIso: string, endIso: string): number {
  return Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000);
}

/** « il y a 5 min », « hier », etc. */
export function formatRelative(iso: string): string {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60) return 'à l’instant';
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), 'day');
  return formatDate(iso);
}

/**
 * Convertit une date (AAAA-MM-JJ) et une heure (HH:MM) saisies dans le fuseau `tz`
 * en instant ISO UTC. Fonctionne pour les fuseaux à décalage fixe comme pour les autres.
 */
export function zonedToIso(date: string, time: string, tz = DEFAULT_TZ): string {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(guess));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asTz = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  const offset = asTz - guess;
  return new Date(guess - offset).toISOString();
}

export function fullName(p: { firstName: string; lastName: string }): string {
  return `${p.firstName} ${p.lastName}`;
}

export function initials(p: { firstName: string; lastName: string }): string {
  return `${p.firstName.charAt(0)}${p.lastName.charAt(0)}`.toUpperCase();
}

export function plural(n: number, singular: string, pluralForm?: string): string {
  return `${n} ${n > 1 ? (pluralForm ?? `${singular}s`) : singular}`;
}
