/**
 * Seed idempotente — Talents Connectés.
 *
 * - Domaines : issus de la section 5 des TDR (toujours chargés).
 * - Comptes et profils : FICTIFS, réservés au développement et à la démonstration.
 *   Aucun nom, email ou parcours ne correspond à une personne réelle.
 *   Refusés en production sauf SEED_DEMO=true explicite.
 *
 * Relançable à volonté : upserts sur clés naturelles, créneaux créés seulement s'ils
 * ne chevauchent pas l'existant (contrainte d'exclusion PostgreSQL).
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import type {
  MenteeSituation,
  Modality,
  VerificationStatus,
} from '../src/generated/prisma/enums.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { normalizeSearch } from '../src/common/text.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

export const DEMO_PASSWORD = 'Mentorat2026!';
const DEMO_DOMAIN = 'demo.talents-connectes.test';

// ─── Domaines (TDR §5) ───────────────────────────────────────────────────────

const DOMAINS = [
  {
    slug: 'entrepreneuriat',
    name: 'Entrepreneuriat et gestion d’entreprise',
    icon: 'rocket',
    description: 'Créer, structurer et développer une entreprise ou un projet entrepreneurial.',
    topics: [
      'Création d’entreprise',
      'Structuration de projet',
      'Gestion administrative et financière',
      'Recherche de financements',
      'Développement commercial',
    ],
  },
  {
    slug: 'numerique-technologies',
    name: 'Numérique et technologies',
    icon: 'code',
    description:
      'Développement informatique, IA, cybersécurité, marketing digital et design numérique.',
    topics: [
      'Développement web',
      'Développement informatique',
      'Intelligence artificielle',
      'Cybersécurité',
      'Marketing digital',
      'Design et création numérique',
    ],
  },
  {
    slug: 'orientation-insertion',
    name: 'Orientation et insertion professionnelle',
    icon: 'compass',
    description: 'Construire son parcours, réussir ses candidatures et développer son réseau.',
    topics: [
      'Parcours professionnel',
      'Entretiens d’embauche',
      'CV et lettre de motivation',
      'Recherche d’emploi',
      'Réseau professionnel',
      'Vie en entreprise',
    ],
  },
  {
    slug: 'culture-industries-creatives',
    name: 'Culture, littérature et industries créatives',
    icon: 'book-open',
    description: 'Écriture, édition, métiers du livre, création de contenu et audiovisuel.',
    topics: [
      'Écriture et édition',
      'Métiers du livre',
      'Création de contenu',
      'Production audiovisuelle',
      'Entrepreneuriat culturel',
    ],
  },
  {
    slug: 'gestion-finance-administration',
    name: 'Gestion, finance et administration',
    icon: 'landmark',
    description: 'Comptabilité, gestion de projets, management, RH et analyse financière.',
    topics: [
      'Comptabilité et gestion',
      'Gestion de projets',
      'Management et RH',
      'Finance et analyse économique',
    ],
  },
  {
    slug: 'developpement-personnel-leadership',
    name: 'Développement personnel et leadership',
    icon: 'sparkles',
    description: 'Prise de parole, confiance en soi, leadership, organisation et relations.',
    topics: [
      'Prise de parole en public',
      'Confiance en soi',
      'Leadership et gestion d’équipe',
      'Gestion du temps',
      'Capacités relationnelles',
    ],
  },
  {
    slug: 'campus-france',
    name: 'Accompagnement des candidats Campus France',
    icon: 'graduation-cap',
    description:
      'Conseil et orientation pour préparer un projet d’études en France. Cet accompagnement ne garantit ni l’admission ni l’obtention d’un visa.',
    topics: [
      'Choix des formations',
      'Projet d’études',
      'Dossier de candidature',
      'Entretien Campus France',
      'Démarches de mobilité',
      'Retours d’anciens étudiants',
    ],
  },
] as const;

type DomainSlug = (typeof DOMAINS)[number]['slug'];

// ─── Comptes fictifs ─────────────────────────────────────────────────────────

interface DemoMentor {
  key: string;
  firstName: string;
  lastName: string;
  headline: string;
  bio: string;
  currentPosition: string;
  organization: string;
  yearsExperience: number;
  expertise: string[];
  languages: string[];
  modalities: Modality[];
  city: string;
  domains: DomainSlug[];
  verificationStatus: VerificationStatus;
  maxMentees: number;
}

const MENTORS: DemoMentor[] = [
  {
    key: 'fatoumata',
    firstName: 'Fatoumata',
    lastName: 'Camara',
    headline: 'Ingénieure logicielle full-stack — développement web et produits numériques',
    bio: 'Profil fictif de démonstration. Dix ans de développement d’applications web pour des entreprises et des startups. J’accompagne les jeunes développeurs sur les fondamentaux (JavaScript, TypeScript, React, API), la construction d’un portfolio crédible et la préparation aux entretiens techniques. Approche concrète : un objectif par séance, du code relu ensemble.',
    currentPosition: 'Lead développeuse',
    organization: 'Studio numérique (fictif)',
    yearsExperience: 10,
    expertise: [
      'Développement web',
      'React',
      'TypeScript',
      'Node.js',
      'Portfolio',
      'Entretien technique',
    ],
    languages: ['Français', 'Anglais', 'Soussou'],
    modalities: ['REMOTE', 'HYBRID'],
    city: 'Conakry',
    domains: ['numerique-technologies', 'orientation-insertion'],
    verificationStatus: 'VERIFIED',
    maxMentees: 5,
  },
  {
    key: 'thierno',
    firstName: 'Thierno',
    lastName: 'Baldé',
    headline: 'Entrepreneur et conseiller en financement de PME',
    bio: 'Profil fictif de démonstration. Fondateur de deux entreprises de services et conseiller auprès de porteurs de projets. J’aide à transformer une idée en modèle économique viable : étude de marché, business plan, prévisionnel financier et préparation des rencontres avec les financeurs.',
    currentPosition: 'Directeur général',
    organization: 'Cabinet de conseil (fictif)',
    yearsExperience: 15,
    expertise: [
      'Business plan',
      'Levée de fonds',
      'Modèle économique',
      'Prévisionnel financier',
      'Développement commercial',
    ],
    languages: ['Français', 'Pular'],
    modalities: ['IN_PERSON', 'REMOTE'],
    city: 'Conakry',
    domains: ['entrepreneuriat', 'gestion-finance-administration'],
    verificationStatus: 'VERIFIED',
    maxMentees: 4,
  },
  {
    key: 'mariama',
    firstName: 'Mariama',
    lastName: 'Bangoura',
    headline: 'Conseillère d’orientation — projets d’études en France et insertion',
    bio: 'Profil fictif de démonstration. Ancienne étudiante en France, j’accompagne la construction d’un projet d’études cohérent : choix des formations, lettre de motivation, préparation de l’entretien Campus France. Il s’agit de conseil et de partage d’expérience : aucune admission ni aucun visa ne peut être garanti.',
    currentPosition: 'Conseillère en orientation',
    organization: 'Association d’orientation (fictive)',
    yearsExperience: 8,
    expertise: ['Campus France', 'Lettre de motivation', 'CV', 'Entretien', 'Orientation'],
    languages: ['Français', 'Anglais'],
    modalities: ['REMOTE'],
    city: 'Conakry',
    domains: ['campus-france', 'orientation-insertion'],
    verificationStatus: 'VERIFIED',
    maxMentees: 6,
  },
  {
    key: 'sekou',
    firstName: 'Sékou',
    lastName: 'Kourouma',
    headline: 'Expert cybersécurité et données — sécurité des applications',
    bio: 'Profil fictif de démonstration. Spécialiste de la sécurité des systèmes d’information, j’aide les étudiants et jeunes professionnels à découvrir les métiers de la cybersécurité et de la donnée, à choisir leurs certifications et à monter des projets pratiques pour se former.',
    currentPosition: 'Responsable sécurité',
    organization: 'Opérateur télécom (fictif)',
    yearsExperience: 12,
    expertise: [
      'Cybersécurité',
      'Sécurité des applications',
      'Intelligence artificielle',
      'Données',
      'Certifications',
    ],
    languages: ['Français', 'Anglais', 'Malinké'],
    modalities: ['REMOTE', 'HYBRID'],
    city: 'Kankan',
    domains: ['numerique-technologies'],
    verificationStatus: 'PENDING',
    maxMentees: 3,
  },
  {
    key: 'aissatou',
    firstName: 'Aïssatou',
    lastName: 'Barry',
    headline: 'Éditrice et autrice — métiers du livre et création de contenu',
    bio: 'Profil fictif de démonstration. Éditrice depuis plus de dix ans, j’accompagne les jeunes auteurs et créateurs de contenu : structurer un manuscrit, comprendre la chaîne du livre, construire une présence éditoriale en ligne et monter un projet culturel.',
    currentPosition: 'Directrice éditoriale',
    organization: 'Maison d’édition (fictive)',
    yearsExperience: 11,
    expertise: ['Écriture', 'Édition', 'Création de contenu', 'Entrepreneuriat culturel'],
    languages: ['Français', 'Pular'],
    modalities: ['IN_PERSON', 'HYBRID'],
    city: 'Conakry',
    domains: ['culture-industries-creatives', 'developpement-personnel-leadership'],
    verificationStatus: 'VERIFIED',
    maxMentees: 4,
  },
  {
    key: 'lansana',
    firstName: 'Lansana',
    lastName: 'Fofana',
    headline: 'Manager et formateur en leadership et prise de parole',
    bio: 'Profil fictif de démonstration. Manager d’équipes pendant quinze ans puis formateur, j’aide à gagner en confiance, à prendre la parole en public, à mieux s’organiser et à piloter ses premiers projets d’équipe.',
    currentPosition: 'Formateur indépendant',
    organization: 'Indépendant',
    yearsExperience: 18,
    expertise: [
      'Prise de parole',
      'Leadership',
      'Gestion du temps',
      'Gestion de projets',
      'Management',
    ],
    languages: ['Français', 'Anglais'],
    modalities: ['REMOTE', 'IN_PERSON'],
    city: 'Conakry',
    domains: ['developpement-personnel-leadership', 'gestion-finance-administration'],
    verificationStatus: 'UNVERIFIED',
    maxMentees: 5,
  },
];

interface DemoMentee {
  key: string;
  firstName: string;
  lastName: string;
  situation: MenteeSituation;
  goalsSummary: string;
  desiredSkills: string[];
  preferredModality: Modality;
  city: string;
  interests: DomainSlug[];
}

const MENTEES: DemoMentee[] = [
  {
    key: 'aminata',
    firstName: 'Aminata',
    lastName: 'Diallo',
    situation: 'GRADUATE',
    goalsSummary:
      'Jeune diplômée en informatique, je souhaite devenir développeuse web et décrocher un premier emploi ou un stage dans les six prochains mois.',
    desiredSkills: ['Développement web', 'React', 'Portfolio'],
    preferredModality: 'REMOTE',
    city: 'Conakry',
    interests: ['numerique-technologies', 'orientation-insertion'],
  },
  {
    key: 'mohamed',
    firstName: 'Mohamed',
    lastName: 'Soumah',
    situation: 'PROJECT_HOLDER',
    goalsSummary:
      'Porteur d’un projet de livraison de produits frais à Conakry, je veux structurer mon business plan et préparer une demande de financement.',
    desiredSkills: ['Business plan', 'Levée de fonds'],
    preferredModality: 'IN_PERSON',
    city: 'Conakry',
    interests: ['entrepreneuriat', 'gestion-finance-administration'],
  },
];

const email = (key: string) => `${key}@${DEMO_DOMAIN}`;

// ─── Exécution ───────────────────────────────────────────────────────────────

async function seedDomains() {
  const ids = new Map<DomainSlug, string>();
  for (const [index, d] of DOMAINS.entries()) {
    const row = await prisma.expertiseDomain.upsert({
      where: { slug: d.slug },
      create: { ...d, topics: [...d.topics], sortOrder: index },
      update: {
        name: d.name,
        icon: d.icon,
        description: d.description,
        topics: [...d.topics],
        sortOrder: index,
      },
      select: { id: true },
    });
    ids.set(d.slug, row.id);
  }
  return ids;
}

async function upsertUser(
  key: string,
  firstName: string,
  lastName: string,
  role: 'MENTOR' | 'MENTEE' | 'ADMIN',
  passwordHash: string,
) {
  return prisma.user.upsert({
    where: { email: email(key) },
    create: { email: email(key), passwordHash, firstName, lastName, role, onboardedAt: new Date() },
    update: { firstName, lastName, role, status: 'ACTIVE' },
    select: { id: true },
  });
}

/** Créneaux d'une heure sur les 14 prochains jours ouvrés (heure de Conakry = UTC). */
function plannedSlots(seedIndex: number): { startsAt: Date; endsAt: Date }[] {
  const hours = [
    [10, 0],
    [15, 0],
    [17, 30],
  ] as const;
  const slots: { startsAt: Date; endsAt: Date }[] = [];
  const today = new Date();
  for (let day = 1; day <= 14; day++) {
    const date = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + day),
    );
    const weekday = date.getUTCDay();
    if (weekday === 0) continue; // pas le dimanche
    if ((day + seedIndex) % 2 !== 0 && weekday !== 6) continue; // un jour sur deux, varié selon le mentor
    for (const [index, [h, m]] of hours.entries()) {
      if ((index + seedIndex) % 3 === 2) continue;
      const startsAt = new Date(date);
      startsAt.setUTCHours(h, m, 0, 0);
      slots.push({ startsAt, endsAt: new Date(startsAt.getTime() + 60 * 60_000) });
    }
  }
  return slots;
}

