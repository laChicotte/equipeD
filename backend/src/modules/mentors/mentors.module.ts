import { Controller, Get, Module, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public, Roles } from '../../common/auth/decorators.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { MentorsService } from './mentors.service.js';
import { AvailabilityRangeQuery, ListMentorsQuery } from './mentors.dto.js';

@ApiTags('mentors')
@Controller('mentors')
export class MentorsController {
  constructor(private readonly mentors: MentorsService) {}

  /** Annuaire public des mentors, filtrable et paginé. */
  @Public()
  @Get()
  list(@Query() query: ListMentorsQuery) {
    return this.mentors.list(query);
  }

  /** Suggestions personnalisées et explicables pour le mentoré connecté. */
  @Roles('MENTEE')
  @Get('suggestions')
  suggestions(@CurrentUser() user: AuthUser) {
    return this.mentors.suggestions(user);
  }

  /** Fiche publique d'un mentor (+ relation avec le visiteur s'il est connecté). */
  @Public()
  @Get(':id')
  getById(@Param('id') id: string, @CurrentUser() user: AuthUser | undefined) {
    return this.mentors.getById(id, user);
  }

  /** Créneaux libres d'un mentor. */
  @Public()
  @Get(':id/availability')
  availability(@Param('id') id: string, @Query() range: AvailabilityRangeQuery) {
    return this.mentors.availability(id, range);
  }
}

@Module({
  controllers: [MentorsController],
  providers: [MentorsService],
  exports: [MentorsService],
})
export class MentorsModule {}
