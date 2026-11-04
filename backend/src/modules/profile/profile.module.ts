import { Body, Controller, Get, Module, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/auth/decorators.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { ProfileService } from './profile.service.js';
import { UpsertMenteeProfileDto, UpsertMentorProfileDto } from './profile.dto.js';

@ApiTags('profile')
@Controller('profile')
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  /** Profil complet de l'utilisateur connecté (privé). */
  @Get('me')
  getMine(@CurrentUser() user: AuthUser) {
    return this.profile.getMine(user);
  }

  /** Création ou mise à jour du profil mentor (onboarding inclus). */
  @Roles('MENTOR')
  @Put('mentor')
  upsertMentor(@CurrentUser() user: AuthUser, @Body() dto: UpsertMentorProfileDto) {
    return this.profile.upsertMentor(user, dto);
  }

  /** Création ou mise à jour du profil mentoré (onboarding inclus). */
  @Roles('MENTEE')
  @Put('mentee')
  upsertMentee(@CurrentUser() user: AuthUser, @Body() dto: UpsertMenteeProfileDto) {
    return this.profile.upsertMentee(user, dto);
  }
}

@Module({
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
