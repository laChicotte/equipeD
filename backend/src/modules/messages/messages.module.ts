import {
  Body,
  Controller,
  Get,
  HttpCode,
  Injectable,
  Module,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { Response } from 'express';
import { PrismaService } from '../../database/prisma.service.js';
import { CurrentUser } from '../../common/auth/decorators.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { notFound, unprocessable } from '../../common/errors.js';
import { MentorshipAccessService } from '../mentorships/mentorship-access.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import {
  documentUpload,
  readUploadedDocument,
  sendStoredFile,
  type UploadedDocument,
} from '../resources/resource-file.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class SendMessageDto {
  @Transform(trim)
  @IsString()
  @Length(1, 2000, { message: 'Un message contient entre 1 et 2000 caractères.' })
  content!: string;

  /** Identifiant unique généré par le navigateur : renvoyer le même message ne le duplique pas. */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9-]{8,64}$/, { message: 'Identifiant de message invalide.' })
  clientId?: string;
}

/** Message avec pièce jointe : la légende est facultative. */
export class SendFileMessageDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Un message contient au plus 2000 caractères.' })
  content?: string;
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

export class FileQuery {
  /** « 1 » : affichage dans la page (images uniquement) ; sinon téléchargement. */
  @IsOptional()
  @IsIn(['1'])
  inline?: string;
}

const messageSelect = {
  id: true,
  content: true,
  createdAt: true,
  readAt: true,
  senderId: true,
  file: { select: { fileName: true, mimeType: true, size: true } },
  call: { select: { id: true, kind: true, status: true, answeredAt: true, endedAt: true } },
} as const;

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: MentorshipAccessService,
    private readonly realtime: RealtimeService,
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
    const access = await this.access.assertMessagingParticipant(user, mentorshipId);
    const data = { mentorshipId, senderId: user.id, content: dto.content };
    const message = dto.clientId
      ? await this.prisma.message.upsert({
          where: { senderId_clientId: { senderId: user.id, clientId: dto.clientId } },
          create: { ...data, clientId: dto.clientId },
          update: {},
          select: messageSelect,
        })
      : await this.prisma.message.create({ data, select: messageSelect });
    this.realtime.emitToUser(access.counterpartId, 'message:new', { mentorshipId });
    return message;
  }

  /** Message avec pièce jointe (document ou photo), légende facultative. */
  async sendFile(
    user: AuthUser,
    mentorshipId: string,
    dto: SendFileMessageDto,
    upload?: UploadedDocument,
  ) {
    const access = await this.access.assertMessagingParticipant(user, mentorshipId);
    if (!upload) {
      throw unprocessable('FILE_REQUIRED', 'Choisissez un fichier à envoyer.', [
        { field: 'file', messages: ['Choisissez un fichier à envoyer.'] },
      ]);
    }
    const file = readUploadedDocument(upload);
    const message = await this.prisma.message.create({
      data: {
        mentorshipId,
        senderId: user.id,
        content: dto.content ?? '',
        hasFile: true,
        file: { create: file },
      },
      select: messageSelect,
    });
    this.realtime.emitToUser(access.counterpartId, 'message:new', { mentorshipId });
    return message;
  }

  /** Pièce jointe : visible des deux seuls participants (404 pour les autres). */
  async file(user: AuthUser, messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: {
        mentorshipId: true,
        file: { select: { fileName: true, mimeType: true, size: true, data: true } },
      },
    });
    const missing = notFound('FILE_NOT_FOUND', 'Fichier introuvable.');
    if (!message?.file) throw missing;
    try {
      await this.access.assertParticipant(user, message.mentorshipId);
    } catch {
      throw missing;
    }
    return message.file;
  }

  /** Marque comme lus les messages reçus (jamais ceux envoyés par soi-même). */
  async markRead(user: AuthUser, mentorshipId: string) {
    const access = await this.access.assertParticipant(user, mentorshipId);
    const result = await this.prisma.message.updateMany({
      where: { mentorshipId, senderId: { not: user.id }, readAt: null },
      data: { readAt: new Date() },
    });
    // Accusé de lecture en direct pour l'autre participant.
    if (result.count > 0) {
      this.realtime.emitToUser(access.counterpartId, 'message:read', { mentorshipId });
    }
    return { updated: result.count };
  }
}

@ApiTags('messages')
@Controller()
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get('mentorships/:mentorshipId/messages')
  list(
    @CurrentUser() user: AuthUser,
    @Param('mentorshipId') id: string,
    @Query() q: ListMessagesQuery,
  ) {
    return this.messages.list(user, id, q);
  }

  /** Envoi d'un message (limité à 30 par minute). */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('mentorships/:mentorshipId/messages')
  send(
    @CurrentUser() user: AuthUser,
    @Param('mentorshipId') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messages.send(user, id, dto);
  }

  /** Envoi d'une pièce jointe (multipart : « file » et « content » facultatif), 10 par minute. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('mentorships/:mentorshipId/messages/upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(documentUpload())
  sendFile(
    @CurrentUser() user: AuthUser,
    @Param('mentorshipId') id: string,
    @Body() dto: SendFileMessageDto,
    @UploadedFile() file?: UploadedDocument,
  ) {
    return this.messages.sendFile(user, id, dto, file);
  }

  @Get('messages/:id/file')
  async file(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query() q: FileQuery,
    @Res() res: Response,
  ) {
    sendStoredFile(res, await this.messages.file(user, id), { inline: q.inline === '1' });
  }

  @HttpCode(200)
  @Post('mentorships/:mentorshipId/messages/read')
  markRead(@CurrentUser() user: AuthUser, @Param('mentorshipId') id: string) {
    return this.messages.markRead(user, id);
  }
}

@Module({
  controllers: [MessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}
