import { Body, Controller, Get, Module, Patch, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../common/auth/decorators.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { ProfileService } from './profile.service.js';
import { PrivacyController, PrivacyService } from './privacy.js';
import { AvatarController, AvatarService } from './avatar.js';
import { UpdateAccountDto, UpsertMenteeProfileDto, UpsertMentorProfileDto } from './profile.dto.js';

@ApiTags('profile')
@Controller('profile')
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  /** Profil complet de l'utilisateur connecté (privé). */
  @Get('me')
  getMine(@CurrentUser() user: AuthUser) {
    return this.profile.getMine(user);
  }

  /** Informations de compte : prénom, nom, fuseau horaire. */
  @Patch('me')
  updateAccount(@CurrentUser() user: AuthUser, @Body() dto: UpdateAccountDto) {
    return this.profile.updateAccount(user, dto);
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
  controllers: [ProfileController, PrivacyController, AvatarController],
  providers: [ProfileService, PrivacyService, AvatarService],
})
export class ProfileModule {}
