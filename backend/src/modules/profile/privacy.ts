import { randomBytes } from 'node:crypto';
import { Body, Controller, Delete, Get, HttpCode, Injectable, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Equals, IsString, Length } from 'class-validator';
import type { Response } from 'express';
import { PrismaService } from '../../database/prisma.service.js';
import { AppConfigService } from '../../config/app-config.service.js';
import { CurrentUser } from '../../common/auth/decorators.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { forbidden, unprocessable } from '../../common/errors.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { NotificationsService } from '../notifications/notifications.module.js';

export class DeleteAccountDto {
  @IsString()
  @Length(1, 128, { message: 'Le mot de passe est obligatoire.' })
  password!: string;

  /** Confirmation explicite : saisir exactement « SUPPRIMER ». */
  @Equals('SUPPRIMER', { message: 'Saisissez SUPPRIMER pour confirmer.' })
  confirmation!: string;
}

const ACCOUNT_DELETED_NOTE = 'Compte supprimé par son titulaire.';

/**
 * Droits de la personne sur ses données (sans prétendre à une conformité juridique complète) :
 *  - export : toutes les données dont elle est l'auteur ou le sujet, au format JSON ;
 *  - suppression : anonymisation irréversible du compte. Les messages déjà échangés restent
 *    visibles de l'autre participant, attribués à « Compte supprimé », pour préserver son historique.
 */
