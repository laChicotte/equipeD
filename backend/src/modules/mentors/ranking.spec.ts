import { isConfirmedMentor, rankMentors, type RankInput } from './ranking.js';

const now = new Date('2026-11-06T10:00:00Z');
const inDays = (d: number) => new Date(now.getTime() + d * 86_400_000);

function mentor(id: string, patch: Partial<RankInput> = {}): RankInput {
  return {
    id,
    verified: false,
    completedMentorships: 0,
    mentoredCount: 0,
    certificatesCount: 0,
    ratingAverage: null,
    ratingCount: 0,
    nextAvailableAt: null,
    yearsExperience: 5,
    createdAt: new Date('2026-11-01T00:00:00Z'),
    ...patch,
  };
}

const ids = (list: RankInput[]) => list.map((m) => m.id);

describe('classement de l’annuaire', () => {
  it('confirme un mentor seulement avec 3 accompagnements terminés et une note de 4 sur 3 avis', () => {
    expect(isConfirmedMentor({ completedMentorships: 3, ratingAverage: 4.2, ratingCount: 3 })).toBe(
      true,
    );
    expect(isConfirmedMentor({ completedMentorships: 2, ratingAverage: 5, ratingCount: 5 })).toBe(
      false,
    );
    expect(isConfirmedMentor({ completedMentorships: 5, ratingAverage: 3.9, ratingCount: 9 })).toBe(
      false,
    );
    expect(isConfirmedMentor({ completedMentorships: 5, ratingAverage: 5, ratingCount: 1 })).toBe(
      false,
    );
  });

  it('pertinence : vérifié, puis expérience démontrée, puis disponibilité, puis années', () => {
    const list = [
      mentor('declare-30-ans', { yearsExperience: 30, nextAvailableAt: inDays(1) }),
      mentor('verifie-sans-historique', { verified: true }),
      mentor('verifie-disponible', { verified: true, nextAvailableAt: inDays(2) }),
      mentor('verifie-confirme', {
        verified: true,
        completedMentorships: 4,
        mentoredCount: 4,
        ratingAverage: 4.5,
        ratingCount: 4,
      }),
      mentor('verifie-a-accompagne', { verified: true, mentoredCount: 1 }),
    ];
    expect(ids(rankMentors(list, 'relevance', now))).toEqual([
      'verifie-confirme',
      'verifie-a-accompagne',
      'verifie-disponible',
      'verifie-sans-historique',
      'declare-30-ans',
    ]);
  });

  it('les années déclarées ne servent qu’à départager', () => {
    const list = [
      mentor('junior', { yearsExperience: 2, verified: true, nextAvailableAt: inDays(1) }),
      mentor('senior', { yearsExperience: 20, verified: true, nextAvailableAt: inDays(1) }),
    ];
    expect(ids(rankMentors(list, 'relevance', now))).toEqual(['senior', 'junior']);
  });

  it('disponibilité : le créneau le plus proche d’abord, sans créneau en dernier', () => {
    const list = [
      mentor('aucun-creneau', { verified: true }),
      mentor('dans-5-jours', { nextAvailableAt: inDays(5) }),
      mentor('demain', { nextAvailableAt: inDays(1) }),
      mentor('dans-30-jours', { nextAvailableAt: inDays(30) }),
    ];
    expect(ids(rankMentors(list, 'availability', now))).toEqual([
      'demain',
      'dans-5-jours',
      'dans-30-jours',
      'aucun-creneau',
    ]);
  });

  it('note : une seule excellente note ne passe pas devant une note fiable', () => {
    const list = [
      mentor('un-seul-avis', { ratingAverage: 5, ratingCount: 1 }),
      mentor('fiable', { ratingAverage: 4.4, ratingCount: 6 }),
    ];
    expect(ids(rankMentors(list, 'rating', now))).toEqual(['fiable', 'un-seul-avis']);
  });
});
