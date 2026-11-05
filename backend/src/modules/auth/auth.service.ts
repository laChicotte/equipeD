import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { AppConfigService } from '../../config/app-config.service.js';
import { conflict, isConstraintViolation, unprocessable } from '../../common/errors.js';
import { generateSessionToken, hashSessionToken } from '../../common/auth/session-token.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { getDummyHash, hashPassword, verifyPassword } from './password.js';
import type { ChangePasswordDto, LoginDto, RegisterDto } from './auth.dto.js';

export interface IssuedSession {
  token: string;
  expiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  async register(dto: RegisterDto, userAgent?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (existing) throw conflict('EMAIL_TAKEN', 'Un compte existe déjà avec cette adresse email.');

    const passwordHash = await hashPassword(dto.password);
    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: dto.role,
        },
        select: { id: true },
      });
      return this.issueSession(user.id, userAgent);
    } catch (error) {
      if (isConstraintViolation(error)) {
        throw conflict('EMAIL_TAKEN', 'Un compte existe déjà avec cette adresse email.');
      }
      throw error;
    }
  }

  async login(dto: LoginDto, userAgent?: string): Promise<IssuedSession> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, passwordHash: true, status: true },
    });
    const valid = await verifyPassword(user?.passwordHash ?? (await getDummyHash()), dto.password);
    if (!user || !valid) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Email ou mot de passe incorrect.',
      });
    }
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException({
        code: 'ACCOUNT_SUSPENDED',
        message: 'Ce compte est suspendu. Contactez un administrateur.',
      });
    }
    return this.issueSession(user.id, userAgent);
  }

  /**
   * Changement de mot de passe : vérifie l'actuel, puis révoque toutes les AUTRES sessions
   * (un éventuel appareil compromis est déconnecté ; la session courante reste ouverte).
   */
  async changePassword(
    user: AuthUser,
    dto: ChangePasswordDto,
  ): Promise<{ revokedSessions: number }> {
    const current = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    if (!(await verifyPassword(current.passwordHash, dto.currentPassword))) {
      throw unprocessable('INVALID_CURRENT_PASSWORD', 'Le mot de passe actuel est incorrect.', [
        { field: 'currentPassword', messages: ['Le mot de passe actuel est incorrect.'] },
      ]);
    }
    if (dto.currentPassword === dto.newPassword) {
      throw unprocessable('PASSWORD_UNCHANGED', 'Le nouveau mot de passe doit être différent.', [
        { field: 'newPassword', messages: ['Choisissez un mot de passe différent de l’actuel.'] },
      ]);
    }
    const passwordHash = await hashPassword(dto.newPassword);
    const [, revoked] = await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      this.prisma.authSession.updateMany({
        where: { userId: user.id, revokedAt: null, id: { not: user.sessionId } },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { revokedSessions: revoked.count };
  }

  /** Déconnexion de tous les appareils, y compris la session courante. */
  async logoutAll(userId: string): Promise<number> {
    const result = await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Données de l'utilisateur courant, sans aucun champ sensible. */
  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUpdatedAt: true,
        role: true,
        timezone: true,
        onboardedAt: true,
        createdAt: true,
        mentorProfile: { select: { id: true } },
        menteeProfile: { select: { id: true } },
      },
    });
    const { mentorProfile, menteeProfile, ...rest } = user;
    return {
      ...rest,
      hasProfile: Boolean(mentorProfile ?? menteeProfile),
      mentorProfileId: mentorProfile?.id ?? null,
    };
  }

  private async issueSession(userId: string, userAgent?: string): Promise<IssuedSession> {
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + this.config.get('SESSION_TTL_HOURS') * 3_600_000);
    await this.prisma.authSession.create({
      data: {
        userId,
        tokenHash: hashSessionToken(token, this.config.get('SESSION_SECRET')),
        expiresAt,
        userAgent: userAgent?.slice(0, 255),
      },
    });
    return { token, expiresAt };
  }
}
