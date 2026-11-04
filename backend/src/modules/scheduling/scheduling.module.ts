import { Body, Controller, Delete, Get, HttpCode, Module, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/auth/decorators.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { AvailabilityService } from './availability.service.js';
import { SessionsService } from './sessions.service.js';
import { BookSessionDto, ConfirmSessionDto, CreateSlotDto, ListSessionsQuery } from './scheduling.dto.js';

@ApiTags('availability')
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  /** Créneaux à venir du mentor connecté. */
  @Roles('MENTOR')
  @Get('me')
  listMine(@CurrentUser() user: AuthUser) {
    return this.availability.listMine(user);
  }

  @Roles('MENTOR')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSlotDto) {
    return this.availability.create(user, dto);
  }

  @Roles('MENTOR')
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.availability.remove(user, id);
  }
}

@ApiTags('sessions')
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  /** Réservation d'un créneau par un mentoré accompagné par ce mentor. */
  @Roles('MENTEE')
  @Post()
  book(@CurrentUser() user: AuthUser, @Body() dto: BookSessionDto) {
    return this.sessions.book(user, dto);
  }

  @Get('me')
  listMine(@CurrentUser() user: AuthUser, @Query() q: ListSessionsQuery) {
    return this.sessions.listMine(user, q);
  }

  @Roles('MENTOR')
  @HttpCode(200)
  @Post(':id/confirm')
  confirm(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ConfirmSessionDto) {
    return this.sessions.confirm(user, id, dto);
  }

  @HttpCode(200)
  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sessions.cancel(user, id);
  }

  @Roles('MENTOR')
  @HttpCode(200)
  @Post(':id/complete')
  complete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sessions.complete(user, id);
  }
}

@Module({
  controllers: [AvailabilityController, SessionsController],
  providers: [AvailabilityService, SessionsService],
})
export class SchedulingModule {}
