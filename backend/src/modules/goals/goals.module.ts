import { Body, Controller, Delete, Get, Module, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/decorators.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { GoalsService } from './goals.service.js';
import { CreateGoalDto, CreateMilestoneDto, UpdateGoalDto, UpdateMilestoneDto } from './goals.dto.js';

@ApiTags('goals')
@Controller()
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  @Get('mentorships/:mentorshipId/goals')
  list(@CurrentUser() user: AuthUser, @Param('mentorshipId') id: string) {
    return this.goals.list(user, id);
  }

  @Post('mentorships/:mentorshipId/goals')
  create(@CurrentUser() user: AuthUser, @Param('mentorshipId') id: string, @Body() dto: CreateGoalDto) {
    return this.goals.create(user, id, dto);
  }

  @Patch('goals/:id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateGoalDto) {
    return this.goals.update(user, id, dto);
  }

  @Delete('goals/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.goals.remove(user, id);
  }

  @Post('goals/:id/milestones')
  addMilestone(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateMilestoneDto) {
    return this.goals.addMilestone(user, id, dto);
  }

  @Patch('milestones/:id')
  updateMilestone(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateMilestoneDto) {
    return this.goals.updateMilestone(user, id, dto);
  }

  @Delete('milestones/:id')
  removeMilestone(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.goals.removeMilestone(user, id);
  }
}

@Module({
  controllers: [GoalsController],
  providers: [GoalsService],
})
export class GoalsModule {}
