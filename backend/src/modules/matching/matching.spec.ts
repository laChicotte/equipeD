import { computeMatch, type MatchMentee, type MatchMentor } from './matching.js';

const mentee: MatchMentee = {
  interestDomainIds: ['tech'],
  desiredSkills: ['React', 'développement web'],
  preferredModality: 'REMOTE',
};

const mentor: MatchMentor = {
  domains: [{ id: 'tech', name: 'Numérique et technologies' }],
  expertise: ['React', 'Developpement web', 'Node.js'],
  modalities: ['REMOTE'],
  hasUpcomingAvailability: true,
  isVerified: true,
};

describe('computeMatch', () => {
  it('attribue un score élevé et explique chaque critère pour un mentor pertinent', () => {
    const result = computeMatch(mentee, mentor);
    expect(result.score).toBe(35 + 20 + 10 + 10 + 5);
    expect(result.reasons).toHaveLength(5);
    expect(result.reasons[1]).toContain('React');
  });

  it('compare les compétences sans tenir compte des accents ni de la casse', () => {
    const result = computeMatch(mentee, mentor);
    expect(result.reasons.join(' ')).toContain('développement web');
  });

  it('retourne un score nul sans aucun critère commun', () => {
    const result = computeMatch(mentee, {
      ...mentor,
      domains: [{ id: 'finance', name: 'Finance' }],
      expertise: ['Comptabilité'],
      modalities: ['IN_PERSON'],
      hasUpcomingAvailability: false,
      isVerified: false,
    });
    expect(result).toEqual({ score: 0, reasons: [] });
  });

  it('considère le format hybride comme compatible', () => {
    const result = computeMatch(
      { ...mentee, preferredModality: 'IN_PERSON' },
      { ...mentor, modalities: ['HYBRID'] },
    );
    expect(result.reasons.some((r) => r.includes('présentiel'))).toBe(true);
  });
});
