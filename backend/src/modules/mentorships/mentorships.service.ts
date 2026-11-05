import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { conflict } from '../../common/errors.js';
import { NotificationsService } from '../notifications/notifications.module.js';
import { MentorshipAccessService } from './mentorship-access.service.js';
import { issueCertificateIfEligible } from '../certificates/certificates.module.js';

const person = {
  select: {
    id: true,
    firstName: true,
    lastName: true,
    avatarUpdatedAt: true,
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
    certificate: { select: { code: true, issuedAt: true } },
    messages: {
      orderBy: { createdAt: 'desc' },
      take: 1,
      select: {
        content: true,
        createdAt: true,
        senderId: true,
        callId: true,
        file: { select: { fileName: true, mimeType: true } },
      },
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
    private readonly notifications: NotificationsService,
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

  /**
   * Clôture par l'un des participants (ACTIVE → COMPLETED), avec un bilan facultatif.
   * Les séances futures encore actives sont annulées ; le créneau du mentor redevient libre
   * et sa capacité d'accompagnement est libérée. Idempotente.
   */
  async complete(user: AuthUser, id: string, note?: string) {
    const access = await this.access.assertParticipant(user, id);
    if (access.status === 'COMPLETED') return this.getOne(user, id);
    if (access.status !== 'ACTIVE') {
      throw conflict(
        'INVALID_TRANSITION',
        'Ce mentorat a été interrompu et ne peut pas être clôturé.',
      );
    }
    const now = new Date();
    const closed = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.mentorship.updateMany({
        where: { id, status: 'ACTIVE' },
        data: { status: 'COMPLETED', endedAt: now, endedById: user.id, endNote: note ?? null },
      });
      if (updated.count === 0) return null;
      await tx.mentoringSession.updateMany({
        where: {
          mentorshipId: id,
          status: { in: ['REQUESTED', 'CONFIRMED'] },
          startsAt: { gt: now },
        },
        data: { status: 'CANCELLED', cancelledAt: now, cancelledBy: user.id },
      });
      // Certificat d'accompagnement : au moins une séance réalisée (voir certificates.module).
      return { certificate: await issueCertificateIfEligible(tx, id, now) };
    });
    if (closed) {
      await this.notifications.notify({
        userId: access.counterpartId,
        type: 'MENTORSHIP_COMPLETED',
        title: `${user.firstName} ${user.lastName} a clôturé votre mentorat`,
        body:
          note ?? 'Le mentorat reste consultable et vous pouvez continuer à échanger par message.',
        link: `/mentorats/${id}`,
      });
      if (closed.certificate) {
        await this.notifications.notify({
          userId: closed.certificate.mentorId,
          type: 'CERTIFICATE_ISSUED',
          title: 'Nouveau certificat d’accompagnement',
          body: `Accompagnement de ${closed.certificate.menteeName} en ${closed.certificate.domainName} : ${closed.certificate.completedSessions} séance(s) réalisée(s). Il est visible sur votre fiche.`,
          link: `/certificats/${closed.certificate.code}`,
        });
      }
    }
    return this.getOne(user, id);
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
      endedById: m.endedById,
      endNote: m.endNote,
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
      certificate: m.certificate,
    };
  }
}
