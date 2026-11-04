import { Body, Controller, Get, HttpCode, Injectable, Module, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { PrismaService } from '../../database/prisma.service.js';
import { CurrentUser } from '../../common/auth/decorators.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { MentorshipAccessService } from '../mentorships/mentorship-access.service.js';

export class SendMessageDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 2000, { message: 'Un message contient entre 1 et 2000 caractères.' })
  content!: string;
}

export class ListMessagesQuery {
  /** Pour l'actualisation incrémentale : messages strictement postérieurs à cette date. */
  @IsOptional()
  @IsISO8601()
  after?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit: number = 100;
}

const messageSelect = {
  id: true,
  content: true,
  createdAt: true,
  readAt: true,
  senderId: true,
} as const;

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: MentorshipAccessService,
  ) {}

  async list(user: AuthUser, mentorshipId: string, q: ListMessagesQuery) {
    await this.access.assertParticipant(user, mentorshipId);
    const rows = await this.prisma.message.findMany({
      where: { mentorshipId, ...(q.after ? { createdAt: { gt: new Date(q.after) } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: q.limit,
      select: messageSelect,
    });
    return rows.reverse();
  }

  async send(user: AuthUser, mentorshipId: string, dto: SendMessageDto) {
    await this.access.assertActiveParticipant(user, mentorshipId);
    return this.prisma.message.create({
      data: { mentorshipId, senderId: user.id, content: dto.content },
      select: messageSelect,
    });
  }

  /** Marque comme lus les messages reçus (jamais ceux envoyés par soi-même). */
  async markRead(user: AuthUser, mentorshipId: string) {
    await this.access.assertParticipant(user, mentorshipId);
    const result = await this.prisma.message.updateMany({
      where: { mentorshipId, senderId: { not: user.id }, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }
}

@ApiTags('messages')
@Controller('mentorships/:mentorshipId/messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Param('mentorshipId') id: string, @Query() q: ListMessagesQuery) {
    return this.messages.list(user, id, q);
  }

  /** Envoi d'un message (limité à 30 par minute). */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post()
  send(@CurrentUser() user: AuthUser, @Param('mentorshipId') id: string, @Body() dto: SendMessageDto) {
    return this.messages.send(user, id, dto);
  }

  @HttpCode(200)
  @Post('read')
  markRead(@CurrentUser() user: AuthUser, @Param('mentorshipId') id: string) {
    return this.messages.markRead(user, id);
  }
}

@Module({
  controllers: [MessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}
