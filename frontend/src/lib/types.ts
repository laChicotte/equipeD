// Types alignés sur le contrat d'API réellement implémenté (docs/HANDOFF_FRONTEND.md §4).

export type Role = 'MENTEE' | 'MENTOR' | 'ADMIN' | 'SUPER_ADMIN';
export type Modality = 'REMOTE' | 'IN_PERSON' | 'HYBRID';
export type VerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
export type MenteeSituation =
  | 'STUDENT'
  | 'GRADUATE'
  | 'ENTREPRENEUR'
  | 'PROJECT_HOLDER'
  | 'CAREER_CHANGE'
  | 'PROFESSIONAL'
  | 'OTHER';
export type MentorshipRequestStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
export type MentorshipStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type SessionStatus = 'REQUESTED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
export type GoalStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';
export type ResourceKind = 'ARTICLE' | 'VIDEO' | 'TEMPLATE' | 'TOOL' | 'ADVICE' | 'OTHER';
export type OpportunityType =
  'INTERNSHIP' | 'JOB' | 'CALL_FOR_PROJECTS' | 'SCHOLARSHIP' | 'TRAINING' | 'EVENT' | 'OTHER';
export type NotificationType =
  | 'REQUEST_RECEIVED'
  | 'REQUEST_ACCEPTED'
  | 'REQUEST_DECLINED'
  | 'SESSION_REQUESTED'
  | 'SESSION_CONFIRMED'
  | 'SESSION_CANCELLED'
  | 'GOAL_FEEDBACK'
  | 'RESOURCE_SHARED'
  | 'MENTORSHIP_COMPLETED'
  | 'CERTIFICATE_ISSUED';

export interface Me {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  /** Date de la photo de profil (null : initiales). */
  avatarUpdatedAt?: string | null;
  role: Role;
  timezone: string;
  onboardedAt: string | null;
  createdAt: string;
  hasProfile: boolean;
  mentorProfileId: string | null;
}

export interface Domain {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  topics: string[];
  mentorCount: number;
}

export interface DomainRef {
  id: string;
  slug: string;
  name: string;
}

export interface MentorProfile {
  id: string;
  headline: string;
  bio: string;
  currentPosition: string | null;
  organization: string | null;
  yearsExperience: number;
  expertise: string[];
  languages: string[];
  modalities: Modality[];
  city: string | null;
  sessionDurationMin: number;
  verificationStatus: VerificationStatus;
  isPublished?: boolean;
  domains: DomainRef[];
}

export interface MenteeProfile {
  id: string;
  situation: MenteeSituation;
  goalsSummary: string;
  desiredSkills: string[];
  preferredModality: Modality;
  city: string | null;
  interests: DomainRef[];
}

export interface ProfileMe {
  user: Me;
  mentorProfile: MentorProfile | null;
  menteeProfile: MenteeProfile | null;
}

export interface MentorCard {
  id: string;
  firstName: string;
  lastName: string;
  /** Date de la photo de profil (null : initiales). */
  avatarUpdatedAt?: string | null;
  headline: string;
  bio: string;
  currentPosition: string | null;
  organization: string | null;
  yearsExperience: number;
  expertise: string[];
  languages: string[];
  modalities: Modality[];
  city: string | null;
  sessionDurationMin: number;
  verificationStatus: VerificationStatus;
  domains: DomainRef[];
  activeMentees: number;
  /** Personnes distinctes accompagnées (en cours ou mentorat terminé), tous domaines. */
  mentoredCount: number;
  /** Certificats d’accompagnement valides. */
  certificatesCount: number;
  nextAvailableAt: string | null;
  rating?: { average: number | null; count: number };
}

export interface MentorDetail extends MentorCard {
  relation: {
    pendingRequestId: string | null;
    mentorshipId: string | null;
    lastDeclinedAt: string | null;
  } | null;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Suggestions {
  profileRequired: boolean;
  items: { mentor: MentorCard; score: number; reasons: string[] }[];
}

export interface Slot {
  id: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
}

export interface MentorshipRequest {
  id: string;
  menteeId: string;
  mentorId: string;
  domainId: string | null;
  goal: string;
  message: string;
  status: MentorshipRequestStatus;
  decisionNote: string | null;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
  mentee: {
    id: string;
    firstName: string;
    lastName: string;
    /** Date de la photo de profil (null : initiales). */
    avatarUpdatedAt?: string | null;
    menteeProfile: {
      situation: MenteeSituation;
      goalsSummary: string;
      preferredModality: Modality;
      city: string | null;
      desiredSkills: string[];
    } | null;
  };
  mentor: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUpdatedAt?: string | null;
    mentorProfile: { headline: string } | null;
  };
  domain: DomainRef | null;
  mentorship: { id: string; status: MentorshipStatus } | null;
}

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  /** Date de la photo de profil (null : initiales). */
  avatarUpdatedAt?: string | null;
  mentorProfile: { headline: string } | null;
  menteeProfile: { situation: MenteeSituation; goalsSummary: string } | null;
}

