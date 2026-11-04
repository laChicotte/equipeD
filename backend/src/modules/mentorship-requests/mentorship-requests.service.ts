import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import {
  conflict,
  forbidden,
  isConstraintViolation,
  notFound,
  unprocessable,
} from '../../common/errors.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { MentorshipRequestStatus } from '../../generated/prisma/enums.js';
import type { CreateMentorshipRequestDto, DecisionDto } from './mentorship-requests.dto.js';

const personSelect = { id: true, firstName: true, lastName: true } as const;

const requestInclude = {
  mentee: {
    select: {
      ...personSelect,
      menteeProfile: {
        select: {
          situation: true,
          goalsSummary: true,
          preferredModality: true,
          city: true,
          desiredSkills: true,
        },
      },
    },
  },
  mentor: {
    select: { ...personSelect, mentorProfile: { select: { headline: true } } },
  },
  domain: { select: { id: true, slug: true, name: true } },
  mentorship: { select: { id: true, status: true } },
} satisfies Prisma.MentorshipRequestInclude;

@Injectable()
export class MentorshipRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: AuthUser, dto: CreateMentorshipRequestDto) {
    if (dto.mentorId === user.id) {
      throw unprocessable('SELF_REQUEST', 'Vous ne pouvez pas vous adresser une demande.');
    }
    const menteeProfile = await this.prisma.menteeProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!menteeProfile) {
      throw unprocessable(
        'PROFILE_REQUIRED',
        'Complétez votre profil avant d’envoyer une demande.',
      );
    }

    const mentor = await this.prisma.user.findFirst({
      where: {
        id: dto.mentorId,
        role: 'MENTOR',
        status: 'ACTIVE',
        mentorProfile: { isPublished: true },
      },
      select: { id: true, mentorProfile: { select: { domains: { select: { domainId: true } } } } },
    });
    if (!mentor) throw notFound('MENTOR_NOT_FOUND', 'Ce mentor est introuvable.');

    if (dto.domainId && !mentor.mentorProfile!.domains.some((d) => d.domainId === dto.domainId)) {
      throw unprocessable(
        'INVALID_DOMAIN',
        'Ce domaine ne fait pas partie des domaines du mentor.',
      );
    }

    const active = await this.prisma.mentorship.findFirst({
      where: { mentorId: mentor.id, menteeId: user.id, status: 'ACTIVE' },
      select: { id: true },
    });
    if (active) throw conflict('ALREADY_MENTORED', 'Vous êtes déjà accompagné(e) par ce mentor.');

    try {
      // L'index partiel mentorship_requests_one_pending garantit l'unicité même en cas de requêtes concurrentes.
      return await this.prisma.mentorshipRequest.create({
        data: {
          menteeId: user.id,
          mentorId: mentor.id,
          domainId: dto.domainId ?? null,
          goal: dto.goal,
          message: dto.message,
        },
        include: requestInclude,
      });
    } catch (error) {
      if (isConstraintViolation(error, 'mentorship_requests_one_pending')) {
        throw conflict(
          'REQUEST_ALREADY_PENDING',
          'Une demande est déjà en attente auprès de ce mentor.',
        );
      }
      throw error;
    }
  }

  inbox(user: AuthUser, status?: MentorshipRequestStatus) {
    return this.prisma.mentorshipRequest.findMany({
      where: { mentorId: user.id, ...(status ? { status } : {}) },
      include: requestInclude,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    });
  }

  sent(user: AuthUser, status?: MentorshipRequestStatus) {
    return this.prisma.mentorshipRequest.findMany({
      where: { menteeId: user.id, ...(status ? { status } : {}) },
      include: requestInclude,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getOne(user: AuthUser, id: string) {
    const request = await this.prisma.mentorshipRequest.findUnique({
      where: { id },
      include: requestInclude,
    });
    if (!request) throw notFound('REQUEST_NOT_FOUND', 'Demande introuvable.');
    if (request.menteeId !== user.id && request.mentorId !== user.id) {
      throw forbidden('NOT_PARTICIPANT', 'Cette demande ne vous concerne pas.');
    }
    return request;
  }

  /**
   * Acceptation : transition PENDING → ACCEPTED et création du mentorat dans une seule transaction.
   * Idempotente : rejouer l'acceptation d'une demande déjà acceptée renvoie le mentorat existant.
   */
  async accept(user: AuthUser, id: string, dto: DecisionDto) {
    const request = await this.loadForMentor(user, id);

    if (request.status === 'ACCEPTED') {
      return this.getOne(user, id);
    }
    this.assertPending(request.status);

    const [activeCount, profile] = await Promise.all([
      this.prisma.mentorship.count({ where: { mentorId: user.id, status: 'ACTIVE' } }),
      this.prisma.mentorProfile.findUnique({
        where: { userId: user.id },
        select: { maxMentees: true },
      }),
    ]);
    if (profile && activeCount >= profile.maxMentees) {
      throw conflict(
        'MENTOR_AT_CAPACITY',
        `Vous accompagnez déjà ${activeCount} mentoré(s), votre maximum. Augmentez votre capacité dans votre profil.`,
      );
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        // Mise à jour conditionnelle : protège contre une double décision concurrente.
        const updated = await tx.mentorshipRequest.updateMany({
          where: { id, mentorId: user.id, status: 'PENDING' },
          data: { status: 'ACCEPTED', respondedAt: new Date(), decisionNote: dto.note ?? null },
        });
        if (updated.count === 0) {
          throw conflict('INVALID_TRANSITION', 'Cette demande a déjà été traitée.');
        }
        await tx.mentorship.upsert({
          where: { requestId: id },
          create: { requestId: id, mentorId: request.mentorId, menteeId: request.menteeId },
          update: {},
        });
      });
    } catch (error) {
      if (isConstraintViolation(error, 'mentorships_one_active')) {
        throw conflict('ALREADY_MENTORED', 'Un mentorat est déjà actif avec ce mentoré.');
      }
      throw error;
    }
    return this.getOne(user, id);
  }

  async decline(user: AuthUser, id: string, dto: DecisionDto) {
    const request = await this.loadForMentor(user, id);
    if (request.status === 'DECLINED') return this.getOne(user, id);
    this.assertPending(request.status);

    const updated = await this.prisma.mentorshipRequest.updateMany({
      where: { id, mentorId: user.id, status: 'PENDING' },
      data: { status: 'DECLINED', respondedAt: new Date(), decisionNote: dto.note ?? null },
    });
    if (updated.count === 0)
      throw conflict('INVALID_TRANSITION', 'Cette demande a déjà été traitée.');
    return this.getOne(user, id);
  }

  /** Le mentoré peut retirer une demande tant qu'elle est en attente. */
  async cancel(user: AuthUser, id: string) {
    const request = await this.prisma.mentorshipRequest.findUnique({
      where: { id },
      select: { menteeId: true, status: true },
    });
    if (!request) throw notFound('REQUEST_NOT_FOUND', 'Demande introuvable.');
    if (request.menteeId !== user.id) {
      throw forbidden('NOT_REQUEST_OWNER', 'Seul l’auteur de la demande peut l’annuler.');
    }
    if (request.status === 'CANCELLED') return this.getOne(user, id);
    this.assertPending(request.status);
    const updated = await this.prisma.mentorshipRequest.updateMany({
      where: { id, menteeId: user.id, status: 'PENDING' },
      data: { status: 'CANCELLED', respondedAt: new Date() },
    });
    if (updated.count === 0)
      throw conflict('INVALID_TRANSITION', 'Cette demande a déjà été traitée.');
    return this.getOne(user, id);
  }

  private async loadForMentor(user: AuthUser, id: string) {
    const request = await this.prisma.mentorshipRequest.findUnique({
      where: { id },
      select: { id: true, mentorId: true, menteeId: true, status: true },
    });
    if (!request) throw notFound('REQUEST_NOT_FOUND', 'Demande introuvable.');
    if (request.mentorId !== user.id) {
      throw forbidden(
        'NOT_REQUEST_MENTOR',
        'Seul le mentor sollicité peut répondre à cette demande.',
      );
    }
    return request;
  }

  private assertPending(status: MentorshipRequestStatus): void {
    if (status !== 'PENDING') {
      const labels: Record<MentorshipRequestStatus, string> = {
        PENDING: 'en attente',
        ACCEPTED: 'acceptée',
        DECLINED: 'refusée',
        CANCELLED: 'annulée',
      };
      throw conflict('INVALID_TRANSITION', `Cette demande est déjà ${labels[status]}.`);
    }
  }
}
