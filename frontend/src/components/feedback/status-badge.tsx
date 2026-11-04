import {
  BadgeCheck,
  Ban,
  CircleCheck,
  CircleDashed,
  CircleDot,
  Clock,
  Hourglass,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  goalStatusLabels,
  mentorshipStatusLabels,
  requestStatusLabels,
  sessionStatusLabels,
  verificationLabels,
} from '@/lib/labels';
import type {
  GoalStatus,
  MentorshipRequestStatus,
  MentorshipStatus,
  SessionStatus,
  VerificationStatus,
} from '@/lib/types';

type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'teal' | 'verified' | 'ink';
type Def = { label: string; tone: Tone; icon: LucideIcon };

const request: Record<MentorshipRequestStatus, Def> = {
  PENDING: { label: requestStatusLabels.PENDING, tone: 'warning', icon: Hourglass },
  ACCEPTED: { label: requestStatusLabels.ACCEPTED, tone: 'success', icon: CircleCheck },
  DECLINED: { label: requestStatusLabels.DECLINED, tone: 'danger', icon: XCircle },
  CANCELLED: { label: requestStatusLabels.CANCELLED, tone: 'neutral', icon: Ban },
};

const session: Record<SessionStatus, Def> = {
  REQUESTED: { label: sessionStatusLabels.REQUESTED, tone: 'warning', icon: Clock },
  CONFIRMED: { label: sessionStatusLabels.CONFIRMED, tone: 'success', icon: CircleCheck },
  CANCELLED: { label: sessionStatusLabels.CANCELLED, tone: 'danger', icon: Ban },
  COMPLETED: { label: sessionStatusLabels.COMPLETED, tone: 'ink', icon: CircleCheck },
};

const goal: Record<GoalStatus, Def> = {
  NOT_STARTED: { label: goalStatusLabels.NOT_STARTED, tone: 'neutral', icon: CircleDashed },
  IN_PROGRESS: { label: goalStatusLabels.IN_PROGRESS, tone: 'teal', icon: CircleDot },
  COMPLETED: { label: goalStatusLabels.COMPLETED, tone: 'success', icon: CircleCheck },
};

const mentorship: Record<MentorshipStatus, Def> = {
  ACTIVE: { label: mentorshipStatusLabels.ACTIVE, tone: 'teal', icon: CircleDot },
  COMPLETED: { label: mentorshipStatusLabels.COMPLETED, tone: 'ink', icon: CircleCheck },
  CANCELLED: { label: mentorshipStatusLabels.CANCELLED, tone: 'neutral', icon: Ban },
};

const verification: Record<VerificationStatus, Def> = {
  VERIFIED: { label: verificationLabels.VERIFIED, tone: 'verified', icon: BadgeCheck },
  PENDING: { label: verificationLabels.PENDING, tone: 'warning', icon: Hourglass },
  UNVERIFIED: { label: verificationLabels.UNVERIFIED, tone: 'neutral', icon: CircleDashed },
  REJECTED: { label: verificationLabels.REJECTED, tone: 'danger', icon: XCircle },
};

const maps = { request, session, goal, mentorship, verification };

type Props =
  | { kind: 'request'; status: MentorshipRequestStatus }
  | { kind: 'session'; status: SessionStatus }
  | { kind: 'goal'; status: GoalStatus }
  | { kind: 'mentorship'; status: MentorshipStatus }
  | { kind: 'verification'; status: VerificationStatus };

/** Badge de statut : couleur + icône + libellé (jamais la couleur seule). */
export function StatusBadge(props: Props & { className?: string }) {
  const def = (maps[props.kind] as Record<string, Def>)[props.status];
  const Icon = def.icon;
  return (
    <Badge tone={def.tone} className={props.className}>
      <Icon aria-hidden />
      {def.label}
    </Badge>
  );
}
