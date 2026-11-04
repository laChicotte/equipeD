import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { conflict, forbidden, isConstraintViolation, notFound } from '../../common/errors.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { SessionStatus } from '../../generated/prisma/enums.js';
import type { BookSessionDto, ConfirmSessionDto, ListSessionsQuery } from './scheduling.dto.js';

const sessionInclude = {
  mentor: { select: { id: true, firstName: true, lastName: true } },
  mentee: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.MentoringSessionInclude;

const STATUS_LABELS: Record<SessionStatus, string> = {
  REQUESTED: 'en attente de confirmation',
  CONFIRMED: 'confirmée',
  CANCELLED: 'annulée',
  COMPLETED: 'terminée',
};

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Réservation d'un créneau par le mentoré.
   * Garanties : relation de mentorat active obligatoire ; un créneau ne porte qu'une séance active
   * (index partiel) ; un mentor ou un mentoré n'a jamais deux séances actives qui se chevauchent
   * (contraintes d'exclusion PostgreSQL) — y compris en cas de requêtes simultanées.
   */
  async book(user: AuthUser, dto: BookSessionDto) {
    const slot = await this.prisma.availabilitySlot.findUnique({
      where: { id: dto.slotId },
      select: { id: true, mentorId: true, startsAt: true, endsAt: true, isActive: true },
    });
    if (!slot || !slot.isActive) throw notFound('SLOT_NOT_FOUND', 'Ce créneau n’est plus disponible.');
    if (slot.startsAt <= new Date()) throw conflict('SLOT_IN_PAST', 'Ce créneau est déjà passé.');

    const mentorship = await this.prisma.mentorship.findFirst({
      where: { mentorId: slot.mentorId, menteeId: user.id, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!mentorship) {
      throw forbidden(
        'NO_ACTIVE_MENTORSHIP',
        'Vous devez être accompagné(e) par ce mentor pour réserver un de ses créneaux.',
      );
    }

    try {
      return await this.prisma.mentoringSession.create({
        data: {
          mentorshipId: mentorship.id,
          mentorId: slot.mentorId,
          menteeId: user.id,
          slotId: slot.id,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          topic: dto.topic,
          modality: dto.modality ?? 'REMOTE',
        },
        include: sessionInclude,
      });
    } catch (error) {
      if (isConstraintViolation(error, 'mentoring_sessions_one_active_per_slot')) {
        throw conflict('SLOT_ALREADY_BOOKED', 'Ce créneau vient d’être réservé. Choisissez-en un autre.');
      }
      if (isConstraintViolation(error, 'mentoring_sessions_mentor_no_overlap')) {
        throw conflict('SLOT_ALREADY_BOOKED', 'Le mentor a déjà une séance sur cette plage horaire.');
      }
      if (isConstraintViolation(error, 'mentoring_sessions_mentee_no_overlap')) {
        throw conflict('MENTEE_TIME_CONFLICT', 'Vous avez déjà une séance qui chevauche ce créneau.');
      }
      throw error;
    }
  }

  listMine(user: AuthUser, query: ListSessionsQuery) {
    const now = new Date();
    const scope = query.scope ?? 'upcoming';
    const scopeFilter: Prisma.MentoringSessionWhereInput =
      scope === 'upcoming'
        ? { endsAt: { gt: now }, status: { in: ['REQUESTED', 'CONFIRMED'] } }
        : scope === 'past'
          ? { OR: [{ endsAt: { lte: now } }, { status: { in: ['CANCELLED', 'COMPLETED'] } }] }
          : {};
    return this.prisma.mentoringSession.findMany({
      where: { AND: [{ OR: [{ mentorId: user.id }, { menteeId: user.id }] }, scopeFilter] },
      include: sessionInclude,
      orderBy: { startsAt: scope === 'upcoming' ? 'asc' : 'desc' },
      take: 100,
    });
  }

  /** Confirmation par le mentor (REQUESTED → CONFIRMED). */
  async confirm(user: AuthUser, id: string, dto: ConfirmSessionDto) {
    const session = await this.load(id);
    if (session.mentorId !== user.id) {
      throw forbidden('NOT_SESSION_MENTOR', 'Seul le mentor de la séance peut la confirmer.');
    }
    if (session.status === 'CONFIRMED') return this.get(id);
    if (session.status !== 'REQUESTED') {
      throw conflict('INVALID_TRANSITION', `Cette séance est ${STATUS_LABELS[session.status]}.`);
    }
    const updated = await this.prisma.mentoringSession.updateMany({
      where: { id, status: 'REQUESTED' },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        meetingUrl: dto.meetingUrl ?? null,
        location: dto.location ?? null,
      },
    });
    if (updated.count === 0) throw conflict('INVALID_TRANSITION', 'Cette séance a déjà été traitée.');
    return this.get(id);
  }

  /** Annulation par l'un des deux participants ; le créneau redevient libre. */
  async cancel(user: AuthUser, id: string) {
    const session = await this.load(id);
    if (session.mentorId !== user.id && session.menteeId !== user.id) {
      throw forbidden('NOT_PARTICIPANT', 'Cette séance ne vous concerne pas.');
    }
    if (session.status === 'CANCELLED') return this.get(id);
    if (session.status === 'COMPLETED') {
      throw conflict('INVALID_TRANSITION', 'Une séance terminée ne peut pas être annulée.');
    }
    await this.prisma.mentoringSession.updateMany({
      where: { id, status: { in: ['REQUESTED', 'CONFIRMED'] } },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: user.id },
    });
    return this.get(id);
  }

  /** Clôture par le mentor d'une séance confirmée dont l'horaire a commencé. */
  async complete(user: AuthUser, id: string) {
    const session = await this.load(id);
    if (session.mentorId !== user.id) {
      throw forbidden('NOT_SESSION_MENTOR', 'Seul le mentor peut clôturer la séance.');
    }
    if (session.status === 'COMPLETED') return this.get(id);
    if (session.status !== 'CONFIRMED') {
      throw conflict('INVALID_TRANSITION', `Cette séance est ${STATUS_LABELS[session.status]}.`);
    }
    if (session.startsAt > new Date()) {
      throw conflict('SESSION_NOT_STARTED', 'Une séance ne peut être clôturée qu’après son début.');
    }
    await this.prisma.mentoringSession.update({ where: { id }, data: { status: 'COMPLETED' } });
    return this.get(id);
  }

  private async load(id: string) {
    const session = await this.prisma.mentoringSession.findUnique({
      where: { id },
      select: { id: true, mentorId: true, menteeId: true, status: true, startsAt: true },
    });
    if (!session) throw notFound('SESSION_NOT_FOUND', 'Séance introuvable.');
    return session;
  }

  private get(id: string) {
    return this.prisma.mentoringSession.findUniqueOrThrow({ where: { id }, include: sessionInclude });
  }
}