export interface MentorshipSummary {
  id: string;
  status: MentorshipStatus;
  startedAt: string;
  endedAt: string | null;
  endedById?: string | null;
  endNote?: string | null;
  myRole: 'MENTOR' | 'MENTEE';
  mentor: Person;
  mentee: Person;
  counterpart: Person;
  initialGoal: string;
  domain: DomainRef | null;
  nextSession: { id: string; startsAt: string; endsAt: string; status: SessionStatus } | null;
  goalsCount: number;
  goalsCompleted: number;
  averageProgress: number | null;
  lastMessage: { content: string; createdAt: string; senderId: string } | null;
  unreadCount: number;
  certificate: { code: string; issuedAt: string } | null;
}

export interface PersonRef {
  id: string;
  firstName: string;
  lastName: string;
  /** Date de la photo de profil (null : initiales). */
  avatarUpdatedAt?: string | null;
}

export interface Session {
  id: string;
  mentorshipId: string;
  mentorId: string;
  menteeId: string;
  slotId: string;
  startsAt: string;
  endsAt: string;
  status: SessionStatus;
  topic: string;
  modality: Modality | null;
  meetingUrl: string | null;
  location: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  createdAt: string;
  updatedAt: string;
  mentor: PersonRef;
  mentee: PersonRef;
  feedbacks?: SessionFeedback[];
}

export interface SessionFeedback {
  id: string;
  authorId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface OwnSlot extends Slot {
  sessions: { id: string; status: SessionStatus; topic: string; mentee: PersonRef }[];
}

export interface Message {
  id: string;
  content: string;
  createdAt: string;
  readAt: string | null;
  senderId: string;
}

export interface Milestone {
  id: string;
  title: string;
  isDone: boolean;
  doneAt: string | null;
  sortOrder: number;
}

export interface Goal {
  id: string;
  mentorshipId: string;
  createdById: string;
  title: string;
  description: string | null;
  status: GoalStatus;
  progress: number;
  dueDate: string | null;
  mentorFeedback: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  milestones: Milestone[];
  createdBy: PersonRef;
}

export interface Dashboard {
  role: Role;
  pendingRequests: number;
  activeMentorships: number;
  upcomingSessions: Session[];
  sessionsAwaitingConfirmation: number;
  unreadMessages: number;
  goals: { total: number; completed: number; averageProgress: number | null };
  mentor: { certificates: number; freeUpcomingSlots: number } | null;
}

export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: { field: string; messages: string[] }[];
  path?: string;
  timestamp?: string;
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface AuthorRef {
  id: string;
  firstName: string;
  lastName: string;
  /** Date de la photo de profil (null : initiales). */
  avatarUpdatedAt?: string | null;
  role: Role;
  mentorProfile: { headline: string } | null;
}

export interface Resource {
  id: string;
  mentorshipId: string | null;
  kind: ResourceKind;
  title: string;
  description: string | null;
  url: string | null;
  createdAt: string;
  author: AuthorRef;
  domain: DomainRef | null;
}

export interface Opportunity {
  id: string;
  type: OpportunityType;
  title: string;
  organization: string;
  description: string;
  location: string | null;
  isRemote: boolean;
  url: string | null;
  deadline: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  domain: DomainRef | null;
  author: AuthorRef;
}

export interface AdminDomain {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  topics: string[];
  sortOrder: number;
  isActive: boolean;
  _count: { mentors: number; mentees: number; resources: number };
}

/** Certificat d’accompagnement (instantané figé à la clôture du mentorat). */
export interface Certificate {
  code: string;
  mentorId: string;
  mentorName: string;
  menteeName: string;
  domainName: string;
  startedAt: string;
  endedAt: string;
  completedSessions: number;
  totalMinutes: number;
  goalsCompleted: number;
  goalsTotal: number;
  averageRating: number | null;
  issuedAt: string;
}

export interface CertificateVerification extends Omit<Certificate, 'mentorId'> {
  mentorId: string;
  valid: boolean;
  mentor: { id: string | null; headline: string | null; avatarUpdatedAt: string | null };
}
