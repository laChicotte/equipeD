import { Controller, Get, Global, Module, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/decorators.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { MentorshipAccessService } from './mentorship-access.service.js';
import { MentorshipsService } from './mentorships.service.js';

@ApiTags('mentorships')
@Controller('mentorships')
export class MentorshipsController {
  constructor(private readonly mentorships: MentorshipsService) {}

  /** Mentorats de l'utilisateur connecté (mentor ou mentoré). */
  @Get('me')
  listMine(@CurrentUser() user: AuthUser) {
    return this.mentorships.listMine(user);
  }

  @Get(':id')
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.mentorships.getOne(user, id);
  }
}

@Global()
@Module({
  controllers: [MentorshipsController],
  providers: [MentorshipsService, MentorshipAccessService],
  exports: [MentorshipAccessService],
})
export class MentorshipsModule {}
