import { Body, Controller, Get, Global, HttpCode, Module, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../../common/auth/decorators.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { MentorshipAccessService } from './mentorship-access.service.js';
import { MentorshipsService } from './mentorships.service.js';

export class CompleteMentorshipDto {
  /** Bilan facultatif de l'accompagnement. */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Le bilan contient au plus 1000 caractères.' })
  note?: string;
}

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

  /** Clôture du mentorat par l'un des participants (bilan facultatif). */
  @HttpCode(200)
  @Post(':id/complete')
  complete(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CompleteMentorshipDto,
  ) {
    return this.mentorships.complete(user, id, dto.note);
  }
}

@Global()
@Module({
  controllers: [MentorshipsController],
  providers: [MentorshipsService, MentorshipAccessService],
  exports: [MentorshipAccessService],
})
export class MentorshipsModule {}
