import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { AppConfigService } from '../../config/app-config.service.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import {
  conflict,
  forbidden,
  isConstraintViolation,
  notFound,
  unprocessable,
} from '../../common/errors.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { NotificationsService } from '../notifications/notifications.module.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import type {
  CreateWorkshopDto,
  ListWorkshopsQuery,
  WorkshopAttendanceDto,
} from './workshops.dto.js';

const MIN_MS = 60_000;
const MAX_DAYS_AHEAD = 120;

const workshopSelect = {
  id: true,
  groupId: true,
  title: true,
  description: true,
  startsAt: true,
  endsAt: true,
  modality: true,
  meetingUrl: true,
  location: true,
  cancelledAt: true,
  createdAt: true,
  group: { select: { id: true, name: true, ownerId: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true, avatarUpdatedAt: true } },
  attendances: { select: { userId: true, response: true } },
} satisfies Prisma.GroupWorkshopSelect;

type WorkshopRow = Prisma.GroupWorkshopGetPayload<{ select: typeof workshopSelect }>;

function formatWhen(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Africa/Conakry',
  }).format(date);
}

/**
 * Ateliers thématiques (TDR, étape 4 : « sessions de mentorat et ateliers thématiques »).
 *
 * Règles :
 *  - seul le mentor responsable d'un groupe planifie ou annule un atelier ;
 *  - tous les membres le voient et indiquent s'ils participent ;
 *  - un mentor n'anime jamais deux ateliers qui se chevauchent (contrainte d'exclusion SQL),
 *    ni un atelier pendant une de ses séances individuelles actives (vérifié ici) ;
 *  - à distance ou en hybride sans lien fourni, une salle de visio externe est générée,
 *    comme pour les séances individuelles.
 */
