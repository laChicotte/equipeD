import { Body, Controller, Get, Injectable, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { PrismaService } from '../../database/prisma.service.js';
import { Roles, CurrentUser } from '../../common/auth/decorators.js';
import { conflict, isConstraintViolation, notFound } from '../../common/errors.js';
import { cleanTags } from '../../common/text.js';
import { recordAudit } from '../../common/audit.js';
import type { AuthUser } from '../../common/auth/auth-user.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateDomainDto {
  /** Identifiant d'URL, en minuscules et tirets (ex. agriculture-agroalimentaire). */
  @Transform(trim)
  @IsString()
  @Length(3, 80)
  @Matches(KEBAB, { message: 'Le slug ne contient que des minuscules, chiffres et tirets.' })
  slug!: string;

  @Transform(trim)
  @IsString()
  @Length(3, 120, { message: 'Le nom doit contenir entre 3 et 120 caractères.' })
  name!: string;

  @Transform(trim)
  @IsString()
  @Length(10, 500, { message: 'La description doit contenir entre 10 et 500 caractères.' })
  description!: string;

  /** Nom d'icône Lucide (ex. sprout, code, compass). */
  @Transform(trim)
  @IsString()
  @Length(2, 40)
  @Matches(KEBAB, { message: 'Nom d’icône Lucide attendu (ex. book-open).' })
  icon!: string;

  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @Length(2, 80, { each: true })
  topics!: string[];
}

export class UpdateDomainDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(3, 120)
  name?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(10, 500)
  description?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(2, 40)
  @Matches(KEBAB)
  icon?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @Length(2, 80, { each: true })
  topics?: string[];

  /** Désactiver retire le domaine du catalogue et des formulaires, sans supprimer l'historique. */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  sortOrder?: number;
}

const domainSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  icon: true,
  topics: true,
  sortOrder: true,
  isActive: true,
  _count: { select: { mentors: true, mentees: true, resources: true } },
} as const;

@Injectable()
export class AdminDomainsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.expertiseDomain.findMany({
      orderBy: { sortOrder: 'asc' },
      select: domainSelect,
    });
  }

  async create(actor: AuthUser, dto: CreateDomainDto) {
    const last = await this.prisma.expertiseDomain.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    try {
      const created = await this.prisma.expertiseDomain.create({
        data: { ...dto, topics: cleanTags(dto.topics), sortOrder: (last?.sortOrder ?? -1) + 1 },
        select: domainSelect,
      });
      await recordAudit(this.prisma, actor, {
        action: 'DOMAIN_CREATED',
        targetType: 'DOMAIN',
        targetId: created.id,
        summary: `Domaine créé : « ${created.name} »`,
      });
      return created;
    } catch (error) {
      if (isConstraintViolation(error)) {
        throw conflict('DOMAIN_SLUG_TAKEN', 'Un domaine utilise déjà ce slug.');
      }
      throw error;
    }
  }

  async update(actor: AuthUser, id: string, dto: UpdateDomainDto) {
    const exists = await this.prisma.expertiseDomain.count({ where: { id } });
    if (!exists) throw notFound('DOMAIN_NOT_FOUND', 'Domaine introuvable.');
    const updated = await this.prisma.expertiseDomain.update({
      where: { id },
      data: { ...dto, topics: dto.topics ? cleanTags(dto.topics) : undefined },
      select: domainSelect,
    });
    const what =
      dto.isActive === false ? 'désactivé' : dto.isActive === true ? 'réactivé' : 'modifié';
    await recordAudit(this.prisma, actor, {
      action: 'DOMAIN_UPDATED',
      targetType: 'DOMAIN',
      targetId: id,
      summary: `Domaine ${what} : « ${updated.name} »`,
    });
    return updated;
  }
}

@ApiTags('admin')
@Roles('ADMIN')
@Controller('admin/domains')
export class AdminDomainsController {
  constructor(private readonly domains: AdminDomainsService) {}

  /** Tous les domaines, y compris inactifs, avec leurs volumes d'usage. */
  @Get()
  list() {
    return this.domains.list();
  }

  @Post()
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateDomainDto) {
    return this.domains.create(actor, dto);
  }

  @Patch(':id')
  update(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: UpdateDomainDto) {
    return this.domains.update(actor, id, dto);
  }
}
