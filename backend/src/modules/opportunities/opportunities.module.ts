import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsBooleanString,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { PrismaService } from '../../database/prisma.service.js';
import { CurrentUser, Public, Roles } from '../../common/auth/decorators.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { forbidden, notFound, unprocessable } from '../../common/errors.js';
import { paginate, PaginationQuery } from '../../common/pagination.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { OpportunityType } from '../../generated/prisma/enums.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const v = value.trim();
  return v === '' ? undefined : v;
};

export class CreateOpportunityDto {
  @IsEnum(OpportunityType, { message: 'Type d’opportunité invalide.' })
  type!: OpportunityType;

  @Transform(trim)
  @IsString()
  @Length(5, 160, { message: 'Le titre doit contenir entre 5 et 160 caractères.' })
  title!: string;

  /** Structure qui propose l'opportunité. */
  @Transform(trim)
  @IsString()
  @Length(2, 120, { message: 'Indiquez la structure (2 à 120 caractères).' })
  organization!: string;

  @Transform(trim)
  @IsString()
  @Length(30, 3000, { message: 'La description doit contenir entre 30 et 3000 caractères.' })
  description!: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @IsOptional()
  @IsBoolean()
  isRemote?: boolean;

  /** Lien vers l'annonce ou la candidature (https). */
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    { message: 'Le lien doit être une URL https.' },
  )
  @MaxLength(500)
  url?: string;

  /** Date limite de candidature (ISO 8601), facultative. */
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'Date limite invalide.' })
  deadline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  domainId?: string;
}

export class UpdateOpportunityDto {
  @IsOptional()
  @IsEnum(OpportunityType)
  type?: OpportunityType;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(5, 160)
  title?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(2, 120)
  organization?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(30, 3000)
  description?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @IsOptional()
  @IsBoolean()
  isRemote?: boolean;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  url?: string;

  /** null pour retirer la date limite. */
  @ValidateIf((_o, v) => v !== null)
  @IsOptional()
  @IsISO8601({ strict: true })
  deadline?: string | null;

  /** true : retire l'opportunité de la liste publique ; false : la republie. */
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

export class ListOpportunitiesQuery extends PaginationQuery {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @IsEnum(OpportunityType)
  type?: OpportunityType;

