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
import type { CreateSlotDto } from './scheduling.dto.js';

const MIN_DURATION_MIN = 15;
const MAX_DURATION_MIN = 240;
const MAX_HORIZON_DAYS = 120;

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /** Créneaux du mentor connecté, avec la séance éventuellement réservée dessus. */
  listMine(user: AuthUser) {
    return this.prisma.availabilitySlot.findMany({
      where: { mentorId: user.id, isActive: true, endsAt: { gt: new Date() } },
      orderBy: { startsAt: 'asc' },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        timezone: true,
        sessions: {
          where: { status: { in: ['REQUESTED', 'CONFIRMED'] } },
          select: {
            id: true,
            status: true,
            topic: true,
            mentee: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  async create(user: AuthUser, dto: CreateSlotDto) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    const now = new Date();
    const durationMin = (endsAt.getTime() - startsAt.getTime()) / 60_000;

    if (startsAt <= now)
      throw unprocessable('SLOT_IN_PAST', 'Le créneau doit commencer dans le futur.');
    if (durationMin < MIN_DURATION_MIN || durationMin > MAX_DURATION_MIN) {
      throw unprocessable(
        'SLOT_INVALID_DURATION',
        `La durée d’un créneau doit être comprise entre ${MIN_DURATION_MIN} minutes et ${MAX_DURATION_MIN / 60} heures.`,
      );
    }
    if (startsAt.getTime() - now.getTime() > MAX_HORIZON_DAYS * 86_400_000) {
      throw unprocessable(
        'SLOT_TOO_FAR',
        `Les créneaux sont limités aux ${MAX_HORIZON_DAYS} prochains jours.`,
      );
    }

    try {
      // Contrainte d'exclusion availability_slots_no_overlap : aucun chevauchement possible, même en concurrence.
      return await this.prisma.availabilitySlot.create({
        data: { mentorId: user.id, startsAt, endsAt, timezone: dto.timezone ?? 'Africa/Conakry' },
        select: { id: true, startsAt: true, endsAt: true, timezone: true },
      });
    } catch (error) {
      if (isConstraintViolation(error, 'availability_slots_no_overlap')) {
        throw conflict('SLOT_OVERLAP', 'Ce créneau chevauche une disponibilité existante.');
      }
      throw error;
    }
  }

  /** Retire un créneau libre. Un créneau réservé doit d'abord voir sa séance annulée. */
  async remove(user: AuthUser, id: string) {
    const slot = await this.prisma.availabilitySlot.findUnique({
      where: { id },
      select: {
        mentorId: true,
        isActive: true,
        _count: { select: { sessions: { where: { status: { in: ['REQUESTED', 'CONFIRMED'] } } } } },
      },
    });
    if (!slot || !slot.isActive) throw notFound('SLOT_NOT_FOUND', 'Créneau introuvable.');
    if (slot.mentorId !== user.id)
      throw forbidden('NOT_SLOT_OWNER', 'Ce créneau ne vous appartient pas.');
    if (slot._count.sessions > 0) {
      throw conflict(
        'SLOT_BOOKED',
        'Ce créneau est réservé : annulez d’abord la séance correspondante.',
      );
    }
    await this.prisma.availabilitySlot.update({ where: { id }, data: { isActive: false } });
    return { ok: true };
  }
}
