import { Body, Controller, Get, Injectable, Module, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CurrentUser, Public } from '../../common/auth/decorators.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { notFound, unprocessable } from '../../common/errors.js';
import { PrismaService } from '../../database/prisma.service.js';
import { MentorshipAccessService } from '../mentorships/mentorship-access.service.js';
import { NotificationsService } from '../notifications/notifications.module.js';
import { findGuidedPath, GUIDED_PATHS } from './guided-paths.catalog.js';

export class GuidedPathsQuery {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(80)
  domain?: string;
}

export class ApplyGuidedPathDto {
  /** Objectifs du parcours à ajouter (tous si absent). */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  goalKeys?: string[];
}

const goalInclude = {
  milestones: { orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }] },
  createdBy: { select: { id: true, firstName: true, lastName: true, avatarUpdatedAt: true } },
};

@Injectable()
export class GuidedPathsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: MentorshipAccessService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Parcours dont le domaine est actif, avec le domaine résolu depuis la base. */
  async list(domainSlug?: string) {
    const domains = await this.prisma.expertiseDomain.findMany({
      where: { isActive: true },
      select: { id: true, slug: true, name: true },
    });
    const bySlug = new Map(domains.map((d) => [d.slug, d]));
    return GUIDED_PATHS.filter((p) => bySlug.has(p.domainSlug))
      .filter((p) => !domainSlug || p.domainSlug === domainSlug)
      .map((p) => ({
        key: p.key,
        title: p.title,
        summary: p.summary,
        notice: p.notice ?? null,
        domain: bySlug.get(p.domainSlug)!,
        goals: p.goals.map((g) => ({ ...g })),
      }));
  }

  /**
   * Ajoute les objectifs d'un parcours à un mentorat actif (l'un ou l'autre participant).
   * Un objectif dont le titre existe déjà dans le mentorat n'est pas recréé : appliquer deux fois
   * le même parcours ne crée pas de doublons.
   */
  async apply(user: AuthUser, mentorshipId: string, pathKey: string, dto: ApplyGuidedPathDto) {
    const access = await this.access.assertActiveParticipant(user, mentorshipId);
    const path = findGuidedPath(pathKey);
    if (!path) throw notFound('GUIDED_PATH_NOT_FOUND', 'Parcours guidé introuvable.');

    const wanted = dto.goalKeys?.length
      ? path.goals.filter((g) => dto.goalKeys!.includes(g.key))
      : path.goals;
    const unknown = (dto.goalKeys ?? []).filter((k) => !path.goals.some((g) => g.key === k));
    if (unknown.length > 0 || wanted.length === 0) {
      throw unprocessable('INVALID_GUIDED_GOAL', 'Objectif inconnu dans ce parcours.', [
        { field: 'goalKeys', messages: ['Choisissez au moins un objectif du parcours.'] },
      ]);
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const existing = new Set(
        (await tx.goal.findMany({ where: { mentorshipId }, select: { title: true } })).map(
          (g) => g.title,
        ),
      );
      const toCreate = wanted.filter((g) => !existing.has(g.title));
      const goals = [];
      for (const g of toCreate) {
        goals.push(
          await tx.goal.create({
            data: {
              mentorshipId,
              createdById: user.id,
              title: g.title,
              description: g.description,
              milestones: {
                create: g.milestones.map((title, sortOrder) => ({ title, sortOrder })),
              },
            },
            include: goalInclude,
          }),
        );
      }
      return goals;
    });

    if (created.length > 0) {
      await this.notifications.notify({
        userId: access.counterpartId,
        type: 'GOAL_FEEDBACK',
        title: `${user.firstName} ${user.lastName} a ajouté le parcours « ${path.title} »`,
        body: `${created.length} objectif${created.length > 1 ? 's' : ''} et leurs étapes à suivre ensemble.`,
        link: `/mentorats/${mentorshipId}`,
      });
    }
    return {
      created,
      skipped: wanted.filter((g) => !created.some((c) => c.title === g.title)).map((g) => g.key),
    };
  }
}

@ApiTags('guided-paths')
@Controller()
export class GuidedPathsController {
  constructor(private readonly service: GuidedPathsService) {}

  /** Catalogue public des parcours guidés (filtrable par slug de domaine). */
  @Public()
  @Get('guided-paths')
  list(@Query() q: GuidedPathsQuery) {
    return this.service.list(q.domain);
  }

  /** Ajoute tout ou partie d'un parcours aux objectifs d'un mentorat actif. */
  @Post('mentorships/:mentorshipId/guided-paths/:key')
  apply(
    @CurrentUser() user: AuthUser,
    @Param('mentorshipId') mentorshipId: string,
    @Param('key') key: string,
    @Body() dto: ApplyGuidedPathDto,
  ) {
    return this.service.apply(user, mentorshipId, key, dto);
  }
}

@Module({
  controllers: [GuidedPathsController],
  providers: [GuidedPathsService],
})
export class GuidedPathsModule {}
