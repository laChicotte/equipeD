/**
 * Parcours guidés : modèles d'objectifs avec leurs jalons, prêts à ajouter dans un mentorat.
 *
 * Le catalogue est versionné avec le code (et non saisi en base) : il est relu par l'équipe,
 * identique pour tous et ne dépend d'aucun service externe. Chaque parcours est rattaché à un
 * domaine des TDR (§5) par son slug. Les contenus restent des conseils d'organisation : ils ne
 * remplacent ni le mentor ni les informations officielles des organismes cités.
 */
export interface GuidedGoalTemplate {
  /** Identifiant stable dans le parcours (kebab-case). */
  key: string;
  title: string;
  description: string;
  milestones: string[];
}

export interface GuidedPath {
  /** Identifiant stable (kebab-case), utilisé dans l'URL. */
  key: string;
  domainSlug: string;
  title: string;
  summary: string;
  /** Mention affichée avec le parcours (limites de l'accompagnement). */
  notice?: string;
  goals: GuidedGoalTemplate[];
}

export const GUIDED_PATHS: readonly GuidedPath[] = [
  // ─── 5.7 Campus France ─────────────────────────────────────────────────────
  {
    key: 'campus-france',
    domainSlug: 'campus-france',
    title: 'Préparer sa candidature Campus France',
    summary:
      'Les quatre grandes étapes d’un projet d’études en France : le projet, le dossier, l’entretien et les démarches de départ.',
    notice:
      'Conseil et orientation uniquement : cet accompagnement ne garantit ni l’admission dans un établissement, ni l’obtention d’un visa. Vérifiez toujours le calendrier et les pièces demandées sur les sites officiels.',
    goals: [
      {
        key: 'projet-etudes',
        title: 'Définir un projet d’études cohérent',
        description:
          'Relier son parcours, la formation visée et le projet professionnel, pour pouvoir l’expliquer clairement.',
        milestones: [
          'Faire le bilan de son parcours académique et de ses résultats',
          'Identifier trois à cinq formations et établissements adaptés à son profil',
          'Comparer les programmes, les prérequis et les débouchés',
          'Formuler son projet professionnel en quelques phrases',
          'Valider la cohérence du projet avec son mentor',
        ],
      },
      {
        key: 'dossier-candidature',
        title: 'Constituer un dossier de candidature solide',
        description:
          'Rassembler les pièces, rédiger le CV et les lettres de motivation, puis relire le dossier avant l’envoi.',
        milestones: [
          'Créer son compte sur la plateforme Études en France et noter le calendrier',
          'Rassembler les relevés de notes, diplômes et traductions demandés',
          'Rédiger un CV clair d’une page',
          'Rédiger une lettre de motivation adaptée à chaque formation',
          'Faire relire le CV et les lettres par son mentor',
          'Vérifier que le dossier est complet avant de le soumettre',
        ],
      },
      {
        key: 'entretien',
        title: 'Préparer l’entretien Campus France',
        description:
          'Savoir présenter son parcours, justifier ses choix et répondre aux questions avec assurance.',
        milestones: [
          'Préparer une présentation de son parcours en deux minutes',
          'Savoir justifier le choix de chaque formation et de la France',
          'Lister les questions probables et préparer ses réponses',
          'Faire une simulation d’entretien avec son mentor',
          'Retravailler les points faibles relevés lors de la simulation',
        ],
      },
      {
        key: 'demarches-depart',
        title: 'Anticiper les démarches de mobilité',
        description:
          'Se renseigner tôt sur le visa, le budget, le logement et l’arrivée, avec le témoignage d’anciens étudiants.',
        milestones: [
          'Lire les informations officielles sur la demande de visa étudiant',
          'Estimer son budget mensuel et les justificatifs de ressources',
          'Se renseigner sur les solutions de logement',
          'Échanger avec un ancien étudiant ayant étudié en France',
          'Préparer la liste des démarches à faire dès l’arrivée',
        ],
      },
    ],
  },

  // ─── 5.3 Orientation et insertion professionnelle ─────────────────────────
  {
    key: 'premier-emploi',
    domainSlug: 'orientation-insertion',
    title: 'Décrocher son premier emploi',
    summary: 'Du projet professionnel à l’entretien d’embauche, en passant par le CV et le réseau.',
    goals: [
      {
        key: 'projet-pro',
        title: 'Clarifier son projet professionnel',
        description: 'Savoir quels postes viser, dans quels secteurs, et pourquoi.',
        milestones: [
          'Lister ses compétences, ses expériences et ses centres d’intérêt',
          'Identifier deux ou trois métiers cibles',
          'Échanger avec une personne qui exerce l’un de ces métiers',
          'Choisir les postes à viser en priorité',
        ],
      },
      {
        key: 'cv-lettre',
        title: 'Préparer un CV et une lettre qui convainquent',
        description: 'Des documents courts, adaptés à chaque offre, relus par son mentor.',
        milestones: [
          'Rédiger un CV d’une page orienté résultats',
          'Rédiger une lettre de motivation type',
          'Adapter le CV et la lettre à une offre réelle',
          'Faire relire et corriger par son mentor',
        ],
      },
      {
        key: 'entretien-embauche',
        title: 'Réussir ses entretiens d’embauche',
        description: 'Se présenter, valoriser ses expériences et poser les bonnes questions.',
        milestones: [
          'Préparer sa présentation en une minute',
          'Préparer trois exemples concrets de réussites',
          'Faire une simulation d’entretien avec son mentor',
          'Préparer les questions à poser au recruteur',
        ],
      },
      {
        key: 'reseau',
        title: 'Développer son réseau professionnel',
        description: 'Se faire connaître et entretenir des contacts utiles.',
        milestones: [
          'Compléter un profil professionnel en ligne',
          'Contacter cinq professionnels du secteur visé',
          'Participer à un événement professionnel ou un salon',
        ],
      },
    ],
  },

  // ─── 5.1 Entrepreneuriat ──────────────────────────────────────────────────
  {
    key: 'lancer-son-projet',
    domainSlug: 'entrepreneuriat',
    title: 'Structurer et lancer son projet',
    summary:
      'De l’idée au premier client : valider le besoin, bâtir son modèle, chercher un financement.',
    goals: [
      {
        key: 'valider-idee',
        title: 'Valider son idée auprès de vrais clients',
        description: 'Vérifier que le problème existe et que des personnes sont prêtes à payer.',
        milestones: [
          'Décrire le problème résolu et le client visé',
          'Interroger au moins dix clients potentiels',
          'Analyser la concurrence et les solutions existantes',
          'Ajuster l’offre selon les retours',
        ],
      },
      {
        key: 'modele-economique',
        title: 'Construire son modèle économique',
        description: 'Prix, coûts, revenus : savoir si le projet peut tenir dans la durée.',
        milestones: [
          'Remplir un business model canvas',
          'Estimer les coûts de démarrage et les charges mensuelles',
          'Fixer un prix et calculer le seuil de rentabilité',
          'Faire relire les hypothèses par son mentor',
        ],
      },
      {
        key: 'financement',
        title: 'Préparer sa recherche de financement',
        description: 'Présenter son projet de façon convaincante et cibler les bons financeurs.',
        milestones: [
          'Rédiger une présentation du projet en dix diapositives',
          'Identifier les financements adaptés (subventions, concours, prêts)',
          'S’entraîner à pitcher son projet en trois minutes',
          'Déposer une première candidature',
        ],
      },
    ],
  },

  // ─── 5.2 Numérique et technologies ────────────────────────────────────────
  {
    key: 'portfolio-tech',
    domainSlug: 'numerique-technologies',
    title: 'Se lancer dans un métier du numérique',
    summary: 'Choisir sa spécialité, apprendre en construisant, montrer ses réalisations.',
    goals: [
      {
        key: 'feuille-route',
        title: 'Établir sa feuille de route d’apprentissage',
        description: 'Choisir une spécialité et les compétences à acquérir en priorité.',
        milestones: [
          'Choisir une spécialité (développement, données, cybersécurité, design…)',
          'Lister les compétences clés à maîtriser',
          'Sélectionner des ressources d’apprentissage gratuites',
          'Fixer un rythme d’apprentissage hebdomadaire',
        ],
      },
      {
        key: 'portfolio',
        title: 'Publier un portfolio de projets',
        description: 'Trois projets concrets, documentés et accessibles en ligne.',
        milestones: [
          'Choisir trois projets à réaliser',
          'Réaliser le premier projet et le faire relire',
          'Publier le code ou les maquettes en ligne',
          'Rédiger une courte présentation de chaque projet',
        ],
      },
    ],
  },

  // ─── 5.4 Culture et industries créatives ──────────────────────────────────
  {
    key: 'projet-creatif',
    domainSlug: 'culture-industries-creatives',
    title: 'Mener à bien un projet créatif',
    summary: 'Écriture, édition, contenu ou audiovisuel : du projet à sa diffusion.',
    goals: [
      {
        key: 'projet-ecriture',
        title: 'Finaliser son projet d’écriture ou de création',
        description: 'Avancer régulièrement et obtenir des retours sur son travail.',
        milestones: [
          'Définir le projet, le public et le format',
          'Fixer un calendrier de production',
          'Soumettre une première version à son mentor',
          'Retravailler à partir des retours',
        ],
      },
      {
        key: 'diffusion',
        title: 'Faire connaître sa création',
        description: 'Trouver son public : éditeurs, festivals, réseaux, partenaires.',
        milestones: [
          'Identifier les éditeurs, diffuseurs ou festivals adaptés',
          'Préparer un dossier de présentation',
          'Présenter le projet à au moins trois contacts',
        ],
      },
    ],
  },

  // ─── 5.5 Gestion, finance et administration ──────────────────────────────
  {
    key: 'gestion-projet',
    domainSlug: 'gestion-finance-administration',
    title: 'Piloter un projet ou un budget',
    summary: 'Les outils de base pour planifier, suivre un budget et rendre compte.',
    goals: [
      {
        key: 'planifier',
        title: 'Planifier un projet de bout en bout',
        description: 'Découper le projet, estimer les délais et suivre l’avancement.',
        milestones: [
          'Définir les objectifs et le périmètre du projet',
          'Découper le projet en tâches et fixer les échéances',
          'Choisir un outil de suivi simple',
          'Présenter un point d’avancement à son mentor',
        ],
      },
      {
        key: 'budget',
        title: 'Construire et suivre un budget',
        description: 'Prévoir les dépenses et les recettes, puis comparer avec le réalisé.',
        milestones: [
          'Établir un budget prévisionnel',
          'Mettre en place un tableau de suivi mensuel',
          'Analyser les écarts entre prévu et réalisé',
        ],
      },
    ],
  },

  // ─── 5.6 Développement personnel et leadership ───────────────────────────
  {
    key: 'prise-de-parole',
    domainSlug: 'developpement-personnel-leadership',
    title: 'Gagner en aisance et en leadership',
    summary: 'Prendre la parole en public, s’organiser et animer une équipe.',
    goals: [
      {
        key: 'parler-en-public',
        title: 'Prendre la parole en public avec assurance',
        description: 'Structurer son propos et s’entraîner jusqu’à être à l’aise.',
        milestones: [
          'Préparer une intervention de trois minutes',
          'S’enregistrer et s’écouter',
          'Présenter devant son mentor et recueillir ses retours',
          'Intervenir devant un groupe',
        ],
      },
      {
        key: 'organisation',
        title: 'Mieux gérer son temps',
        description: 'Prioriser, planifier sa semaine et tenir ses engagements.',
        milestones: [
          'Lister ses activités sur une semaine type',
          'Choisir une méthode de priorisation',
          'Planifier chaque semaine pendant un mois',
          'Faire le bilan avec son mentor',
        ],
      },
    ],
  },
];

export function findGuidedPath(key: string): GuidedPath | undefined {
  return GUIDED_PATHS.find((p) => p.key === key);
}
