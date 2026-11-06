import { Body, Controller, HttpCode, Injectable, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsString, Length } from 'class-validator';
import { CurrentUser, Public } from '../../common/auth/decorators.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { generateSessionToken, hashSessionToken } from '../../common/auth/session-token.js';
import { forbidden, notFound } from '../../common/errors.js';
import { AppConfigService } from '../../config/app-config.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { MailService } from '../mail/mail.module.js';

/** Un lien de confirmation reste valable 48 heures. */
export const EMAIL_VERIFICATION_TTL_MS = 48 * 3_600_000;

export class VerifyEmailDto {
  @IsString()
  @Length(20, 100, { message: 'Lien de confirmation invalide.' })
  token!: string;
}

/**
 * Exige une adresse confirmée pour les actions qui engagent la personne (demande de mentorat,
 * publication). Sans envoi d'emails configuré, aucune confirmation n'est possible : rien n'est exigé.
 */
export async function assertEmailVerified(
  prisma: PrismaService,
  mail: MailService,
  userId: string,
): Promise<void> {
  if (!mail.enabled) return;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerifiedAt: true },
  });
  if (!user?.emailVerifiedAt) {
    throw forbidden(
      'EMAIL_NOT_VERIFIED',
      'Confirmez d’abord votre adresse email : cliquez sur le lien que nous vous avons envoyé (vous pouvez le renvoyer depuis le bandeau en haut de la page).',
    );
  }
}

@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly mail: MailService,
  ) {}

  private hash(token: string) {
    return hashSessionToken(token, this.config.get('SESSION_SECRET'));
  }

  /** Envoie (ou renvoie) le lien de confirmation ; les liens précédents sont invalidés. */
  async send(userId: string): Promise<boolean> {
    if (!this.mail.enabled) return false;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, emailVerifiedAt: true, status: true },
    });
    if (!user || user.emailVerifiedAt || user.status !== 'ACTIVE') return false;
    const token = generateSessionToken();
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.updateMany({
        where: { userId, usedAt: null, expiresAt: { gt: now } },
        data: { expiresAt: now },
      }),
      this.prisma.emailVerificationToken.create({
        data: {
          userId,
          tokenHash: this.hash(token),
          expiresAt: new Date(now.getTime() + EMAIL_VERIFICATION_TTL_MS),
        },
      }),
    ]);
    return this.mail.send({
      to: user.email,
      subject: 'Confirmez votre adresse email · TalentsConnect',
      heading: `Bienvenue sur TalentsConnect, ${user.firstName}`,
      paragraphs: [
        'Pour finaliser votre inscription, confirmez votre adresse email. Vous pourrez ensuite envoyer des demandes de mentorat et partager des ressources.',
        'Ce lien est valable 48 heures.',
      ],
      action: {
        label: 'Confirmer mon adresse',
        url: this.mail.link(`/verifier-email?jeton=${encodeURIComponent(token)}`),
      },
      footnote: 'Vous n’avez pas créé de compte ? Ignorez simplement cet email.',
    });
  }

  /** Renvoi demandé par la personne connectée (limité : 3 envois par heure). */
  async resend(user: AuthUser) {
    const recent = await this.prisma.emailVerificationToken.count({
      where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 3_600_000) } },
    });
    if (recent >= 3) {
      return { sent: false, reason: 'TOO_MANY' as const };
    }
    return { sent: await this.send(user.id) };
  }

  async verify(token: string) {
    const now = new Date();
    const row = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: this.hash(token) },
      select: {
        id: true,
        userId: true,
        usedAt: true,
        expiresAt: true,
        user: { select: { email: true, emailVerifiedAt: true } },
      },
    });
    if (!row || row.expiresAt <= now) {
      throw notFound(
        'VERIFY_LINK_INVALID',
        'Ce lien de confirmation est invalide ou expiré. Connectez-vous pour en recevoir un nouveau.',
      );
    }
    // Lien déjà utilisé : l'adresse est confirmée, ce n'est pas une erreur pour la personne.
    if (!row.usedAt) {
      await this.prisma.$transaction([
        this.prisma.emailVerificationToken.update({ where: { id: row.id }, data: { usedAt: now } }),
        this.prisma.user.update({
          where: { id: row.userId },
          data: { emailVerifiedAt: row.user.emailVerifiedAt ?? now },
        }),
      ]);
    }
    return { verified: true, email: row.user.email };
  }
}

@ApiTags('auth')
@Controller('auth/email')
export class EmailVerificationController {
  constructor(private readonly verification: EmailVerificationService) {}

  /** Confirmation par le lien reçu (POST : le jeton n'apparaît pas dans les journaux d'URL). */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('verify')
  verify(@Body() dto: VerifyEmailDto) {
    return this.verification.verify(dto.token);
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(200)
  @Post('resend')
  resend(@CurrentUser() user: AuthUser) {
    return this.verification.resend(user);
  }
}
