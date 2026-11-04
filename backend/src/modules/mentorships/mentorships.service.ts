import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { MentorshipAccessService } from './mentorship-access.service.js';

const person = {
  select: {
    id: true,
    firstName: true,
    lastName: true,
    mentorProfile: { select: { headline: true } },
    menteeProfile: { select: { situation: true, goalsSummary: true } },
  },
} as const;

function buildInclude(userId: string, now: Date) {
  return {
    mentor: person,
    mentee: person,
    request: { select: { goal: true, domain: { select: { id: true, name: true, slug: true } } } },
    sessions: {
      where: { status: { in: ['REQUESTED', 'CONFIRMED'] }, endsAt: { gt: now } },
      orderBy: { startsAt: 'asc' },
      take: 1,
      select: { id: true, startsAt: true, endsAt: true, status: true },
    },
    goals: { select: { progress: true, status: true } },
    messages: {
      orderBy: { createdAt: 'desc' },
      take: 1,
      select: { content: true, createdAt: true, senderId: true },
    },
    _count: { select: { messages: { where: { readAt: null, senderId: { not: userId } } } } },
  } satisfies Prisma.MentorshipInclude;
}

type MentorshipRow = Prisma.MentorshipGetPayload<{ include: ReturnType<typeof buildInclude> }>;

@Injectable()
export class MentorshipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: MentorshipAccessService,
  ) {}

  /** Mentorats de l'utilisateur, avec prochaine séance, objectifs et messages non lus. */
  async listMine(user: AuthUser) {
    const rows = await this.prisma.mentorship.findMany({
      where: { OR: [{ mentorId: user.id }, { menteeId: user.id }] },
      orderBy: [{ status: 'asc' }, { startedAt: 'desc' }],
      include: buildInclude(user.id, new Date()),
    });
    return rows.map((m) => this.serialize(user, m));
  }

  async getOne(user: AuthUser, id: string) {
    await this.access.assertParticipant(user, id);
    const m = await this.prisma.mentorship.findUniqueOrThrow({
      where: { id },
      include: buildInclude(user.id, new Date()),
    });
    return this.serialize(user, m);
  }

  private serialize(user: AuthUser, m: MentorshipRow) {
    const isMentor = m.mentorId === user.id;
    const avg = m.goals.length
      ? Math.round(m.goals.reduce((sum, g) => sum + g.progress, 0) / m.goals.length)
      : null;
    return {
      id: m.id,
      status: m.status,
      startedAt: m.startedAt,
      endedAt: m.endedAt,
      myRole: isMentor ? ('MENTOR' as const) : ('MENTEE' as const),
      mentor: m.mentor,
      mentee: m.mentee,
      counterpart: isMentor ? m.mentee : m.mentor,
      initialGoal: m.request.goal,
      domain: m.request.domain,
      nextSession: m.sessions[0] ?? null,
      goalsCount: m.goals.length,
      goalsCompleted: m.goals.filter((g) => g.status === 'COMPLETED').length,
      averageProgress: avg,
      lastMessage: m.messages[0] ?? null,
      unreadCount: m._count.messages,
    };
  }
}
