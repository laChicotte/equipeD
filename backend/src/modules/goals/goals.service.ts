import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { forbidden, notFound } from '../../common/errors.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { GoalStatus } from '../../generated/prisma/enums.js';
import { MentorshipAccessService } from '../mentorships/mentorship-access.service.js';
import { NotificationsService } from '../notifications/notifications.module.js';
import type {
  CreateGoalDto,
  CreateMilestoneDto,
  UpdateGoalDto,
  UpdateMilestoneDto,
} from './goals.dto.js';

const goalInclude = {
  milestones: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.GoalInclude;

/** Statut déduit de la progression. */
export function statusFromProgress(progress: number): GoalStatus {
  if (progress >= 100) return 'COMPLETED';
  if (progress <= 0) return 'NOT_STARTED';
  return 'IN_PROGRESS';
}

/**
 * Permissions :
 *  - les deux participants d'un mentorat actif créent et font avancer les objectifs et jalons ;
 *  - seul le mentor rédige le retour (mentorFeedback) ;
 *  - seul l'auteur d'un objectif peut le supprimer.
 */
@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: MentorshipAccessService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(user: AuthUser, mentorshipId: string) {
    await this.access.assertParticipant(user, mentorshipId);
    return this.prisma.goal.findMany({
      where: { mentorshipId },
      include: goalInclude,
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(user: AuthUser, mentorshipId: string, dto: CreateGoalDto) {
    await this.access.assertActiveParticipant(user, mentorshipId);
    return this.prisma.goal.create({
      data: {
        mentorshipId,
        createdById: user.id,
        title: dto.title,
        description: dto.description || null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        milestones: dto.milestones?.length
          ? {
              create: dto.milestones.map((title, sortOrder) => ({
                title: title.trim(),
                sortOrder,
              })),
            }
          : undefined,
      },
      include: goalInclude,
    });
  }

  async update(user: AuthUser, goalId: string, dto: UpdateGoalDto) {
    const goal = await this.loadWritable(user, goalId);
    if (dto.mentorFeedback !== undefined && !goal.isMentor) {
      throw forbidden('MENTOR_ONLY', 'Seul le mentor peut rédiger un retour sur cet objectif.');
    }

    let progress = dto.progress;
    let status = dto.status;
    if (status === 'COMPLETED' && progress === undefined) progress = 100;
    if (status === 'NOT_STARTED' && progress === undefined) progress = 0;
    if (progress !== undefined && status === undefined) status = statusFromProgress(progress);

    const updated = await this.prisma.goal.update({
      where: { id: goalId },
      data: {
        title: dto.title,
        description: dto.description,
        dueDate: dto.dueDate === null ? null : dto.dueDate ? new Date(dto.dueDate) : undefined,
        mentorFeedback: dto.mentorFeedback,
        progress,
        status,
        completedAt: status === undefined ? undefined : status === 'COMPLETED' ? new Date() : null,
      },
      include: goalInclude,
    });
    if (dto.mentorFeedback) {
      await this.notifications.notify({
        userId: goal.counterpartId,
        type: 'GOAL_FEEDBACK',
        title: `${user.firstName} ${user.lastName} a commenté votre objectif`,
        body: `« ${updated.title} »`,
        link: `/mentorats/${goal.mentorshipId}`,
      });
    }
    return updated;
  }

  async remove(user: AuthUser, goalId: string) {
    const goal = await this.loadWritable(user, goalId);
    if (goal.createdById !== user.id) {
      throw forbidden('NOT_GOAL_AUTHOR', 'Seul l’auteur de l’objectif peut le supprimer.');
    }
    await this.prisma.goal.delete({ where: { id: goalId } });
    return { ok: true };
  }

  async addMilestone(user: AuthUser, goalId: string, dto: CreateMilestoneDto) {
    await this.loadWritable(user, goalId);
    const last = await this.prisma.milestone.findFirst({
      where: { goalId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    await this.prisma.milestone.create({
      data: { goalId, title: dto.title, sortOrder: (last?.sortOrder ?? -1) + 1 },
    });
    return this.recompute(goalId);
  }

  async updateMilestone(user: AuthUser, milestoneId: string, dto: UpdateMilestoneDto) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      select: { goalId: true },
    });
    if (!milestone) throw notFound('MILESTONE_NOT_FOUND', 'Jalon introuvable.');
    await this.loadWritable(user, milestone.goalId);
    await this.prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        title: dto.title,
        isDone: dto.isDone,
        doneAt: dto.isDone === undefined ? undefined : dto.isDone ? new Date() : null,
      },
    });
    return this.recompute(milestone.goalId);
  }

  async removeMilestone(user: AuthUser, milestoneId: string) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      select: { goalId: true },
    });
    if (!milestone) throw notFound('MILESTONE_NOT_FOUND', 'Jalon introuvable.');
    await this.loadWritable(user, milestone.goalId);
    await this.prisma.milestone.delete({ where: { id: milestoneId } });
    return this.recompute(milestone.goalId);
  }

  /** Avec des jalons, la progression est calculée : part des jalons atteints. */
  private async recompute(goalId: string) {
    const milestones = await this.prisma.milestone.findMany({
      where: { goalId },
      select: { isDone: true },
    });
    if (milestones.length === 0) {
      return this.prisma.goal.findUniqueOrThrow({ where: { id: goalId }, include: goalInclude });
    }
    const progress = Math.round(
      (milestones.filter((m) => m.isDone).length / milestones.length) * 100,
    );
    const status = statusFromProgress(progress);
    return this.prisma.goal.update({
      where: { id: goalId },
      data: { progress, status, completedAt: status === 'COMPLETED' ? new Date() : null },
      include: goalInclude,
    });
  }

  private async loadWritable(user: AuthUser, goalId: string) {
    const goal = await this.prisma.goal.findUnique({
      where: { id: goalId },
      select: { id: true, mentorshipId: true, createdById: true },
    });
    if (!goal) throw notFound('GOAL_NOT_FOUND', 'Objectif introuvable.');
    const access = await this.access.assertActiveParticipant(user, goal.mentorshipId);
    return { ...goal, isMentor: access.isMentor, counterpartId: access.counterpartId };
  }
}
