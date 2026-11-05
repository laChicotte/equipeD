import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Module,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  documentUpload,
  sendStoredFile,
  type UploadedDocument,
} from '../resources/resource-file.js';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Roles } from '../../common/auth/decorators.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import {
  AddMembersDto,
  CandidatesQuery,
  CreateGroupDto,
  GroupFileQuery,
  ListGroupMessagesQuery,
  SendGroupFileMessageDto,
  SendGroupMessageDto,
  UpdateGroupDto,
} from './groups.dto.js';
import { GroupsService } from './groups.service.js';
import { CreateWorkshopDto, ListWorkshopsQuery, WorkshopAttendanceDto } from './workshops.dto.js';
import { WorkshopsService } from './workshops.service.js';

@ApiTags('groups')
@Controller('groups')
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  /** Groupes dont l'utilisateur connecté est membre. */
  @Get('me')
  listMine(@CurrentUser() user: AuthUser) {
    return this.groups.listMine(user);
  }

  /** Personnes qu'un mentor peut ajouter à un nouveau groupe (ses mentorés, les mentors publiés). */
  @Roles('MENTOR')
  @Get('candidates')
  candidates(@CurrentUser() user: AuthUser, @Query() q: CandidatesQuery) {
    return this.groups.candidates(user, q);
  }

  /** Création d'un groupe (mentors uniquement). Limité à 10 par heure. */
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @Roles('MENTOR')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateGroupDto) {
    return this.groups.create(user, dto);
  }

  @Get(':id')
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.groups.getOne(user, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateGroupDto) {
    return this.groups.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.groups.remove(user, id);
  }

  /** Personnes ajoutables à ce groupe (hors membres actuels). */
  @Get(':id/candidates')
  groupCandidates(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query() q: CandidatesQuery,
  ) {
    return this.groups.candidates(user, q, id);
  }

  @Post(':id/members')
  addMembers(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddMembersDto) {
    return this.groups.addMembers(user, id, dto);
  }

  /** Retrait d'un membre (responsable) ou départ (le membre lui-même). */
  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    await this.groups.removeMember(user, id, userId);
  }

  @Get(':id/messages')
  listMessages(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query() q: ListGroupMessagesQuery,
  ) {
    return this.groups.listMessages(user, id, q);
  }

  /** Envoi d'un message dans le groupe (limité à 30 par minute). */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post(':id/messages')
  send(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SendGroupMessageDto) {
    return this.groups.send(user, id, dto);
  }

  /** Envoi d'une pièce jointe dans le groupe (multipart : « file » et « content » facultatif). */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/messages/upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(documentUpload())
  sendFile(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SendGroupFileMessageDto,
    @UploadedFile() file?: UploadedDocument,
  ) {
    return this.groups.sendFile(user, id, dto, file);
  }

  @Get('messages/:messageId/file')
  async file(
    @CurrentUser() user: AuthUser,
    @Param('messageId') messageId: string,
    @Query() q: GroupFileQuery,
    @Res() res: Response,
  ) {
    sendStoredFile(res, await this.groups.file(user, messageId), { inline: q.inline === '1' });
  }

  @HttpCode(200)
  @Post(':id/read')
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.groups.markRead(user, id);
  }
}

@ApiTags('workshops')
@Controller()
export class WorkshopsController {
  constructor(private readonly workshops: WorkshopsService) {}

  /** Ateliers de tous mes groupes (à venir par défaut). */
  @Get('workshops/me')
  listMine(@CurrentUser() user: AuthUser, @Query() q: ListWorkshopsQuery) {
    return this.workshops.listMine(user, q);
  }

  @Get('groups/:id/workshops')
  listForGroup(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query() q: ListWorkshopsQuery,
  ) {
    return this.workshops.listForGroup(user, id, q);
  }

  /** Planification d'un atelier par le mentor responsable du groupe (20 par heure au plus). */
  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @Roles('MENTOR')
  @Post('groups/:id/workshops')
  create(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateWorkshopDto) {
    return this.workshops.create(user, id, dto);
  }

  @HttpCode(200)
  @Post('workshops/:id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.workshops.cancel(user, id);
  }

  /** Réponse d'un membre : { going: true | false }. */
  @Put('workshops/:id/attendance')
  respond(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: WorkshopAttendanceDto,
  ) {
    return this.workshops.respond(user, id, dto);
  }
}

@Module({
  controllers: [GroupsController, WorkshopsController],
  providers: [GroupsService, WorkshopsService],
})
export class GroupsModule {}
