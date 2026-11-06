import { Body, Controller, HttpCode, Injectable, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';
import { recordAudit } from '../../common/audit.js';
import { CurrentUser, Public, Roles } from '../../common/auth/decorators.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { generateSessionToken, hashSessionToken } from '../../common/auth/session-token.js';
import { conflict, forbidden, notFound } from '../../common/errors.js';
import { AppConfigService } from '../../config/app-config.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { MailService } from '../mail/mail.module.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { hashPassword } from './password.js';

/** Durée de validité d'un lien : assez pour le remettre en main propre, pas davantage. */
export const PASSWORD_RESET_TTL_MS = 2 * 3_600_000;

export class ResetPasswordDto {
  @IsString()
  @Length(20, 100, { message: 'Lien de réinitialisation invalide.' })
  token!: string;

  /** Au moins 10 caractères, dont une lettre et un chiffre. */
  @IsString()
  @Length(10, 128, { message: 'Le mot de passe doit contenir entre 10 et 128 caractères.' })
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'Le mot de passe doit contenir au moins une lettre et un chiffre.',
  })
  newPassword!: string;
}

export class RequestResetDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Adresse email invalide.' })
  @MaxLength(254)
  email!: string;
}

export class CheckResetTokenDto {
  @IsString()
  @Length(20, 100, { message: 'Lien de réinitialisation invalide.' })
  token!: string;
}

const invalidLink = () =>
  notFound(
    'RESET_LINK_INVALID',
    'Ce lien de réinitialisation est invalide, expiré ou déjà utilisé. Demandez-en un nouveau depuis « Mot de passe oublié ».',
  );

/**
 * Réinitialisation du mot de passe par lien personnel, à usage unique et valable 2 heures :
 * envoyé par email à la demande de la personne (« Mot de passe oublié »), ou généré par un
 * membre de l'équipe qui le remet en main propre (personne sans accès à sa boîte mail).
 * Seul le hash HMAC du jeton est stocké ; générer un nouveau lien invalide les précédents ;
 * l'utilisation du lien révoque toutes les sessions ouvertes du compte. Chaque lien émis est
 * inscrit au journal d'audit.
 */
