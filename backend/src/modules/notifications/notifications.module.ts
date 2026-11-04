import {
  Controller,
  Get,
  Global,
  HttpCode,
  Injectable,
  Logger,
  Module,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBooleanString, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PrismaService } from '../../database/prisma.service.js';
import { CurrentUser } from '../../common/auth/decorators.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { notFound } from '../../common/errors.js';
import type { NotificationType } from '../../generated/prisma/enums.js';

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  /** Chemin relatif de l'écran frontend concerné (ex. /mentorats/abc). */
  link?: string;
}

export class ListNotificationsQuery {
  @IsOptional()
  @IsBooleanString()
  unread?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 30;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Notifications');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée une notification après une action métier réussie.
   * Ne lève jamais d'exception : un échec de notification ne doit pas annuler l'action principale.
   */
  async notify(input: NotifyInput): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: {
          userId: input.userId,
          type: input.type,
          title: input.title.slice(0, 160),
          body: input.body?.slice(0, 500) ?? null,
          link: input.link ?? null,
        },
      });
    } catch (error) {
      this.logger.warn(`Notification ${input.type} non créée : ${(error as Error).message}`);
    }
  }

  list(user: AuthUser, q: ListNotificationsQuery) {
    return this.prisma.notification.findMany({
      where: { userId: user.id, ...(q.unread === 'true' ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: q.limit,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        link: true,
        readAt: true,
        createdAt: true,
      },
    });
  }

  async unreadCount(user: AuthUser) {
    const count = await this.prisma.notification.count({
      where: { userId: user.id, readAt: null },
    });
    return { count };
  }

  async markRead(user: AuthUser, id: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId: user.id },
      data: { readAt: new Date() },
    });
    // Même réponse qu'une notification inexistante : on ne révèle pas celles des autres.
    if (result.count === 0) throw notFound('NOTIFICATION_NOT_FOUND', 'Notification introuvable.');
    return { ok: true };
  }

  async markAllRead(user: AuthUser) {
    const result = await this.prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }
}

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: ListNotificationsQuery) {
    return this.notifications.list(user, q);
  }

  /** Compteur léger pour le badge du header (à interroger toutes les 30 s environ). */
  @Get('unread-count')
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.notifications.unreadCount(user);
  }

  @HttpCode(200)
  @Post('read-all')
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user);
  }

  @HttpCode(200)
  @Post(':id/read')
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notifications.markRead(user, id);
  }
}

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
