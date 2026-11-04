import { normalizeSearch } from '../../common/text.js';
import type { Modality } from '../../generated/prisma/enums.js';

/**
 * Score de correspondance déterministe et explicable (pas d'IA) :
 *  - domaines communs        : 35 pts par domaine (max 50)
 *  - compétences recherchées : 10 pts par compétence couverte (max 25)
 *  - modalité compatible     : 10 pts
 *  - disponibilité prochaine : 10 pts
 *  - mentor vérifié          : 5 pts
 * Chaque point attribué produit une raison lisible par le mentoré.
 */
export interface MatchMentee {
  interestDomainIds: string[];
  desiredSkills: string[];
  preferredModality: Modality;
}

export interface MatchMentor {
  domains: { id: string; name: string }[];
  expertise: string[];
  modalities: Modality[];
  hasUpcomingAvailability: boolean;
  isVerified: boolean;
  hasCapacity: boolean;
}

export interface MatchResult {
  score: number;
  reasons: string[];
}

const MODALITY_LABELS: Record<Modality, string> = {
  REMOTE: 'à distance',
  IN_PERSON: 'en présentiel',
  HYBRID: 'en format hybride',
};

function modalityCompatible(preferred: Modality, offered: Modality[]): boolean {
  if (offered.includes(preferred)) return true;
  if (preferred === 'HYBRID') return offered.length > 0;
  return offered.includes('HYBRID');
}

export function computeMatch(mentee: MatchMentee, mentor: MatchMentor): MatchResult {
  const reasons: string[] = [];
  let score = 0;

  const sharedDomains = mentor.domains.filter((d) => mentee.interestDomainIds.includes(d.id));
  if (sharedDomains.length > 0) {
    score += Math.min(50, sharedDomains.length * 35);
    reasons.push(`Domaine correspondant : ${sharedDomains.map((d) => d.name).join(', ')}`);
  }

  const expertise = mentor.expertise.map(normalizeSearch);
  const covered = mentee.desiredSkills.filter((skill) => {
    const s = normalizeSearch(skill);
    return s.length > 1 && expertise.some((e) => e.includes(s) || s.includes(e));
  });
  if (covered.length > 0) {
    score += Math.min(25, covered.length * 10);
    reasons.push(`Compétences recherchées couvertes : ${covered.join(', ')}`);
  }

  if (modalityCompatible(mentee.preferredModality, mentor.modalities)) {
    score += 10;
    reasons.push(`Accompagnement possible ${MODALITY_LABELS[mentee.preferredModality]}`);
  }

  if (mentor.hasUpcomingAvailability) {
    score += 10;
    reasons.push('Créneaux disponibles dans les 14 prochains jours');
  }

  if (mentor.isVerified) {
    score += 5;
    reasons.push('Profil vérifié par l’équipe');
  }

  if (!mentor.hasCapacity) {
    score = Math.round(score * 0.5);
    reasons.push('Capacité d’accompagnement actuellement atteinte');
  }

  return { score: Math.min(100, score), reasons };
}
