import {
  parseAssistant,
  parseExplanation,
  parseOrientation,
  parsePathProposal,
  scrubPersonalData,
} from './ai.logic.js';

const catalog = [
  { id: 'd1', slug: 'numerique-technologies', name: 'Numérique et technologies' },
  { id: 'd2', slug: 'campus-france', name: 'Campus France' },
];

describe('assistance par IA : données envoyées et réponses reçues', () => {
  it('retire les emails, liens et numéros d’un texte libre', () => {
    const out = scrubPersonalData(
      'Écrivez à aminata.diallo@mail.gn ou au +224 622 12 34 56, voir https://exemple.gn/cv. J’ai 3 ans.',
    );
    expect(out).not.toMatch(/aminata|622|exemple\.gn/);
    expect(out).toContain('[email retiré]');
    expect(out).toContain('[numéro retiré]');
    expect(out).toContain('[lien retiré]');
    expect(out).toContain('J’ai 3 ans');
  });

  it('écarte un domaine inventé par le modèle et les doublons', () => {
    const result = parseOrientation(
      {
        summary: 'Vous cherchez un premier emploi dans le web.',
        domains: [
          { slug: 'numerique-technologies', reason: 'Développement web' },
          { slug: 'numerique-technologies', reason: 'Doublon' },
          { slug: 'domaine-invente', reason: 'N’existe pas' },
        ],
        skills: ['React', 'React', 'x', 42],
      },
      catalog,
    );
    expect(result).toEqual({
      summary: 'Vous cherchez un premier emploi dans le web.',
      domains: [
        {
          id: 'd1',
          slug: 'numerique-technologies',
          name: 'Numérique et technologies',
          reason: 'Développement web',
        },
      ],
      skills: ['React'],
    });
  });

  it('refuse une réponse inexploitable', () => {
    expect(
      parseOrientation({ summary: 'ok', domains: [{ slug: 'inconnu', reason: 'x' }] }, catalog),
    ).toBeNull();
    expect(parseOrientation('pas un objet', catalog)).toBeNull();
    expect(parseExplanation({ explanation: 42 })).toBeNull();
    expect(parsePathProposal({ goals: [{ title: 'Sans jalons', milestones: [] }] })).toBeNull();
  });

  it('borne la proposition de parcours et ignore un objectif déjà présent', () => {
    const result = parsePathProposal(
      {
        goals: [
          { title: 'Mon CV', description: 'Déjà là', milestones: ['Relire'] },
          {
            title: 'Portfolio',
            description: 'd'.repeat(900),
            milestones: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'],
          },
        ],
      },
      ['mon cv'],
    );
    expect(result?.goals).toHaveLength(1);
    expect(result?.goals[0].title).toBe('Portfolio');
    expect(result?.goals[0].description).toHaveLength(600);
    expect(result?.goals[0].milestones).toHaveLength(6);
  });
});

describe('assistant : lecture de la réponse', () => {
  const allowed = [
    { href: '/mentors', label: 'Trouver un mentor' },
    { href: '/seances', label: 'Séances' },
  ];

  it('garde les liens autorisés pour ce rôle et retire la mise en forme', () => {
    const result = parseAssistant(
      {
        answer: '**Allez** sur la page.\n\n\n\n# Ensuite\nRéservez.',
        links: ['/seances', '/admin', 'https://exemple.test', '/seances', '/mentors'],
      },
      allowed,
    );
    expect(result).toEqual({
      answer: 'Allez sur la page.\n\nEnsuite\nRéservez.',
      links: [
        { href: '/seances', label: 'Séances' },
        { href: '/mentors', label: 'Trouver un mentor' },
      ],
    });
  });

  it('refuse une réponse vide ou mal formée', () => {
    expect(parseAssistant({ answer: '   ', links: [] }, allowed)).toBeNull();
    expect(parseAssistant({ links: [] }, allowed)).toBeNull();
    expect(parseAssistant(null, allowed)).toBeNull();
  });
});
