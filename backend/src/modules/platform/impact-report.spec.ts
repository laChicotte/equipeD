import { buildImpactCsv, type ImpactMetrics } from './impact-report.js';

const days = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ day: `2026-11-0${i + 1}`, count: i }));

const metrics = {
  generatedAt: new Date('2026-11-05T10:00:00Z'),
  users: { byRole: { MENTEE: 12, MENTOR: 5 }, byStatus: {}, new7d: 3 },
  mentors: { total: 5, published: 4, verified: 3, toReview: 1 },
  requests: {
    byStatus: { PENDING: 2, ACCEPTED: 6, DECLINED: 1 },
    acceptanceRate: 86,
    medianResponseHours: 4.5,
  },
  mentorships: { ACTIVE: 4, COMPLETED: 2 },
  sessions: { byStatus: { COMPLETED: 7 }, completedHours: 6.5 },
  feedback: { average: 4.6, count: 5 },
  certificates: { valid: 2, revoked: 0 },
  messages: { total: 140, last7d: 60 },
  goals: { total: 9, completed: 3, inProgress: 4 },
  workshops: { held: 1, upcoming: 2, hours: 1.5, participations: 6 },
  calls: { audio: 4, video: 1, audioMinutes: 52, videoMinutes: 12 },
  domains: [
    {
      id: 'd1',
      name: 'Gestion; finance "et" admin',
      isActive: true,
      mentors: 1,
      menteeInterests: 2,
      requests: 3,
    },
  ],
  activity: {
    from: new Date('2026-11-01T00:00:00Z'),
    signups: days(3),
    requests: days(3),
    sessions: days(3),
    messages: days(3),
  },
} as unknown as ImpactMetrics;

describe('buildImpactCsv', () => {
  const csv = buildImpactCsv(metrics);
  const lines = csv.slice(1).split('\r\n');

  it('commence par un BOM UTF-8 et utilise le point-virgule (Excel en français)', () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(lines).toContain('Section;Indicateur;Valeur');
  });

  it('écrit les décimales avec une virgule et totalise les demandes', () => {
    expect(lines).toContain('Accompagnement;Heures de séances réalisées;6,5');
    expect(lines).toContain('Mise en relation;Demandes envoyées;9');
    expect(lines).toContain('Ateliers;Participations confirmées (ateliers réalisés);6');
  });

  it('échappe les séparateurs et les guillemets', () => {
    expect(lines).toContain('"Gestion; finance ""et"" admin";1;2;3;oui');
  });

  it('laisse vide un indicateur non calculable', () => {
    const empty = buildImpactCsv({
      ...metrics,
      feedback: { average: null, count: 0 },
    } as ImpactMetrics);
    expect(empty).toContain('Accompagnement;Note moyenne des séances (sur 5);\r\n');
  });
});
