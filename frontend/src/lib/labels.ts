import type {
  GoalStatus,
  MenteeSituation,
  MentorshipRequestStatus,
  OpportunityType,
  ResourceKind,
  MentorshipStatus,
  Modality,
  Role,
  SessionStatus,
  VerificationStatus,
} from './types';

export const roleLabels: Record<Role, string> = {
  MENTEE: 'Mentoré·e',
  MENTOR: 'Mentor',
  ADMIN: 'Administrateur',
  SUPER_ADMIN: 'Super-administrateur',
};

export const modalityLabels: Record<Modality, string> = {
  REMOTE: 'À distance',
  IN_PERSON: 'En présentiel',
  HYBRID: 'Hybride',
};

export const verificationLabels: Record<VerificationStatus, string> = {
  UNVERIFIED: 'Non vérifié',
  PENDING: 'Vérification en cours',
  VERIFIED: 'Profil vérifié',
  REJECTED: 'Non retenu',
};

export const situationLabels: Record<MenteeSituation, string> = {
  STUDENT: 'Étudiant·e',
  GRADUATE: 'Jeune diplômé·e',
  ENTREPRENEUR: 'Entrepreneur·e',
  PROJECT_HOLDER: 'Porteur·se de projet',
  CAREER_CHANGE: 'En reconversion',
  PROFESSIONAL: 'Professionnel·le',
  OTHER: 'Autre',
};

export const requestStatusLabels: Record<MentorshipRequestStatus, string> = {
  PENDING: 'En attente',
  ACCEPTED: 'Acceptée',
  DECLINED: 'Refusée',
  CANCELLED: 'Annulée',
};

export const mentorshipStatusLabels: Record<MentorshipStatus, string> = {
  ACTIVE: 'En cours',
  COMPLETED: 'Terminé',
  CANCELLED: 'Interrompu',
};

export const sessionStatusLabels: Record<SessionStatus, string> = {
  REQUESTED: 'À confirmer',
  CONFIRMED: 'Confirmée',
  CANCELLED: 'Annulée',
  COMPLETED: 'Terminée',
};

export const goalStatusLabels: Record<GoalStatus, string> = {
  NOT_STARTED: 'À démarrer',
  IN_PROGRESS: 'En cours',
  COMPLETED: 'Atteint',
};

export const LANGUAGES = ['Français', 'Anglais', 'Pular', 'Malinké', 'Soussou'] as const;

export const CAMPUS_FRANCE_NOTICE = 'Conseil et orientation, sans garantie d’admission ni de visa.';

export function isCampusFrance(slug: string | undefined | null): boolean {
  return !!slug && slug.toLowerCase().includes('campus');
}

export const resourceKindLabels: Record<ResourceKind, string> = {
  ARTICLE: 'Article',
  VIDEO: 'Vidéo',
  TEMPLATE: 'Modèle',
  TOOL: 'Outil',
  ADVICE: 'Conseil',
  OTHER: 'Autre',
};

export const opportunityTypeLabels: Record<OpportunityType, string> = {
  INTERNSHIP: 'Stage',
  JOB: 'Emploi',
  CALL_FOR_PROJECTS: 'Appel à projets',
  SCHOLARSHIP: 'Bourse',
  TRAINING: 'Formation',
  EVENT: 'Événement',
  OTHER: 'Autre',
};

/** Fuseaux proposés dans le compte (le fuseau de référence du programme en premier). */
export const TIMEZONES = [
  { value: 'Africa/Conakry', label: 'Conakry (GMT)' },
  { value: 'Africa/Dakar', label: 'Dakar (GMT)' },
  { value: 'Africa/Abidjan', label: 'Abidjan (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Brussels', label: 'Bruxelles (CET/CEST)' },
  { value: 'America/Montreal', label: 'Montréal (EST/EDT)' },
  { value: 'UTC', label: 'UTC' },
] as const;
