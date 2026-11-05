import {
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUrl, Length, MaxLength } from 'class-validator';
import { PrismaService } from '../../database/prisma.service.js';
import { CurrentUser, Public, Roles } from '../../common/auth/decorators.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { forbidden, notFound, unprocessable } from '../../common/errors.js';
import { paginate, PaginationQuery } from '../../common/pagination.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { ResourceKind } from '../../generated/prisma/enums.js';
import { MentorshipAccessService } from '../mentorships/mentorship-access.service.js';
import { NotificationsService } from '../notifications/notifications.module.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const v = value.trim();
  return v === '' ? undefined : v;
};

export class CreateResourceDto {
  @Transform(trim)
  @IsString()
  @Length(3, 160, { message: 'Le titre doit contenir entre 3 et 160 caractères.' })
  title!: string;

  /** Conseil rédigé ou présentation du lien. */
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'La description contient au plus 2000 caractères.' })
  description?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    { message: 'Le lien doit être une URL https.' },
  )
  @MaxLength(500)
  url?: string;

  @IsOptional()
  @IsEnum(ResourceKind)
  kind?: ResourceKind;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  domainId?: string;
}

export class ListResourcesQuery extends PaginationQuery {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  /** Slug du domaine. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  domain?: string;

  @IsOptional()
  @IsEnum(ResourceKind)
  kind?: ResourceKind;
}

const resourceSelect = {
  id: true,
  mentorshipId: true,
  kind: true,
  title: true,
  description: true,
  url: true,
  createdAt: true,
  author: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUpdatedAt: true,
      role: true,
      mentorProfile: { select: { headline: true } },
    },
  },
  domain: { select: { id: true, slug: true, name: true } },
} satisfies Prisma.ResourceSelect;

@Injectable()
export class ResourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: MentorshipAccessService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Bibliothèque publique (ressources non rattachées à un mentorat). */
  async library(q: ListResourcesQuery) {
    const where: Prisma.ResourceWhereInput = {
      mentorshipId: null,
      author: { status: 'ACTIVE' },
      ...(q.kind ? { kind: q.kind } : {}),
      ...(q.domain ? { domain: { slug: q.domain } } : {}),
      ...(q.q
        ? {
            OR: [
              { title: { contains: q.q, mode: 'insensitive' } },
              { description: { contains: q.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.resource.count({ where }),
      this.prisma.resource.findMany({
        where,
        select: resourceSelect,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return paginate(items, total, q);
  }

  /** Publication dans la bibliothèque publique : mentors et administrateurs. */
  async publish(user: AuthUser, dto: CreateResourceDto) {
    const data = await this.validate(dto);
    return this.prisma.resource.create({
      data: { ...data, authorId: user.id, mentorshipId: null },
      select: resourceSelect,
    });
  }

  async listForMentorship(user: AuthUser, mentorshipId: string) {
    await this.access.assertParticipant(user, mentorshipId);
    return this.prisma.resource.findMany({
      where: { mentorshipId },
      select: resourceSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Partage privé dans un mentorat actif ; l'autre participant est notifié. */
  async shareInMentorship(user: AuthUser, mentorshipId: string, dto: CreateResourceDto) {
    const access = await this.access.assertActiveParticipant(user, mentorshipId);
    const data = await this.validate(dto);
    const resource = await this.prisma.resource.create({
      data: { ...data, authorId: user.id, mentorshipId },
      select: resourceSelect,
    });
    await this.notifications.notify({
      userId: access.counterpartId,
      type: 'RESOURCE_SHARED',
      title: `${user.firstName} ${user.lastName} a partagé une ressource`,
      body: resource.title,
      link: `/mentorats/${mentorshipId}`,
    });
    return resource;
  }

  /** Suppression : l'auteur, ou un administrateur pour la bibliothèque publique. */
  async remove(user: AuthUser, id: string) {
    const resource = await this.prisma.resource.findUnique({
      where: { id },
      select: { authorId: true, mentorshipId: true },
    });
    if (!resource) throw notFound('RESOURCE_NOT_FOUND', 'Ressource introuvable.');
    if (resource.mentorshipId) {
      // Ressource privée : on ne révèle son existence qu'aux participants.
      await this.access.assertParticipant(user, resource.mentorshipId);
    }
    const isModerator = user.role === 'ADMIN' && resource.mentorshipId === null;
    if (resource.authorId !== user.id && !isModerator) {
      throw forbidden('NOT_RESOURCE_AUTHOR', 'Seul l’auteur peut supprimer cette ressource.');
    }
    await this.prisma.resource.delete({ where: { id } });
    return { ok: true };
  }

  private async validate(dto: CreateResourceDto) {
    if (!dto.url && !dto.description) {
      throw unprocessable('RESOURCE_EMPTY', 'Ajoutez un lien ou un contenu à la ressource.', [
        { field: 'url', messages: ['Renseignez un lien ou une description.'] },
      ]);
    }
    if (dto.domainId) {
      const exists = await this.prisma.expertiseDomain.count({
        where: { id: dto.domainId, isActive: true },
      });
      if (!exists) throw unprocessable('INVALID_DOMAIN', 'Domaine invalide.');
    }
    return {
      title: dto.title,
      description: dto.description ?? null,
      url: dto.url ?? null,
      kind: dto.kind ?? 'OTHER',
      domainId: dto.domainId ?? null,
    };
  }
}

@ApiTags('resources')
@Controller()
export class ResourcesController {
  constructor(private readonly resources: ResourcesService) {}

  /** Bibliothèque publique de ressources et conseils professionnels. */
  @Public()
  @Get('resources')
  library(@Query() q: ListResourcesQuery) {
    return this.resources.library(q);
  }

  @Roles('MENTOR', 'ADMIN')
  @Post('resources')
  publish(@CurrentUser() user: AuthUser, @Body() dto: CreateResourceDto) {
    return this.resources.publish(user, dto);
  }

  @Delete('resources/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.resources.remove(user, id);
  }

  @Get('mentorships/:mentorshipId/resources')
  listForMentorship(@CurrentUser() user: AuthUser, @Param('mentorshipId') id: string) {
    return this.resources.listForMentorship(user, id);
  }

  @Post('mentorships/:mentorshipId/resources')
  share(
    @CurrentUser() user: AuthUser,
    @Param('mentorshipId') id: string,
    @Body() dto: CreateResourceDto,
  ) {
    return this.resources.shareInMentorship(user, id, dto);
  }
}

@Module({ controllers: [ResourcesController], providers: [ResourcesService] })
export class ResourcesModule {}
