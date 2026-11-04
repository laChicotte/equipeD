import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../database/prisma.service.js';
import { CurrentUser } from '../../common/auth/decorators.js';
import type { AuthUser } from '../../common/auth/auth-user.js';

/** Indicateurs du tableau de bord : uniquement des comptages réels issus de la base. */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async forUser(user: AuthUser) {
    const now = new Date();
    const asMentor = user.role === 'MENTOR';
    const participant = asMentor ? { mentorId: user.id } : { menteeId: user.id };

    const [pendingRequests, activeMentorships, upcomingSessions, awaitingConfirmation, goals, unreadMessages] =
      await Promise.all([
        this.prisma.mentorshipRequest.count({ where: { ...participant, status: 'PENDING' } }),
        this.prisma.mentorship.count({ where: { ...participant, status: 'ACTIVE' } }),
        this.prisma.mentoringSession.findMany({
          where: { ...participant, status: { in: ['REQUESTED', 'CONFIRMED'] }, endsAt: { gt: now } },
          orderBy: { startsAt: 'asc' },
          take: 3,
          select: {
            id: true,
            startsAt: true,
            endsAt: true,
            status: true,
            topic: true,
            mentorshipId: true,
            meetingUrl: true,
            mentor: { select: { id: true, firstName: true, lastName: true } },
            mentee: { select: { id: true, firstName: true, lastName: true } },
          },
        }),
        this.prisma.mentoringSession.count({
          where: { ...participant, status: 'REQUESTED', endsAt: { gt: now } },
        }),
        this.prisma.goal.findMany({
          where: { mentorship: { ...participant, status: 'ACTIVE' } },
          select: { progress: true, status: true },
        }),
        this.prisma.message.count({
          where: {
            readAt: null,
            senderId: { not: user.id },
            mentorship: { OR: [{ mentorId: user.id }, { menteeId: user.id }] },
          },
        }),
      ]);

    const mentorExtras = asMentor
      ? await Promise.all([
          this.prisma.mentorProfile.findUnique({ where: { userId: user.id }, select: { maxMentees: true } }),
          this.prisma.availabilitySlot.count({
            where: {
              mentorId: user.id,
              isActive: true,
              startsAt: { gt: now },
              sessions: { none: { status: { in: ['REQUESTED', 'CONFIRMED'] } } },
            },
          }),
        ])
      : null;

    return {
      role: user.role,
      pendingRequests,
      activeMentorships,
      upcomingSessions,
      sessionsAwaitingConfirmation: awaitingConfirmation,
      unreadMessages,
      goals: {
        total: goals.length,
        completed: goals.filter((g) => g.status === 'COMPLETED').length,
        averageProgress: goals.length
          ? Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length)
          : null,
      },
      mentor: mentorExtras
        ? { maxMentees: mentorExtras[0]?.maxMentees ?? null, freeUpcomingSlots: mentorExtras[1] }
        : null,
    };
  }
}

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.dashboard.forUser(user);
  }
}

@Module({ controllers: [DashboardController], providers: [DashboardService] })
export class DashboardModule {}
