/**
 * Classement de l'annuaire : règles publiques et explicables, comme le score de recommandation.
 *
 * « Pertinence » (par défaut), dans cet ordre :
 *  1. profil vérifié par l'équipe (justificatifs contrôlés) ;
 *  2. expérience démontrée sur la plateforme : mentor confirmé, puis mentor ayant déjà accompagné ;
 *  3. disponibilité : un créneau libre dans les 14 jours ;
 *  4. ampleur de l'expérience sur la plateforme (accompagnements, certificats, avis) ;
 *  5. années d'expérience déclarées, en départage.
 * Les années déclarées ne passent jamais devant ce qui est vérifié ou démontré.
 */
export type MentorSort = 'relevance' | 'experience' | 'availability' | 'rating';
export const MENTOR_SORTS: MentorSort[] = ['relevance', 'experience', 'availability', 'rating'];

/** « Mentor confirmé » : au moins 3 accompagnements terminés et une note moyenne d'au moins 4 sur 5. */
export const CONFIRMED_MIN_COMPLETED = 3;
export const CONFIRMED_MIN_RATING = 4;
/** Nombre d'avis minimum pour qu'une note compte (une seule note ne suffit pas). */
export const RATING_MIN_REVIEWS = 3;

export interface RankInput {
  id: string;
  verified: boolean;
  completedMentorships: number;
  mentoredCount: number;
  certificatesCount: number;
  ratingAverage: number | null;
  ratingCount: number;
  nextAvailableAt: Date | null;
  yearsExperience: number;
  createdAt: Date;
}

export function isConfirmedMentor(m: {
  completedMentorships: number;
  ratingAverage: number | null;
  ratingCount: number;
}): boolean {
  return (
    m.completedMentorships >= CONFIRMED_MIN_COMPLETED &&
    m.ratingCount >= RATING_MIN_REVIEWS &&
    (m.ratingAverage ?? 0) >= CONFIRMED_MIN_RATING
  );
}

/** Note prise en compte seulement à partir de 3 avis : sinon, 0. */
const reliableRating = (m: RankInput) =>
  m.ratingCount >= RATING_MIN_REVIEWS ? (m.ratingAverage ?? 0) : 0;

/** 2 : confirmé · 1 : a déjà accompagné · 0 : pas encore d'historique. */
const provenLevel = (m: RankInput) => (isConfirmedMentor(m) ? 2 : m.mentoredCount > 0 ? 1 : 0);

const provenWeight = (m: RankInput) =>
  m.completedMentorships * 3 + m.mentoredCount + m.certificatesCount * 2 + reliableRating(m);

type Key = (m: RankInput) => number;

function compareBy(keys: Key[]) {
  return (a: RankInput, b: RankInput) => {
    for (const key of keys) {
      const diff = key(b) - key(a);
      if (diff !== 0) return diff;
    }
    // Ordre stable : les plus anciens inscrits d'abord, puis l'identifiant.
    return a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);
  };
}

export function rankMentors<T extends RankInput>(
  mentors: T[],
  sort: MentorSort,
  now: Date,
  windowDays = 14,
): T[] {
  const horizon = now.getTime() + windowDays * 86_400_000;
  const availableSoon: Key = (m) =>
    m.nextAvailableAt && m.nextAvailableAt.getTime() <= horizon ? 1 : 0;
  /** Plus le créneau est proche, mieux c'est ; sans créneau, en dernier. */
  const soonest: Key = (m) => (m.nextAvailableAt ? -m.nextAvailableAt.getTime() : -Infinity);
  const verified: Key = (m) => (m.verified ? 1 : 0);

  const keys: Record<MentorSort, Key[]> = {
    relevance: [verified, provenLevel, availableSoon, provenWeight, (m) => m.yearsExperience],
    experience: [provenLevel, provenWeight, verified, (m) => m.yearsExperience],
    availability: [availableSoon, soonest, verified, provenLevel],
    rating: [reliableRating, (m) => m.ratingCount, verified, provenLevel],
  };
  return [...mentors].sort(compareBy(keys[sort]));
}