@Injectable()
export class PrivacyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async export(user: AuthUser) {
    const id = user.id;
    const [
      account,
      sent,
      received,
      mentorships,
      sessions,
      messages,
      goals,
      feedbacks,
      resources,
      opportunities,
      notifications,
    ] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          timezone: true,
          onboardedAt: true,
          createdAt: true,
          mentorProfile: {
            include: { domains: { select: { domain: { select: { name: true } } } } },
          },
          menteeProfile: {
            include: { interests: { select: { domain: { select: { name: true } } } } },
          },
          sessions: {
            select: {
              createdAt: true,
              lastUsedAt: true,
              expiresAt: true,
              revokedAt: true,
              userAgent: true,
            },
          },
        },
      }),
      this.prisma.mentorshipRequest.findMany({ where: { menteeId: id } }),
      this.prisma.mentorshipRequest.findMany({ where: { mentorId: id } }),
      this.prisma.mentorship.findMany({ where: { OR: [{ mentorId: id }, { menteeId: id }] } }),
      this.prisma.mentoringSession.findMany({
        where: { OR: [{ mentorId: id }, { menteeId: id }] },
      }),
      this.prisma.message.findMany({
        where: { senderId: id },
        select: { mentorshipId: true, content: true, createdAt: true },
      }),
      this.prisma.goal.findMany({ where: { createdById: id }, include: { milestones: true } }),
      this.prisma.sessionFeedback.findMany({ where: { authorId: id } }),
      this.prisma.resource.findMany({ where: { authorId: id } }),
      this.prisma.opportunity.findMany({ where: { authorId: id } }),
      this.prisma.notification.findMany({ where: { userId: id } }),
    ]);
    const { sessions: authSessions, mentorProfile, ...rest } = account;
    const { searchText: _searchText, ...publicMentorProfile } = mentorProfile ?? { searchText: '' };
    return {
      exportedAt: new Date().toISOString(),
      notice:
        'Export des données vous concernant. Les messages des autres participants ne sont pas inclus.',
      account: { ...rest, mentorProfile: mentorProfile ? publicMentorProfile : null },
      loginSessions: authSessions,
      mentorshipRequests: { sent, received },
      mentorships,
      sessions,
      messagesSent: messages,
      goalsCreated: goals,
      sessionFeedbacks: feedbacks,
      resources,
      opportunities,
      notifications,
    };
  }

  async deleteAccount(user: AuthUser, dto: DeleteAccountDto) {
    if (user.role === 'ADMIN') {
      throw forbidden(
        'ADMIN_CANNOT_SELF_DELETE',
        'Un compte administrateur doit être retiré par un autre administrateur.',
      );
    }
    const current = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    if (!(await verifyPassword(current.passwordHash, dto.password))) {
      throw unprocessable('INVALID_PASSWORD', 'Mot de passe incorrect.', [
        { field: 'password', messages: ['Mot de passe incorrect.'] },
      ]);
    }

    const id = user.id;
    const now = new Date();
    // Mot de passe aléatoire jamais communiqué : le compte devient inutilisable.
    const unusableHash = await hashPassword(randomBytes(32).toString('base64url'));

    const counterparts = await this.prisma.$transaction(async (tx) => {
      const active = await tx.mentorship.findMany({
        where: { status: 'ACTIVE', OR: [{ mentorId: id }, { menteeId: id }] },
        select: { id: true, mentorId: true, menteeId: true },
      });
      await tx.mentorship.updateMany({
        where: { id: { in: active.map((m) => m.id) } },
        data: { status: 'COMPLETED', endedAt: now, endedById: id, endNote: ACCOUNT_DELETED_NOTE },
      });
      await tx.mentoringSession.updateMany({
        where: {
          status: { in: ['REQUESTED', 'CONFIRMED'] },
          startsAt: { gt: now },
          OR: [{ mentorId: id }, { menteeId: id }],
        },
        data: { status: 'CANCELLED', cancelledAt: now, cancelledBy: id },
      });
      await tx.mentorshipRequest.updateMany({
        where: { menteeId: id, status: 'PENDING' },
        data: { status: 'CANCELLED', respondedAt: now },
      });
      await tx.mentorshipRequest.updateMany({
        where: { mentorId: id, status: 'PENDING' },
        data: { status: 'DECLINED', respondedAt: now, decisionNote: ACCOUNT_DELETED_NOTE },
      });
      await tx.availabilitySlot.updateMany({ where: { mentorId: id }, data: { isActive: false } });
      // Contenus publics rattachés à la personne : retirés.
      await tx.resource.deleteMany({ where: { authorId: id, mentorshipId: null } });
      await tx.opportunity.deleteMany({ where: { authorId: id } });
      // Données personnelles : profils, notifications, sessions de connexion.
      await tx.mentorProfile.deleteMany({ where: { userId: id } });
      await tx.menteeProfile.deleteMany({ where: { userId: id } });
      await tx.notification.deleteMany({ where: { userId: id } });
      await tx.authSession.deleteMany({ where: { userId: id } });
      await tx.user.update({
        where: { id },
        data: {
          email: `deleted-${id}@deleted.invalid`,
          firstName: 'Compte',
          lastName: 'supprimé',
          passwordHash: unusableHash,
          status: 'DELETED',
          onboardedAt: null,
        },
      });
      return active.map((m) => ({
        mentorshipId: m.id,
        userId: m.mentorId === id ? m.menteeId : m.mentorId,
      }));
    });

    for (const c of counterparts) {
      await this.notifications.notify({
        userId: c.userId,
        type: 'MENTORSHIP_COMPLETED',
        title: 'Un mentorat a pris fin',
        body: 'L’autre participant a supprimé son compte. L’historique reste consultable.',
        link: `/mentorats/${c.mentorshipId}`,
      });
    }
    return { ok: true, closedMentorships: counterparts.length };
  }
}

@ApiTags('profile')
@Controller('profile/me')
export class PrivacyController {
  constructor(
    private readonly privacy: PrivacyService,
    private readonly config: AppConfigService,
  ) {}

  /** Export JSON de toutes les données de l'utilisateur connecté. */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Get('export')
  async export(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="talents-connectes-mes-donnees.json"',
    );
    res.setHeader('Cache-Control', 'no-store');
    return this.privacy.export(user);
  }

  /** Suppression définitive du compte (anonymisation). Mot de passe et « SUPPRIMER » requis. */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Delete()
  async delete(
    @CurrentUser() user: AuthUser,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.privacy.deleteAccount(user, dto);
    res.clearCookie(this.config.get('SESSION_COOKIE_NAME'), {
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: 'lax',
      path: '/',
    });
    return result;
  }
}
