import { Body, Controller, Get, HttpCode, Module, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/auth/decorators.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { MentorshipRequestsService } from './mentorship-requests.service.js';
import {
  CreateMentorshipRequestDto,
  DecisionDto,
  ListRequestsQuery,
} from './mentorship-requests.dto.js';

@ApiTags('mentorship-requests')
@Controller('mentorship-requests')
export class MentorshipRequestsController {
  constructor(private readonly requests: MentorshipRequestsService) {}

  /** Envoi d'une demande motivée (mentoré). */
  @Roles('MENTEE')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateMentorshipRequestDto) {
    return this.requests.create(user, dto);
  }

  /** Demandes reçues (mentor). */
  @Roles('MENTOR')
  @Get('inbox')
  inbox(@CurrentUser() user: AuthUser, @Query() q: ListRequestsQuery) {
    return this.requests.inbox(user, q.status);
  }

  /** Demandes envoyées (mentoré). */
  @Roles('MENTEE')
  @Get('sent')
  sent(@CurrentUser() user: AuthUser, @Query() q: ListRequestsQuery) {
    return this.requests.sent(user, q.status);
  }

  @Get(':id')
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.requests.getOne(user, id);
  }

  @Roles('MENTOR')
  @HttpCode(200)
  @Post(':id/accept')
  accept(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: DecisionDto) {
    return this.requests.accept(user, id, dto);
  }

  @Roles('MENTOR')
  @HttpCode(200)
  @Post(':id/decline')
  decline(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: DecisionDto) {
    return this.requests.decline(user, id, dto);
  }

  @Roles('MENTEE')
  @HttpCode(200)
  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.requests.cancel(user, id);
  }
}

@Module({
  controllers: [MentorshipRequestsController],
  providers: [MentorshipRequestsService],
})
export class MentorshipRequestsModule {}