  /** Slug du domaine. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  domain?: string;

  /** « true » : uniquement les opportunités accessibles à distance. */
  @IsOptional()
  @IsBooleanString()
  remote?: string;
}

const opportunitySelect = {
  id: true,
  type: true,
  title: true,
  organization: true,
  description: true,
  location: true,
  isRemote: true,
  url: true,
  deadline: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  domain: { select: { id: true, slug: true, name: true } },
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
} satisfies Prisma.OpportunitySelect;

/** Visible publiquement : non archivée, auteur actif, date limite non dépassée. */
function openWhere(now: Date): Prisma.OpportunityWhereInput {
  return {
    archivedAt: null,
    author: { status: 'ACTIVE' },
    OR: [{ deadline: null }, { deadline: { gte: now } }],
  };
}

@Injectable()
export class OpportunitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: ListOpportunitiesQuery) {
    const filters: Prisma.OpportunityWhereInput[] = [openWhere(new Date())];
    if (q.type) filters.push({ type: q.type });
    if (q.domain) filters.push({ domain: { slug: q.domain } });
    if (q.remote === 'true') filters.push({ isRemote: true });
    if (q.q) {
      filters.push({
        OR: [
          { title: { contains: q.q, mode: 'insensitive' } },
          { organization: { contains: q.q, mode: 'insensitive' } },
          { description: { contains: q.q, mode: 'insensitive' } },
        ],
      });
    }
    const where: Prisma.OpportunityWhereInput = { AND: filters };
    const [total, items] = await Promise.all([
      this.prisma.opportunity.count({ where }),
      this.prisma.opportunity.findMany({
        where,
        select: opportunitySelect,
        // Les dates limites les plus proches d'abord, puis les opportunités sans échéance.
        orderBy: [{ deadline: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return paginate(items, total, q);
  }

  /** Détail : public si ouverte ; sinon visible seulement de son auteur et des admins. */
  async getOne(id: string, viewer: AuthUser | undefined) {
    const item = await this.prisma.opportunity.findUnique({
      where: { id },
      select: { ...opportunitySelect, authorId: true },
    });
    if (!item) throw notFound('OPPORTUNITY_NOT_FOUND', 'Opportunité introuvable.');
    const isOpen = !item.archivedAt && (!item.deadline || item.deadline >= new Date());
    const canSeeClosed = viewer && (viewer.role === 'ADMIN' || viewer.id === item.authorId);
    if (!isOpen && !canSeeClosed) {
      throw notFound('OPPORTUNITY_NOT_FOUND', 'Cette opportunité n’est plus disponible.');
    }
    const { authorId: _authorId, ...rest } = item;
    return rest;
  }

  /** Opportunités publiées par l'utilisateur, y compris archivées ou expirées. */
  mine(user: AuthUser) {
    return this.prisma.opportunity.findMany({
      where: { authorId: user.id },
      select: opportunitySelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(user: AuthUser, dto: CreateOpportunityDto) {
    const deadline = dto.deadline ? new Date(dto.deadline) : null;
    if (deadline && deadline <= new Date()) {
      throw unprocessable('DEADLINE_IN_PAST', 'La date limite doit être dans le futur.', [
        { field: 'deadline', messages: ['La date limite doit être dans le futur.'] },
      ]);
    }
    await this.assertDomain(dto.domainId);
    return this.prisma.opportunity.create({
      data: {
        authorId: user.id,
        type: dto.type,
        title: dto.title,
        organization: dto.organization,
        description: dto.description,
        location: dto.location ?? null,
        isRemote: dto.isRemote ?? false,
        url: dto.url ?? null,
        deadline,
        domainId: dto.domainId ?? null,
      },
      select: opportunitySelect,
    });
  }

  /** Modification ou archivage : l'auteur ou un administrateur (modération). */
  async update(user: AuthUser, id: string, dto: UpdateOpportunityDto) {
    const item = await this.prisma.opportunity.findUnique({
      where: { id },
      select: { authorId: true },
    });
    if (!item) throw notFound('OPPORTUNITY_NOT_FOUND', 'Opportunité introuvable.');
    if (item.authorId !== user.id && user.role !== 'ADMIN') {
      throw forbidden('NOT_OPPORTUNITY_AUTHOR', 'Seul l’auteur peut modifier cette opportunité.');
    }
    const { archived, deadline, ...fields } = dto;
    return this.prisma.opportunity.update({
      where: { id },
      data: {
        ...fields,
        deadline: deadline === null ? null : deadline ? new Date(deadline) : undefined,
        archivedAt: archived === undefined ? undefined : archived ? new Date() : null,
      },
      select: opportunitySelect,
    });
  }

  private async assertDomain(domainId?: string) {
    if (!domainId) return;
    const exists = await this.prisma.expertiseDomain.count({
      where: { id: domainId, isActive: true },
    });
    if (!exists) throw unprocessable('INVALID_DOMAIN', 'Domaine invalide.');
  }
}

@ApiTags('opportunities')
@Controller('opportunities')
export class OpportunitiesController {
  constructor(private readonly opportunities: OpportunitiesService) {}

  /** Opportunités ouvertes (stages, emplois, appels à projets, bourses, formations, événements). */
  @Public()
  @Get()
  list(@Query() q: ListOpportunitiesQuery) {
    return this.opportunities.list(q);
  }

  @Roles('MENTOR', 'ADMIN')
  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.opportunities.mine(user);
  }

  @Public()
  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: AuthUser | undefined) {
    return this.opportunities.getOne(id, user);
  }

  @Roles('MENTOR', 'ADMIN')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOpportunityDto) {
    return this.opportunities.create(user, dto);
  }

  @Roles('MENTOR', 'ADMIN')
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateOpportunityDto,
  ) {
    return this.opportunities.update(user, id, dto);
  }
}

@Module({ controllers: [OpportunitiesController], providers: [OpportunitiesService] })
export class OpportunitiesModule {}
