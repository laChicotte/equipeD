import type {
  GoalStatus,
  MenteeSituation,
  MentorshipRequestStatus,
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

export const CAMPUS_FRANCE_NOTICE =
  'Conseil et orientation, sans garantie d’admission ni de visa.';

export function isCampusFrance(slug: string | undefined | null): boolean {
  return !!slug && slug.toLowerCase().includes('campus');
}