@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly realtime: RealtimeService,
    private readonly mail: MailService,
  ) {}

  private hash(token: string) {
    return hashSessionToken(token, this.config.get('SESSION_SECRET'));
  }

  async issue(actor: AuthUser, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true, firstName: true, lastName: true },
    });
    if (!user || user.status === 'DELETED') {
      throw notFound('USER_NOT_FOUND', 'Utilisateur introuvable.');
    }
    if (user.id === actor.id) {
      throw forbidden(
        'SELF_RESET',
        'Pour votre propre compte, changez votre mot de passe depuis « Mon compte ».',
      );
    }
    // Un administrateur ne génère pas de lien pour un autre : il pourrait prendre son compte.
    if (user.role === 'ADMIN') {
      throw forbidden(
        'STAFF_PROTECTED',
        'Un administrateur change son mot de passe depuis « Mon compte » ; un lien de réinitialisation ne peut pas être généré pour lui.',
      );
    }
    if (user.status !== 'ACTIVE') {
      throw conflict('USER_NOT_ACTIVE', 'Ce compte est suspendu : réactivez-le d’abord.');
    }

    const token = generateSessionToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TTL_MS);
    await this.prisma.$transaction(async (tx) => {
      // Un seul lien valide à la fois.
      await tx.passwordResetToken.updateMany({
        where: { userId, usedAt: null, expiresAt: { gt: now } },
        data: { expiresAt: now },
      });
      await tx.passwordResetToken.create({
        data: { userId, tokenHash: this.hash(token), expiresAt, createdById: actor.id },
      });
      await recordAudit(tx, actor, {
        action: 'PASSWORD_RESET_LINK_ISSUED',
        targetType: 'USER',
        targetId: userId,
        summary: `Lien de réinitialisation du mot de passe émis pour ${user.firstName} ${user.lastName}`,
      });
    });
    return {
      token,
      path: `/reinitialiser-mot-de-passe?jeton=${encodeURIComponent(token)}`,
      expiresAt,
    };
  }

  /**
   * Mot de passe oublié : un lien est envoyé si un compte actif existe. La réponse est
   * toujours la même, qu'il existe ou non (personne ne peut savoir qui est inscrit).
   */
  async request(dto: RequestResetDto) {
    if (!this.mail.enabled) return { ok: true, emailEnabled: false };
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, email: true, firstName: true, status: true },
    });
    if (user?.status === 'ACTIVE') {
      const now = new Date();
      // Au plus 3 liens par heure et par compte : pas de bombardement de la boîte mail.
      const recent = await this.prisma.passwordResetToken.count({
        where: {
          userId: user.id,
          createdById: null,
          createdAt: { gt: new Date(now.getTime() - 3_600_000) },
        },
      });
      if (recent < 3) {
        const token = generateSessionToken();
        await this.prisma.$transaction([
          this.prisma.passwordResetToken.updateMany({
            where: { userId: user.id, usedAt: null, expiresAt: { gt: now } },
            data: { expiresAt: now },
          }),
          this.prisma.passwordResetToken.create({
            data: {
              userId: user.id,
              tokenHash: this.hash(token),
              expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MS),
            },
          }),
        ]);
        // Sans attendre l'envoi : même durée de réponse que pour une adresse inconnue.
        void this.mail.send({
          to: user.email,
          subject: 'Réinitialisez votre mot de passe · TalentsConnect',
          heading: 'Choisissez un nouveau mot de passe',
          paragraphs: [
            `Bonjour ${user.firstName},`,
            'Vous avez demandé à réinitialiser le mot de passe de votre compte TalentsConnect. Ce lien est valable 2 heures et ne fonctionne qu’une seule fois.',
          ],
          action: {
            label: 'Choisir un nouveau mot de passe',
            url: this.mail.link(`/reinitialiser-mot-de-passe?jeton=${encodeURIComponent(token)}`),
          },
          footnote:
            'Vous n’êtes pas à l’origine de cette demande ? Ignorez cet email : votre mot de passe reste inchangé.',
        });
      }
    }
    return { ok: true, emailEnabled: true };
  }

  private async findValid(token: string) {
    if (typeof token !== 'string' || token.length < 20 || token.length > 100) throw invalidLink();
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.hash(token) },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
        user: { select: { firstName: true, status: true, email: true } },
      },
    });
    if (!row || row.usedAt || row.expiresAt <= new Date() || row.user.status !== 'ACTIVE') {
      throw invalidLink();
    }
    return row;
  }

  /** Vérifie un lien avant d'afficher le formulaire (seul le prénom est révélé). */
  async inspect(token: string) {
    const row = await this.findValid(token);
    return { valid: true, firstName: row.user.firstName, expiresAt: row.expiresAt };
  }

  async reset(dto: ResetPasswordDto) {
    const row = await this.findValid(dto.token);
    const passwordHash = await hashPassword(dto.newPassword);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      // Consommation atomique : deux envois simultanés du même lien → un seul réussit.
      const used = await tx.passwordResetToken.updateMany({
        where: { id: row.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (used.count === 0) throw invalidLink();
      await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
      await tx.authSession.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: now },
      });
    });
    this.realtime.disconnectWhere((u) => u.id === row.userId);
    void this.mail.send({
      to: row.user.email,
      subject: 'Votre mot de passe a été modifié · TalentsConnect',
      heading: 'Mot de passe modifié',
      paragraphs: [
        `Bonjour ${row.user.firstName},`,
        'Le mot de passe de votre compte TalentsConnect vient d’être changé. Toutes vos sessions ont été fermées : reconnectez-vous avec le nouveau mot de passe.',
      ],
      action: { label: 'Se connecter', url: this.mail.link('/connexion') },
      footnote:
        'Ce n’est pas vous ? Utilisez tout de suite « Mot de passe oublié » et prévenez l’équipe de la plateforme.',
    });
    return { ok: true };
  }
}

@ApiTags('auth')
@Controller()
export class PasswordResetController {
  constructor(private readonly resets: PasswordResetService) {}

  /** Génère un lien personnel de réinitialisation (équipe uniquement, tracé dans le journal). */
  @Roles('ADMIN')
  @Post('admin/users/:id/password-reset-link')
  issue(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.resets.issue(actor, id);
  }

  /** Mot de passe oublié : envoie un lien par email (réponse identique, compte ou non). */
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(200)
  @Post('auth/password-reset/request')
  request(@Body() dto: RequestResetDto) {
    return this.resets.request(dto);
  }

  /** Vérification d'un lien (POST : le jeton ne figure pas dans les journaux d'URL). */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('auth/password-reset/check')
  inspect(@Body() dto: CheckResetTokenDto) {
    return this.resets.inspect(dto.token);
  }

  /** Nouveau mot de passe ; toutes les sessions du compte sont révoquées. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('auth/password-reset')
  reset(@Body() dto: ResetPasswordDto) {
    return this.resets.reset(dto);
  }
}