@Injectable()
export class WorkshopsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
  ) {}

  private present(w: WorkshopRow, userId: string) {
    const { attendances, group, ...rest } = w;
    const now = Date.now();
    return {
      ...rest,
      group: { id: group.id, name: group.name },
      isOwner: group.ownerId === userId,
      status: w.cancelledAt
        ? ('CANCELLED' as const)
        : w.endsAt.getTime() <= now
          ? ('PAST' as const)
          : ('UPCOMING' as const),
      goingCount: attendances.filter((a) => a.response === 'GOING').length,
      notGoingCount: attendances.filter((a) => a.response === 'NOT_GOING').length,
      myResponse: attendances.find((a) => a.userId === userId)?.response ?? null,
    };
  }

  private async membership(user: AuthUser, groupId: string) {
    const member = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: user.id } },
      select: { group: { select: { id: true, name: true, ownerId: true } } },
    });
    if (!member) throw notFound('GROUP_NOT_FOUND', 'Groupe introuvable.');
    return { ...member.group, isOwner: member.group.ownerId === user.id };
  }

  /** Atelier visible : membre actuel du groupe uniquement (404 sinon). */
  private async loadForMember(user: AuthUser, workshopId: string) {
    const w = await this.prisma.groupWorkshop.findUnique({
      where: { id: workshopId },
      select: workshopSelect,
    });
    const missing = notFound('WORKSHOP_NOT_FOUND', 'Atelier introuvable.');
    if (!w) throw missing;
    const member = await this.prisma.groupMember.count({
      where: { groupId: w.groupId, userId: user.id },
    });
    if (!member) throw missing;
    return w;
  }

  private scopeFilter(scope: ListWorkshopsQuery['scope']): Prisma.GroupWorkshopWhereInput {
    const now = new Date();
    if (scope === 'past') return { OR: [{ endsAt: { lte: now } }, { cancelledAt: { not: null } }] };
    if (scope === 'all') return {};
    return { endsAt: { gt: now }, cancelledAt: null };
  }

  async listForGroup(user: AuthUser, groupId: string, q: ListWorkshopsQuery) {
    await this.membership(user, groupId);
    const scope = q.scope ?? 'upcoming';
    const rows = await this.prisma.groupWorkshop.findMany({
      where: { groupId, ...this.scopeFilter(scope) },
      orderBy: { startsAt: scope === 'upcoming' ? 'asc' : 'desc' },
      take: 100,
      select: workshopSelect,
    });
    return rows.map((w) => this.present(w, user.id));
  }

  /** Ateliers de tous les groupes de l'utilisateur (page « Séances », tableau de bord). */
  async listMine(user: AuthUser, q: ListWorkshopsQuery) {
    const scope = q.scope ?? 'upcoming';
    const rows = await this.prisma.groupWorkshop.findMany({
      where: { group: { members: { some: { userId: user.id } } }, ...this.scopeFilter(scope) },
      orderBy: { startsAt: scope === 'upcoming' ? 'asc' : 'desc' },
      take: 100,
      select: workshopSelect,
    });
    return rows.map((w) => this.present(w, user.id));
  }

  async create(user: AuthUser, groupId: string, dto: CreateWorkshopDto) {
    const group = await this.membership(user, groupId);
    if (!group.isOwner) {
      throw forbidden(
        'NOT_GROUP_OWNER',
        'Seul le mentor responsable du groupe planifie un atelier.',
      );
    }
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    const field = (name: string, message: string) =>
      unprocessable('INVALID_WORKSHOP_TIME', message, [{ field: name, messages: [message] }]);
    if (startsAt.getTime() <= Date.now()) {
      throw field('startsAt', 'L’atelier doit commencer dans le futur.');
    }
    const duration = endsAt.getTime() - startsAt.getTime();
    if (duration < 15 * MIN_MS || duration > 240 * MIN_MS) {
      throw field('endsAt', 'Un atelier dure entre 15 minutes et 4 heures.');
    }
    if (startsAt.getTime() > Date.now() + MAX_DAYS_AHEAD * 86_400_000) {
      throw field('startsAt', `Un atelier se planifie au plus ${MAX_DAYS_AHEAD} jours à l’avance.`);
    }

    const sessionClash = await this.prisma.mentoringSession.count({
      where: {
        mentorId: user.id,
        status: { in: ['REQUESTED', 'CONFIRMED'] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });
    if (sessionClash > 0) {
      throw conflict(
        'WORKSHOP_OVERLAP',
        'Vous avez déjà une séance individuelle sur cette plage horaire.',
      );
    }

    const modality = dto.modality ?? 'REMOTE';
    const base = this.config.get('MEETING_BASE_URL');
    const meetingUrl =
      dto.meetingUrl ??
      (base && modality !== 'IN_PERSON'
        ? `${base}/TalentsConnectes-Atelier-${randomBytes(12).toString('base64url')}`
        : null);

    let created: WorkshopRow;
    try {
      created = await this.prisma.groupWorkshop.create({
        data: {
          groupId,
          createdById: user.id,
          title: dto.title,
          description: dto.description ?? null,
          startsAt,
          endsAt,
          modality,
          meetingUrl,
          location: dto.location ?? null,
          // L'animateur participe d'office.
          attendances: { create: { userId: user.id, response: 'GOING' } },
        },
        select: workshopSelect,
      });
    } catch (error) {
      if (isConstraintViolation(error, 'group_workshops_creator_no_overlap')) {
        throw conflict('WORKSHOP_OVERLAP', 'Vous animez déjà un atelier sur cette plage horaire.');
      }
      throw error;
    }

    const others = await this.otherMembers(groupId, user.id);
    await Promise.all(
      others.map((userId) =>
        this.notifications.notify({
          userId,
          type: 'WORKSHOP_SCHEDULED',
          title: `Nouvel atelier dans « ${group.name} » : ${dto.title}`,
          body: `${formatWhen(startsAt)}. Indiquez si vous participez.`,
          link: `/seances?atelier=${created.id}`,
        }),
      ),
    );
    this.realtime.emitToUsers(others, 'group:workshop', { groupId });
    return this.present(created, user.id);
  }

  async cancel(user: AuthUser, workshopId: string) {
    const w = await this.loadForMember(user, workshopId);
    if (w.group.ownerId !== user.id) {
      throw forbidden('NOT_GROUP_OWNER', 'Seul le mentor responsable du groupe annule un atelier.');
    }
    if (w.cancelledAt) return this.present(w, user.id);
    if (w.endsAt.getTime() <= Date.now()) {
      throw conflict('WORKSHOP_ENDED', 'Cet atelier est déjà terminé.');
    }
    const updated = await this.prisma.groupWorkshop.update({
      where: { id: workshopId },
      data: { cancelledAt: new Date() },
      select: workshopSelect,
    });
    const others = await this.otherMembers(w.groupId, user.id);
    await Promise.all(
      others.map((userId) =>
        this.notifications.notify({
          userId,
          type: 'WORKSHOP_CANCELLED',
          title: `Atelier annulé : ${w.title}`,
          body: formatWhen(w.startsAt),
          link: `/messages?g=${w.groupId}`,
        }),
      ),
    );
    this.realtime.emitToUsers(others, 'group:workshop', { groupId: w.groupId });
    return this.present(updated, user.id);
  }

  /** « Je participe » ou « Je ne participe pas » : modifiable jusqu'à la fin de l'atelier. */
  async respond(user: AuthUser, workshopId: string, dto: WorkshopAttendanceDto) {
    const w = await this.loadForMember(user, workshopId);
    if (w.cancelledAt) throw conflict('WORKSHOP_CANCELLED', 'Cet atelier a été annulé.');
    if (w.endsAt.getTime() <= Date.now()) {
      throw conflict('WORKSHOP_ENDED', 'Cet atelier est déjà terminé.');
    }
    if (w.group.ownerId === user.id && !dto.going) {
      throw conflict(
        'WORKSHOP_HOST_REQUIRED',
        'Vous animez cet atelier : annulez-le plutôt que de vous désinscrire.',
      );
    }
    const response = dto.going ? 'GOING' : 'NOT_GOING';
    await this.prisma.workshopAttendance.upsert({
      where: { workshopId_userId: { workshopId, userId: user.id } },
      create: { workshopId, userId: user.id, response },
      update: { response, respondedAt: new Date() },
    });
    const fresh = await this.prisma.groupWorkshop.findUniqueOrThrow({
      where: { id: workshopId },
      select: workshopSelect,
    });
    return this.present(fresh, user.id);
  }

  private async otherMembers(groupId: string, exceptId: string) {
    const members = await this.prisma.groupMember.findMany({
      where: { groupId, userId: { not: exceptId } },
      select: { userId: true },
    });
    return members.map((m) => m.userId);
  }
}