async function seedSlots(mentorId: string, seedIndex: number) {
  let created = 0;
  for (const slot of plannedSlots(seedIndex)) {
    const exists = await prisma.availabilitySlot.findFirst({
      where: {
        mentorId,
        isActive: true,
        startsAt: { lt: slot.endsAt },
        endsAt: { gt: slot.startsAt },
      },
      select: { id: true },
    });
    if (exists) continue;
    await prisma.availabilitySlot.create({
      data: { mentorId, ...slot, timezone: 'Africa/Conakry' },
    });
    created++;
  }
  return created;
}

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.SEED_DEMO !== 'true') {
    console.log('Production : chargement des domaines uniquement (comptes de démo désactivés).');
    await seedDomains();
    return;
  }

  const domainIds = await seedDomains();
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  // Option : remettre à zéro le parcours principal de démo (Aminata), et les comptes de test e2e,
  // sans toucher au reste des données. Usage : pnpm db:demo-reset
  if (process.env.SEED_RESET_SCENARIO === 'true') {
    const scenarioUsers = await prisma.user.findMany({
      where: { OR: [{ email: email('aminata') }, { email: { endsWith: '@example.test' } }] },
      select: { id: true },
    });
    const ids = scenarioUsers.map((u) => u.id);
    await prisma.mentorship.deleteMany({ where: { menteeId: { in: ids } } }); // cascade : séances, messages, objectifs
    await prisma.mentorshipRequest.deleteMany({ where: { menteeId: { in: ids } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: '@example.test' } } });
    // Les notifications des comptes de démo ne décrivent que des événements de répétition : on repart à zéro.
    await prisma.notification.deleteMany({
      where: { user: { email: { endsWith: `@${DEMO_DOMAIN}` } } },
    });
    console.log('Scénario de démo réinitialisé.');
  }

  const mentorIds = new Map<string, string>();
  let slotCount = 0;
  for (const [index, m] of MENTORS.entries()) {
    const user = await upsertUser(m.key, m.firstName, m.lastName, 'MENTOR', passwordHash);
    mentorIds.set(m.key, user.id);
    const domains = m.domains.map((slug) => domainIds.get(slug)!);
    const domainMeta = DOMAINS.filter((d) => m.domains.includes(d.slug));
    const searchText = normalizeSearch(
      [
        m.firstName,
        m.lastName,
        m.headline,
        m.currentPosition,
        m.organization,
        m.city,
        ...m.expertise,
        ...domainMeta.flatMap((d) => [d.name, ...d.topics]),
      ].join(' '),
    );
    const data = {
      headline: m.headline,
      bio: m.bio,
      currentPosition: m.currentPosition,
      organization: m.organization,
      yearsExperience: m.yearsExperience,
      expertise: m.expertise,
      languages: m.languages,
      modalities: m.modalities,
      city: m.city,
      verificationStatus: m.verificationStatus,
      maxMentees: m.maxMentees,
      sessionDurationMin: 60,
      searchText,
    };
    const profile = await prisma.mentorProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...data },
      update: data,
      select: { id: true },
    });
    await prisma.mentorDomain.deleteMany({ where: { mentorProfileId: profile.id } });
    await prisma.mentorDomain.createMany({
      data: domains.map((domainId) => ({ mentorProfileId: profile.id, domainId })),
    });
    slotCount += await seedSlots(user.id, index);
  }

  const menteeIds = new Map<string, string>();
  for (const m of MENTEES) {
    const user = await upsertUser(m.key, m.firstName, m.lastName, 'MENTEE', passwordHash);
    menteeIds.set(m.key, user.id);
    const data = {
      situation: m.situation,
      goalsSummary: m.goalsSummary,
      desiredSkills: m.desiredSkills,
      preferredModality: m.preferredModality,
      city: m.city,
    };
    const profile = await prisma.menteeProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...data },
      update: data,
      select: { id: true },
    });
    await prisma.menteeInterest.deleteMany({ where: { menteeProfileId: profile.id } });
    await prisma.menteeInterest.createMany({
      data: m.interests.map((slug) => ({
        menteeProfileId: profile.id,
        domainId: domainIds.get(slug)!,
      })),
    });
  }

  await upsertUser('admin', 'Équipe', 'Modération', 'ADMIN', passwordHash);

  // Un mentorat déjà actif (Mohamed ↔ Thierno) pour que les tableaux de bord ne soient pas vides.
  // Le parcours principal de démo (Aminata → Fatoumata) reste volontairement vierge.
  const mohamedId = menteeIds.get('mohamed')!;
  const thiernoId = mentorIds.get('thierno')!;
  const requestId = 'seed_request_mohamed_thierno';
  await prisma.mentorshipRequest.upsert({
    where: { id: requestId },
    create: {
      id: requestId,
      menteeId: mohamedId,
      mentorId: thiernoId,
      domainId: domainIds.get('entrepreneuriat')!,
      goal: 'Structurer mon business plan et préparer une demande de financement',
      message:
        'Bonjour, je porte un projet de livraison de produits frais à Conakry. J’aimerais être accompagné pour structurer mon business plan et préparer un dossier de financement solide.',
      status: 'ACCEPTED',
      respondedAt: new Date(),
    },
    update: {},
  });
  const mentorship = await prisma.mentorship.upsert({
    where: { requestId },
    create: { requestId, mentorId: thiernoId, menteeId: mohamedId },
    update: {},
    select: { id: true },
  });
  const goalCount = await prisma.goal.count({ where: { mentorshipId: mentorship.id } });
  if (goalCount === 0) {
    await prisma.goal.create({
      data: {
        mentorshipId: mentorship.id,
        createdById: mohamedId,
        title: 'Finaliser le business plan',
        description: 'Un document complet et chiffré, prêt à être présenté à un financeur.',
        status: 'IN_PROGRESS',
        progress: 33,
        milestones: {
          create: [
            {
              title: 'Étude de marché synthétique',
              isDone: true,
              doneAt: new Date(),
              sortOrder: 0,
            },
            { title: 'Modèle économique et prix', isDone: false, sortOrder: 1 },
            { title: 'Prévisionnel financier sur 3 ans', isDone: false, sortOrder: 2 },
          ],
        },
      },
    });
  }
  // Bibliothèque publique : quelques ressources publiées par les mentors fictifs.
  // Les seuls liens externes pointent vers des sites officiels de référence.
  const libraryResources = [
    {
      id: 'seed_resource_portfolio',
      author: 'fatoumata',
      domain: 'numerique-technologies',
      kind: 'ADVICE' as const,
      title: 'Construire un portfolio de développeur crédible',
      description:
        'Trois projets aboutis valent mieux que dix ébauches. Pour chacun : le problème résolu, votre rôle, les choix techniques, un lien de démonstration et le code source. Soignez le fichier README.',
      url: null,
    },
    {
      id: 'seed_resource_mdn',
      author: 'fatoumata',
      domain: 'numerique-technologies',
      kind: 'ARTICLE' as const,
      title: 'MDN Web Docs — apprendre le développement web',
      description: 'Documentation de référence (en français) sur HTML, CSS et JavaScript.',
      url: 'https://developer.mozilla.org/fr/docs/Learn',
    },
    {
      id: 'seed_resource_campus_france',
      author: 'mariama',
      domain: 'campus-france',
      kind: 'ARTICLE' as const,
      title: 'Site officiel Campus France',
      description:
        'Source officielle sur les procédures. Rappel : l’accompagnement proposé ici relève du conseil et ne garantit ni admission ni visa.',
      url: 'https://www.campusfrance.org/fr',
    },
    {
      id: 'seed_resource_pitch',
      author: 'thierno',
      domain: 'entrepreneuriat',
      kind: 'TEMPLATE' as const,
      title: 'Trame de pitch en 7 points',
      description:
        '1. Problème · 2. Clients cibles · 3. Solution · 4. Modèle économique · 5. Concurrence · 6. Équipe · 7. Besoin (financement, partenaires). Une idée par diapositive, des chiffres sourcés uniquement.',
      url: null,
    },
  ];
  for (const r of libraryResources) {
    const data = {
      authorId: mentorIds.get(r.author)!,
      domainId: domainIds.get(r.domain as DomainSlug)!,
      kind: r.kind,
      title: r.title,
      description: r.description,
      url: r.url,
    };
    await prisma.resource.upsert({
      where: { id: r.id },
      create: { id: r.id, ...data },
      update: data,
    });
  }

  // Une séance passée et terminée (sans créneau), évaluée par le mentoré : historique réaliste.
  const pastStart = new Date();
  pastStart.setUTCDate(pastStart.getUTCDate() - 3);
  pastStart.setUTCHours(15, 0, 0, 0);
  const pastSessionId = 'seed_session_mohamed_thierno_1';
  await prisma.mentoringSession.upsert({
    where: { id: pastSessionId },
    create: {
      id: pastSessionId,
      mentorshipId: mentorship.id,
      mentorId: thiernoId,
      menteeId: mohamedId,
      startsAt: pastStart,
      endsAt: new Date(pastStart.getTime() + 60 * 60_000),
      status: 'COMPLETED',
      topic: 'Clarifier la cible et la proposition de valeur',
      modality: 'IN_PERSON',
      location: 'Conakry (lieu fictif)',
      confirmedAt: new Date(pastStart.getTime() - 86_400_000),
    },
    update: {},
  });
  await prisma.sessionFeedback.upsert({
    where: { sessionId_authorId: { sessionId: pastSessionId, authorId: mohamedId } },
    create: {
      sessionId: pastSessionId,
      authorId: mohamedId,
      rating: 5,
      comment: 'Séance très concrète : je sais maintenant comment présenter mon projet.',
    },
    update: {},
  });

  const messageCount = await prisma.message.count({ where: { mentorshipId: mentorship.id } });
  if (messageCount === 0) {
    const base = Date.now() - 2 * 86_400_000;
    await prisma.message.createMany({
      data: [
        {
          mentorshipId: mentorship.id,
          senderId: thiernoId,
          content:
            'Bienvenue Mohamed ! Pour commencer, pouvez-vous m’envoyer une description de vos clients cibles ?',
          createdAt: new Date(base),
          readAt: new Date(base + 3_600_000),
        },
        {
          mentorshipId: mentorship.id,
          senderId: mohamedId,
          content:
            'Merci ! Je cible les restaurants et les familles des quartiers de Kaloum et Ratoma. Je prépare une synthèse.',
          createdAt: new Date(base + 7_200_000),
          readAt: new Date(base + 8_000_000),
        },
      ],
    });
  }

  const counts = {
    domaines: await prisma.expertiseDomain.count(),
    mentors: await prisma.user.count({ where: { role: 'MENTOR' } }),
    mentorés: await prisma.user.count({ where: { role: 'MENTEE' } }),
    créneauxAjoutés: slotCount,
  };
  console.log('Seed terminée :', counts);
  console.log(`Comptes de démonstration (dev uniquement) — mot de passe commun : ${DEMO_PASSWORD}`);
  console.log(
    `  Mentorée : ${email('aminata')}   Mentore : ${email('fatoumata')}   Admin : ${email('admin')}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
