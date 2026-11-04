import { Body, Controller, Get, Injectable, Module, Param, Patch, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { PrismaService } from '../../database/prisma.service.js';
import { CurrentUser, Roles } from '../../common/auth/decorators.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { forbidden, notFound } from '../../common/errors.js';
import { Role, UserStatus, VerificationStatus } from '../../generated/prisma/enums.js';

export class AdminUsersQuery {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}

export class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  status!: UserStatus;
}

/**
 * Vérification manuelle par l'équipe (entretien, références…).
 * Aucune validation automatique de diplômes n'est effectuée.
 */
export class UpdateMentorModerationDto {
  @IsOptional()
  @IsEnum(VerificationStatus)
  verificationStatus?: VerificationStatus;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const [users, mentors, mentees, pendingVerification, requests, activeMentorships, sessions] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: 'MENTOR' } }),
      this.prisma.user.count({ where: { role: 'MENTEE' } }),
      this.prisma.mentorProfile.count({ where: { verificationStatus: { in: ['UNVERIFIED', 'PENDING'] } } }),
      this.prisma.mentorshipRequest.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.mentorship.count({ where: { status: 'ACTIVE' } }),
      this.prisma.mentoringSession.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    return {
      users,
      mentors,
      mentees,
      pendingVerification,
      activeMentorships,
      requestsByStatus: Object.fromEntries(requests.map((r) => [r.status, r._count._all])),
      sessionsByStatus: Object.fromEntries(sessions.map((s) => [s.status, s._count._all])),
    };
  }

  users(query: AdminUsersQuery) {
    return this.prisma.user.findMany({
      where: query.role ? { role: query.role } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
        onboardedAt: true,
        mentorProfile: {
          select: { headline: true, verificationStatus: true, isPublished: true, city: true },
        },
      },
    });
  }

  async updateStatus(admin: AuthUser, userId: string, dto: UpdateUserStatusDto) {
    if (userId === admin.id) throw forbidden('SELF_MODERATION', 'Vous ne pouvez pas modifier votre propre statut.');
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw notFound('USER_NOT_FOUND', 'Utilisateur introuvable.');
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: userId },
        data: { status: dto.status },
        select: { id: true, status: true },
      });
      // La suspension révoque immédiatement toutes les sessions actives.
      if (dto.status === 'SUSPENDED') {
        await tx.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      return u;
    });
    return updated;
  }

  async moderateMentor(userId: string, dto: UpdateMentorModerationDto) {
    const profile = await this.prisma.mentorProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!profile) throw notFound('MENTOR_NOT_FOUND', 'Profil mentor introuvable.');
    return this.prisma.mentorProfile.update({
      where: { userId },
      data: { verificationStatus: dto.verificationStatus, isPublished: dto.isPublished },
      select: { userId: true, verificationStatus: true, isPublished: true },
    });
  }
}

@ApiTags('admin')
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('users')
  users(@Query() q: AdminUsersQuery) {
    return this.admin.users(q);
  }

  @Patch('users/:id/status')
  updateStatus(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: UpdateUserStatusDto) {
    return this.admin.updateStatus(admin, id, dto);
  }

  @Patch('mentors/:id')
  moderateMentor(@Param('id') id: string, @Body() dto: UpdateMentorModerationDto) {
    return this.admin.moderateMentor(id, dto);
  }
}

@Module({ controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}
