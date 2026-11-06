import type { PlatformService } from './platform.module.js';

export type ImpactMetrics = Awaited<ReturnType<PlatformService['metrics']>>;

/** Cellule CSV : guillemets doublés, valeur entre guillemets si nécessaire. */
function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'number' ? String(value).replace('.', ',') : value;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function row(...values: (string | number | null | undefined)[]): string {
  return values.map(cell).join(';');
}

const dateFr = (d: Date | string) =>
  new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Africa/Conakry' }).format(
    new Date(d),
  );

/**
 * Rapport d'impact au format CSV (séparateur « ; » et BOM UTF-8 pour Excel en français).
 * Toutes les valeurs sont calculées sur la base au moment de l'export : aucune estimation.
 * Aucune donnée personnelle : uniquement des comptages agrégés.
 */
export function buildImpactCsv(m: ImpactMetrics): string {
  const roles = m.users.byRole;
  const lines: string[] = [
    row('Rapport d’impact — TalentsConnect'),
    row('Généré le', dateFr(m.generatedAt)),
    row('Source', 'Calculé sur la base de données de la plateforme, sans estimation'),
    '',
    row('Section', 'Indicateur', 'Valeur'),
    row('Communauté', 'Mentorés inscrits', roles.MENTEE ?? 0),
    row('Communauté', 'Mentors inscrits', roles.MENTOR ?? 0),
    row('Communauté', 'Nouveaux inscrits (7 derniers jours)', m.users.new7d),
    row('Communauté', 'Mentors publiés', m.mentors.published),
    row('Communauté', 'Mentors vérifiés', m.mentors.verified),
    row('Mise en relation', 'Demandes envoyées', sum(m.requests.byStatus)),
    row('Mise en relation', 'Demandes acceptées', m.requests.byStatus.ACCEPTED ?? 0),
    row('Mise en relation', 'Taux d’acceptation (%)', m.requests.acceptanceRate),
    row('Mise en relation', 'Délai médian de réponse (heures)', m.requests.medianResponseHours),
    row('Accompagnement', 'Mentorats en cours', m.mentorships.ACTIVE ?? 0),
    row('Accompagnement', 'Mentorats terminés', m.mentorships.COMPLETED ?? 0),
    row('Accompagnement', 'Séances réalisées', m.sessions.byStatus.COMPLETED ?? 0),
    row('Accompagnement', 'Heures de séances réalisées', m.sessions.completedHours),
    row('Accompagnement', 'Note moyenne des séances (sur 5)', m.feedback.average),
    row('Accompagnement', 'Évaluations reçues', m.feedback.count),
    row('Progression', 'Objectifs définis', m.goals.total),
    row('Progression', 'Objectifs atteints', m.goals.completed),
    row('Progression', 'Objectifs en cours', m.goals.inProgress),
    row('Ateliers', 'Ateliers réalisés', m.workshops.held),
    row('Ateliers', 'Ateliers à venir', m.workshops.upcoming),
    row('Ateliers', 'Heures d’ateliers réalisées', m.workshops.hours),
    row('Ateliers', 'Participations confirmées (ateliers réalisés)', m.workshops.participations),
    row('Échanges', 'Messages échangés', m.messages.total),
    row('Échanges', 'Appels audio aboutis', m.calls.audio),
    row('Échanges', 'Minutes d’appels audio', m.calls.audioMinutes),
    row('Échanges', 'Appels vidéo aboutis', m.calls.video),
    row('Échanges', 'Minutes d’appels vidéo', m.calls.videoMinutes),
    row('Reconnaissance', 'Certificats d’accompagnement valides', m.certificates.valid),
    row('Reconnaissance', 'Certificats révoqués', m.certificates.revoked),
    '',
    row('Domaine', 'Mentors', 'Mentorés intéressés', 'Demandes', 'Actif'),
    ...m.domains.map((d) =>
      row(d.name, d.mentors, d.menteeInterests, d.requests, d.isActive ? 'oui' : 'non'),
    ),
    '',
    row('Jour', 'Inscriptions', 'Demandes', 'Séances réalisées', 'Messages'),
    ...m.activity.signups.map((s, i) =>
      row(
        s.day,
        s.count,
        m.activity.requests[i]?.count ?? 0,
        m.activity.sessions[i]?.count ?? 0,
        m.activity.messages[i]?.count ?? 0,
      ),
    ),
  ];
  return `﻿${lines.join('\r\n')}\r\n`;
}

function sum(record: Record<string, number>): number {
  return Object.values(record).reduce((a, b) => a + b, 0);
}
