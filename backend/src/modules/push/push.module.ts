import {
  Body,
  Controller,
  Delete,
  Get,
  Global,
  HttpCode,
  Injectable,
  Logger,
  Module,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, Matches, MaxLength, ValidateNested } from 'class-validator';
import webpush from 'web-push';
import { AppConfigService } from '../../config/app-config.service.js';
import { CurrentUser, Public } from '../../common/auth/decorators.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { unprocessable } from '../../common/errors.js';
import { PrismaService } from '../../database/prisma.service.js';

class PushKeysDto {
  @IsString()
  @MaxLength(200)
  p256dh!: string;

  @IsString()
  @MaxLength(100)
  auth!: string;
}

export class PushSubscriptionDto {
  @IsString()
  @MaxLength(1000)
  @Matches(/^https:\/\//, { message: 'Adresse du service push invalide.' })
  endpoint!: string;

  @ValidateNested()
  @Type(() => PushKeysDto)
  keys!: PushKeysDto;
}

export class PushEndpointDto {
  @IsString()
  @MaxLength(1000)
  endpoint!: string;
}

/** Contenu d'une notification push (affichée par le service worker). */
export interface PushPayload {
  title: string;
  body?: string;
  /** Écran à ouvrir au clic (chemin relatif). */
  url?: string;
  /** Regroupe les notifications d'une même conversation (la dernière remplace la précédente). */
  tag?: string;
}

/**
 * Notifications push (Web Push, clés VAPID) : préviennent un utilisateur qui n'a pas
 * l'application ouverte. Contenu chiffré de bout en bout jusqu'au navigateur.
 * Ne lève jamais d'exception : un échec d'envoi n'annule pas l'action principale.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger('Push');
  readonly enabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {
    const publicKey = config.get('VAPID_PUBLIC_KEY');
    const privateKey = config.get('VAPID_PRIVATE_KEY');
    this.enabled = !!publicKey && !!privateKey && config.get('NODE_ENV') !== 'test';
    if (publicKey && privateKey) {
      webpush.setVapidDetails(config.get('VAPID_SUBJECT'), publicKey, privateKey);
    }
  }

  get publicKey() {
    return this.config.get('VAPID_PUBLIC_KEY');
  }

  async subscribe(user: AuthUser, dto: PushSubscriptionDto) {
    if (!this.publicKey) {
      throw unprocessable('PUSH_DISABLED', 'Les notifications push ne sont pas activées.');
    }
    // Un appareil = un abonnement : il suit la personne et la session actuellement connectées.
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: {
        userId: user.id,
        sessionId: user.sessionId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
      },
      update: {
        userId: user.id,
        sessionId: user.sessionId,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
      },
    });
    return { ok: true };
  }

  async unsubscribe(user: AuthUser, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
    return { ok: true };
  }

  async count(user: AuthUser) {
    return this.prisma.pushSubscription.count({ where: { userId: user.id } });
  }

  /** Envoie à tous les appareils connectés de ces personnes (sessions encore valides). */
  async sendToUsers(userIds: string[], payload: PushPayload): Promise<void> {
    if (!this.enabled || userIds.length === 0) return;
    try {
      const subs = await this.prisma.pushSubscription.findMany({
        where: {
          userId: { in: userIds },
          session: { revokedAt: null, expiresAt: { gt: new Date() } },
        },
        select: { id: true, endpoint: true, p256dh: true, auth: true },
      });
      const body = JSON.stringify({
        title: payload.title.slice(0, 120),
        body: payload.body?.slice(0, 180),
        url: payload.url ?? '/',
        tag: payload.tag,
      });
      const expired: string[] = [];
      await Promise.all(
        subs.map(async (s) => {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              body,
              { TTL: 60 * 60 * 24, urgency: 'high', timeout: 10_000 },
            );
          } catch (error) {
            const status = (error as { statusCode?: number }).statusCode;
            // 404/410 : l'abonnement n'existe plus (notifications désactivées, navigateur réinstallé).
            if (status === 404 || status === 410) expired.push(s.id);
            else this.logger.warn(`Envoi push impossible (${status ?? 'réseau'})`);
          }
        }),
      );
      if (expired.length) {
        await this.prisma.pushSubscription.deleteMany({ where: { id: { in: expired } } });
      }
    } catch (error) {
      this.logger.warn(`Notifications push non envoyées : ${(error as Error).message}`);
    }
  }

  sendToUser(userId: string, payload: PushPayload) {
    return this.sendToUsers([userId], payload);
  }
}

@ApiTags('push')
@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}

  /** Clé publique VAPID : vide si les notifications push ne sont pas configurées. */
  @Public()
  @Get('config')
  config() {
    return { enabled: !!this.push.publicKey, publicKey: this.push.publicKey || null };
  }

  /** Abonne l'appareil courant (rattaché à la session : la déconnexion coupe les envois). */
  @HttpCode(200)
  @Post('subscriptions')
  subscribe(@CurrentUser() user: AuthUser, @Body() dto: PushSubscriptionDto) {
    return this.push.subscribe(user, dto);
  }

  @HttpCode(200)
  @Delete('subscriptions')
  unsubscribe(@CurrentUser() user: AuthUser, @Body() dto: PushEndpointDto) {
    return this.push.unsubscribe(user, dto.endpoint);
  }
}

@Global()
@Module({ controllers: [PushController], providers: [PushService], exports: [PushService] })
export class PushModule {}
