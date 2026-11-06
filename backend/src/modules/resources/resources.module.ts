import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Module,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
} from 'class-validator';
import { PrismaService } from '../../database/prisma.service.js';
import { CurrentUser, Public, Roles } from '../../common/auth/decorators.js';
import type { AuthenticatedRequest, AuthUser } from '../../common/auth/auth-user.js';
import { conflict, forbidden, notFound, unprocessable } from '../../common/errors.js';
import { paginate, PaginationQuery } from '../../common/pagination.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { ResourceKind, ResourceStatus } from '../../generated/prisma/enums.js';
import { MentorshipAccessService } from '../mentorships/mentorship-access.service.js';
import { NotificationsService } from '../notifications/notifications.module.js';
import { isStaff, recordAudit } from '../../common/audit.js';
import {
  documentUpload,
  libraryUpload,
  readUploadedCover,
  readUploadedDocument,
  RESOURCE_FILE_MAX_BYTES,
  sendStoredFile,
  type UploadedDocument,
} from './resource-file.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const v = value.trim();
  return v === '' ? undefined : v;
};
/** Formulaire multipart : les booléens arrivent en texte (« true »). */
const toBoolean = ({ value }: { value: unknown }) =>
  value === true || value === 'true' || value === '1' || value === 'on';

export const RESOURCE_LICENSES = ['AUTHOR', 'PERMISSION', 'CC', 'PUBLIC_DOMAIN'] as const;

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

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  domainId?: string;

  /** Auteur de l'œuvre (livre, guide) quand ce n'est pas la personne qui publie. */
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  workAuthor?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  language?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsIn(RESOURCE_LICENSES, { message: 'Licence inconnue.' })
  license?: (typeof RESOURCE_LICENSES)[number];

  /** Déclaration obligatoire pour un document de la bibliothèque. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  rightsConfirmed?: boolean;
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

export class ReviewQuery extends PaginationQuery {
  @IsOptional()
  @IsEnum(ResourceStatus)
  status: ResourceStatus = 'PENDING';
}

export class RejectResourceDto {
  @Transform(trim)
  @IsString()
  @Length(10, 500, { message: 'Expliquez le refus en 10 à 500 caractères.' })
  note!: string;
}

const resourceSelect = {
  id: true,
  mentorshipId: true,
  kind: true,
  title: true,
  description: true,
  url: true,
  status: true,
  workAuthor: true,
  language: true,
  license: true,
  reviewNote: true,
  reviewedAt: true,
  downloadCount: true,
  createdAt: true,
  file: { select: { fileName: true, mimeType: true, size: true } },
  cover: { select: { createdAt: true } },
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

type Upload = { file?: UploadedDocument[]; cover?: UploadedDocument[] } | undefined;

@Injectable()
export class ResourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: MentorshipAccessService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Bibliothèque publique : uniquement les ressources validées. */
  async library(q: ListResourcesQuery) {
    const where: Prisma.ResourceWhereInput = {
      mentorshipId: null,
      status: 'PUBLISHED',
      author: { status: 'ACTIVE' },
      ...(q.kind ? { kind: q.kind } : {}),
      ...(q.domain ? { domain: { slug: q.domain } } : {}),
      ...(q.q
        ? {
            OR: [
              { title: { contains: q.q, mode: 'insensitive' } },
              { description: { contains: q.q, mode: 'insensitive' } },
              { workAuthor: { contains: q.q, mode: 'insensitive' } },
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

  /** Publications de la personne connectée dans la bibliothèque, quel que soit leur statut. */
  mine(user: AuthUser) {
    return this.prisma.resource.findMany({
      where: { authorId: user.id, mentorshipId: null },
      select: resourceSelect,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /**
   * Publication dans la bibliothèque. Un document déposé par un mentor attend la validation de
   * l'équipe ; un lien ou un conseil rédigé est publié aussitôt ; l'équipe publie directement.
   */
  async publish(user: AuthUser, dto: CreateResourceDto, upload?: Upload) {
    const staff = isStaff(user.role);
    const file = upload?.file?.[0] ? readUploadedDocument(upload.file[0]) : null;
    const cover = upload?.cover?.[0] ? readUploadedCover(upload.cover[0]) : null;
    if (file && !staff && file.size > RESOURCE_FILE_MAX_BYTES) {
      throw unprocessable('FILE_TOO_LARGE', 'Le document dépasse 10 Mo.', [
        { field: 'file', messages: ['10 Mo au plus pour un document.'] },
      ]);
    }
    if (file && (!dto.rightsConfirmed || !dto.license)) {
      throw unprocessable(
        'RIGHTS_REQUIRED',
        'Indiquez la licence du document et confirmez que vous avez le droit de le diffuser.',
        [
          ...(!dto.license ? [{ field: 'license', messages: ['Choisissez une licence.'] }] : []),
          ...(!dto.rightsConfirmed
            ? [{ field: 'rightsConfirmed', messages: ['Cette confirmation est obligatoire.'] }]
            : []),
        ],
      );
    }
    const data = await this.validate(dto, !!file);
    const status: ResourceStatus = file && !staff ? 'PENDING' : 'PUBLISHED';
    const created = await this.prisma.resource.create({
      data: {
        ...data,
        workAuthor: dto.workAuthor ?? null,
        language: dto.language ?? null,
        license: dto.license ?? null,
        rightsConfirmed: dto.rightsConfirmed ?? false,
        status,
        authorId: user.id,
        mentorshipId: null,
        ...(file ? { hasFile: true, file: { create: file } } : {}),
        ...(cover ? { cover: { create: cover } } : {}),
      },
      select: resourceSelect,
    });
    if (status === 'PENDING') {
      const admins = await this.prisma.user.findMany({
        where: { role: 'ADMIN', status: 'ACTIVE' },
        select: { id: true },
      });
      for (const a of admins) {
        await this.notifications.notify({
          userId: a.id,
          type: 'RESOURCE_SUBMITTED',
          title: `Ressource à valider : « ${created.title} »`,
          body: `Proposée par ${user.firstName} ${user.lastName}.`,
          link: '/admin/contenus',
        });
      }
    }
    return created;
  }

  /** File de validation de l'équipe. */
  async review(q: ReviewQuery) {
    const where: Prisma.ResourceWhereInput = { mentorshipId: null, status: q.status };
    const [total, items] = await Promise.all([
      this.prisma.resource.count({ where }),
      this.prisma.resource.findMany({
        where,
        select: { ...resourceSelect, rightsConfirmed: true },
        orderBy: { createdAt: q.status === 'PENDING' ? 'asc' : 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return paginate(items, total, q);
  }

  async decide(admin: AuthUser, id: string, approve: boolean, note?: string) {
    const resource = await this.prisma.resource.findUnique({
      where: { id },
      select: { status: true, title: true, authorId: true, mentorshipId: true },
    });
    if (!resource || resource.mentorshipId) {
      throw notFound('RESOURCE_NOT_FOUND', 'Ressource introuvable.');
    }
    if (resource.status !== 'PENDING') {
      throw conflict('RESOURCE_ALREADY_REVIEWED', 'Cette ressource a déjà été examinée.');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const r = await tx.resource.update({
        where: { id },
        data: {
          status: approve ? 'PUBLISHED' : 'REJECTED',
          reviewNote: approve ? null : (note ?? null),
          reviewedAt: new Date(),
        },
        select: resourceSelect,
      });
      await recordAudit(tx, admin, {
        action: approve ? 'RESOURCE_APPROVED' : 'RESOURCE_REJECTED',
        targetType: 'RESOURCE',
        targetId: id,
        summary: `${approve ? 'Ressource publiée' : 'Ressource refusée'} : « ${resource.title} »`,
      });
      return r;
    });
    await this.notifications.notify({
      userId: resource.authorId,
      type: approve ? 'RESOURCE_APPROVED' : 'RESOURCE_REJECTED',
      title: approve
        ? `Votre ressource « ${resource.title} » est publiée`
        : `Votre ressource « ${resource.title} » n’a pas été publiée`,
      body: approve ? 'Elle est maintenant visible dans la bibliothèque.' : note,
      link: '/ressources',
    });
    return updated;
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
  async shareInMentorship(
    user: AuthUser,
    mentorshipId: string,
    dto: CreateResourceDto,
    upload?: UploadedDocument,
  ) {
    const access = await this.access.assertActiveParticipant(user, mentorshipId);
    const file = upload ? readUploadedDocument(upload) : null;
    const data = await this.validate(dto, !!file);
    const resource = await this.prisma.resource.create({
      data: {
        ...data,
        authorId: user.id,
        mentorshipId,
        ...(file ? { hasFile: true, file: { create: file } } : {}),
      },
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
      select: { authorId: true, mentorshipId: true, title: true },
    });
    if (!resource) throw notFound('RESOURCE_NOT_FOUND', 'Ressource introuvable.');
    if (resource.mentorshipId) {
      // Ressource privée : on ne révèle son existence qu'aux participants.
      await this.access.assertParticipant(user, resource.mentorshipId);
    }
    const isModerator = isStaff(user.role) && resource.mentorshipId === null;
    if (resource.authorId !== user.id && !isModerator) {
      throw forbidden('NOT_RESOURCE_AUTHOR', 'Seul l’auteur peut supprimer cette ressource.');
    }
    await this.prisma.resource.delete({ where: { id } });
    if (resource.authorId !== user.id) {
      await recordAudit(this.prisma, user, {
        action: 'RESOURCE_REMOVED',
        targetType: 'RESOURCE',
        targetId: id,
        summary: `Ressource publique retirée : « ${resource.title} »`,
      });
    }
    return { ok: true };
  }

  /** Une ressource de la bibliothèque non publiée n'est visible que de son auteur et de l'équipe. */
  private canSeeLibraryItem(
    r: { status: ResourceStatus; authorId: string; author: { status: string } },
    viewer: AuthUser | undefined,
  ) {
    if (viewer && (isStaff(viewer.role) || viewer.id === r.authorId)) return true;
    return r.status === 'PUBLISHED' && r.author.status === 'ACTIVE';
  }

  /**
   * Document joint : celui d'une ressource partagée dans un mentorat n'est visible que de ses
   * deux participants ; celui de la bibliothèque est public une fois validé.
   */
  async download(id: string, viewer: AuthUser | undefined) {
    const resource = await this.prisma.resource.findUnique({
      where: { id },
      select: {
        mentorshipId: true,
        status: true,
        authorId: true,
        author: { select: { status: true } },
        file: { select: { fileName: true, mimeType: true, size: true, data: true } },
      },
    });
    const missing = notFound('RESOURCE_FILE_NOT_FOUND', 'Document introuvable.');
    if (!resource?.file) throw missing;
    if (resource.mentorshipId) {
      if (!viewer) throw missing;
      try {
        await this.access.assertParticipant(viewer, resource.mentorshipId);
      } catch {
        throw missing; // on ne révèle pas l'existence d'un document privé
      }
    } else if (!this.canSeeLibraryItem(resource, viewer)) {
      throw missing;
    }
    // Compteur d'impact : téléchargements de la bibliothèque, hors auteur et équipe.
    if (
      !resource.mentorshipId &&
      resource.status === 'PUBLISHED' &&
      viewer?.id !== resource.authorId &&
      !isStaff(viewer?.role)
    ) {
      await this.prisma.resource.update({
        where: { id },
        data: { downloadCount: { increment: 1 } },
        select: { id: true },
      });
    }
    return {
      ...resource.file,
      isPublic: !resource.mentorshipId && resource.status === 'PUBLISHED',
    };
  }

  async cover(id: string, viewer: AuthUser | undefined) {
    const resource = await this.prisma.resource.findUnique({
      where: { id },
      select: {
        mentorshipId: true,
        status: true,
        authorId: true,
        author: { select: { status: true } },
        cover: { select: { mimeType: true, size: true, data: true } },
      },
    });
    if (!resource?.cover || resource.mentorshipId || !this.canSeeLibraryItem(resource, viewer)) {
      throw notFound('RESOURCE_COVER_NOT_FOUND', 'Couverture introuvable.');
    }
    return {
      ...resource.cover,
      fileName: 'couverture',
      isPublic: resource.status === 'PUBLISHED',
    };
  }

  private async validate(dto: CreateResourceDto, hasFile = false) {
    if (!dto.url && !dto.description && !hasFile) {
      throw unprocessable(
        'RESOURCE_EMPTY',
        'Ajoutez un document, un lien ou un contenu à la ressource.',
        [{ field: 'url', messages: ['Joignez un document, un lien ou une description.'] }],
      );
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

  /** Bibliothèque publique de ressources validées. */
  @Public()
  @Get('resources')
  library(@Query() q: ListResourcesQuery) {
    return this.resources.library(q);
  }

  /** Mes publications dans la bibliothèque, avec leur statut de validation. */
  @Roles('MENTOR', 'ADMIN')
  @Get('resources/mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.resources.mine(user);
  }

  @Roles('MENTOR', 'ADMIN')
  @Post('resources')
  publish(@CurrentUser() user: AuthUser, @Body() dto: CreateResourceDto) {
    return this.resources.publish(user, dto);
  }

  /** Publication avec document et/ou couverture (multipart : champs + « file » + « cover »). */
  @Roles('MENTOR', 'ADMIN')
  @Post('resources/upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(libraryUpload())
  publishWithFile(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateResourceDto,
    @UploadedFiles() files?: Upload,
  ) {
    return this.resources.publish(user, dto, files);
  }

  /** File de validation (équipe) : ressources en attente, publiées ou refusées. */
  @Roles('ADMIN')
  @Get('admin/resources')
  review(@Query() q: ReviewQuery) {
    return this.resources.review(q);
  }

  @Roles('ADMIN')
  @HttpCode(200)
  @Post('admin/resources/:id/approve')
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.resources.decide(user, id, true);
  }

  @Roles('ADMIN')
  @HttpCode(200)
  @Post('admin/resources/:id/reject')
  reject(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RejectResourceDto) {
    return this.resources.decide(user, id, false, dto.note);
  }

  /** Téléchargement du document joint (toujours en pièce jointe, jamais affiché dans la page). */
  @Public()
  @Get('resources/:id/file')
  async download(@Param('id') id: string, @Req() req: AuthenticatedRequest, @Res() res: Response) {
    const file = await this.resources.download(id, req.user);
    sendStoredFile(res, file, { isPublic: file.isPublic });
  }

  /** Couverture de la ressource (image affichée dans la bibliothèque). */
  @Public()
  @Get('resources/:id/cover')
  async cover(@Param('id') id: string, @Req() req: AuthenticatedRequest, @Res() res: Response) {
    const cover = await this.resources.cover(id, req.user);
    sendStoredFile(res, cover, { inline: true, isPublic: cover.isPublic });
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

  /** Partage privé avec document joint (multipart : champs de la ressource + « file »). */
  @Post('mentorships/:mentorshipId/resources/upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(documentUpload())
  shareWithFile(
    @CurrentUser() user: AuthUser,
    @Param('mentorshipId') id: string,
    @Body() dto: CreateResourceDto,
    @UploadedFile() file?: UploadedDocument,
  ) {
    return this.resources.shareInMentorship(user, id, dto, file);
  }
}

@Module({ controllers: [ResourcesController], providers: [ResourcesService] })
export class ResourcesModule {}
