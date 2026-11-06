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
  Put,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
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
import { assertEmailVerified } from '../auth/email-verification.js';
import { MailService } from '../mail/mail.module.js';
import { isStaff, recordAudit } from '../../common/audit.js';
import {
  coverUpload,
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

export class ReviewResourceDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'L’avis contient au plus 1000 caractères.' })
  comment?: string;
}

export class CommentResourceDto {
  @Transform(trim)
  @IsString()
  @Length(2, 2000, { message: 'Le message doit contenir entre 2 et 2000 caractères.' })
  content!: string;

  /** Réponse à une question (un seul niveau de réponses). */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  parentId?: string;
}

const personSelect = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUpdatedAt: true,
  role: true,
} satisfies Prisma.UserSelect;

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
    private readonly mail: MailService,
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
    return paginate(this.withRating(items, await this.ratings(items.map((r) => r.id))), total, q);
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
    if (!staff) await assertEmailVerified(this.prisma, this.mail, user.id);
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
  async download(id: string, viewer: AuthUser | undefined, count = true) {
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
      count &&
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

  /** Notes moyennes d'une liste de ressources (une seule requête). */
  private async ratings(ids: string[]) {
    if (ids.length === 0) return new Map<string, { average: number | null; count: number }>();
    const rows = await this.prisma.resourceReview.groupBy({
      by: ['resourceId'],
      where: { resourceId: { in: ids } },
      _avg: { rating: true },
      _count: { _all: true },
    });
    return new Map(
      rows.map((r) => [
        r.resourceId,
        {
          average: r._avg.rating === null ? null : Math.round(r._avg.rating * 10) / 10,
          count: r._count._all,
        },
      ]),
    );
  }

  private withRating<T extends { id: string }>(
    items: T[],
    ratings: Map<string, { average: number | null; count: number }>,
  ) {
    return items.map((r) => ({ ...r, rating: ratings.get(r.id) ?? { average: null, count: 0 } }));
  }

  /** Ressource de la bibliothèque visible par cette personne, sinon 404. */
  private async visibleLibraryItem(id: string, viewer: AuthUser | undefined) {
    const r = await this.prisma.resource.findUnique({
      where: { id },
      select: {
        ...resourceSelect,
        authorId: true,
        author: { select: { ...resourceSelect.author.select, status: true } },
      },
    });
    if (!r || r.mentorshipId || !this.canSeeLibraryItem(r, viewer)) {
      throw notFound('RESOURCE_NOT_FOUND', 'Ressource introuvable.');
    }
    return r;
  }

  /** Fiche complète : détails, note moyenne, mon avis, droits d'édition. */
  async detail(id: string, viewer: AuthUser | undefined) {
    const r = await this.visibleLibraryItem(id, viewer);
    const [rating, mine] = await Promise.all([
      this.ratings([id]),
      viewer
        ? this.prisma.resourceReview.findUnique({
            where: { resourceId_userId: { resourceId: id, userId: viewer.id } },
            select: { rating: true, comment: true },
          })
        : null,
    ]);
    const { authorId, author, ...rest } = r;
    const { status: _status, ...publicAuthor } = author;
    return {
      ...rest,
      author: publicAuthor,
      rating: rating.get(id) ?? { average: null, count: 0 },
      myReview: mine,
      canEdit: !!viewer && (viewer.id === authorId || isStaff(viewer.role)),
      isAuthor: viewer?.id === authorId,
    };
  }

  /** Couverture ajoutée ou remplacée après publication (auteur ou équipe). */
  async setCover(user: AuthUser, id: string, upload?: UploadedDocument) {
    const r = await this.prisma.resource.findUnique({
      where: { id },
      select: { authorId: true, mentorshipId: true },
    });
    if (!r || r.mentorshipId) throw notFound('RESOURCE_NOT_FOUND', 'Ressource introuvable.');
    if (r.authorId !== user.id && !isStaff(user.role)) {
      throw forbidden(
        'NOT_RESOURCE_AUTHOR',
        'Seul l’auteur ou l’équipe peut changer la couverture.',
      );
    }
    if (!upload) {
      await this.prisma.resourceCover.deleteMany({ where: { resourceId: id } });
      return { ok: true };
    }
    const cover = readUploadedCover(upload);
    await this.prisma.resourceCover.upsert({
      where: { resourceId: id },
      create: { resourceId: id, ...cover },
      update: { ...cover, createdAt: new Date() },
    });
    return { ok: true };
  }

  async reviews(id: string, viewer: AuthUser | undefined) {
    await this.visibleLibraryItem(id, viewer);
    return this.prisma.resourceReview.findMany({
      where: { resourceId: id },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        updatedAt: true,
        user: { select: personSelect },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }

  /** Une note par personne (modifiable) ; jamais sur sa propre ressource. */
  async rate(user: AuthUser, id: string, dto: ReviewResourceDto) {
    const r = await this.visibleLibraryItem(id, user);
    if (r.status !== 'PUBLISHED') {
      throw conflict('RESOURCE_NOT_PUBLISHED', 'Cette ressource n’est pas encore publiée.');
    }
    if (r.authorId === user.id) {
      throw forbidden('OWN_RESOURCE', 'Vous ne pouvez pas noter votre propre ressource.');
    }
    await this.prisma.resourceReview.upsert({
      where: { resourceId_userId: { resourceId: id, userId: user.id } },
      create: { resourceId: id, userId: user.id, rating: dto.rating, comment: dto.comment ?? null },
      update: { rating: dto.rating, comment: dto.comment ?? null },
    });
    return this.detail(id, user);
  }

  async deleteReview(user: AuthUser, id: string) {
    await this.prisma.resourceReview.deleteMany({ where: { resourceId: id, userId: user.id } });
    return { ok: true };
  }

  async comments(id: string, viewer: AuthUser | undefined) {
    const r = await this.visibleLibraryItem(id, viewer);
    const rows = await this.prisma.resourceComment.findMany({
      where: { resourceId: id },
      select: {
        id: true,
        parentId: true,
        content: true,
        createdAt: true,
        author: { select: personSelect },
      },
      orderBy: { createdAt: 'asc' },
      take: 300,
    });
    const shape = (c: (typeof rows)[number]) => ({
      ...c,
      isResourceAuthor: c.author.id === r.authorId,
    });
    return rows
      .filter((c) => !c.parentId)
      .reverse()
      .map((c) => ({
        ...shape(c),
        replies: rows.filter((x) => x.parentId === c.id).map(shape),
      }));
  }

  /** Question ou réponse : la personne qui a partagé la ressource est prévenue. */
  async comment(user: AuthUser, id: string, dto: CommentResourceDto) {
    const r = await this.visibleLibraryItem(id, user);
    if (r.status !== 'PUBLISHED') {
      throw conflict('RESOURCE_NOT_PUBLISHED', 'Cette ressource n’est pas encore publiée.');
    }
    let parentAuthorId: string | null = null;
    if (dto.parentId) {
      const parent = await this.prisma.resourceComment.findFirst({
        where: { id: dto.parentId, resourceId: id, parentId: null },
        select: { authorId: true },
      });
      if (!parent) throw notFound('COMMENT_NOT_FOUND', 'Question introuvable.');
      parentAuthorId = parent.authorId;
    }
    const created = await this.prisma.resourceComment.create({
      data: {
        resourceId: id,
        authorId: user.id,
        parentId: dto.parentId ?? null,
        content: dto.content,
      },
      select: { id: true },
    });
    const who = `${user.firstName} ${user.lastName}`;
    const link = `/ressources/${id}#discussion`;
    const targets = new Set<string>();
    if (r.authorId !== user.id) targets.add(r.authorId);
    if (parentAuthorId && parentAuthorId !== user.id) targets.add(parentAuthorId);
    for (const userId of targets) {
      await this.notifications.notify({
        userId,
        type: 'RESOURCE_COMMENT',
        title:
          userId === r.authorId && !dto.parentId
            ? `${who} pose une question sur « ${r.title} »`
            : `${who} a répondu à propos de « ${r.title} »`,
        body: dto.content,
        link,
      });
    }
    return created;
  }

  /** Suppression : l'auteur du message, la personne qui a partagé la ressource ou l'équipe. */
  async deleteComment(user: AuthUser, commentId: string) {
    const c = await this.prisma.resourceComment.findUnique({
      where: { id: commentId },
      select: { authorId: true, resource: { select: { authorId: true } } },
    });
    if (!c) throw notFound('COMMENT_NOT_FOUND', 'Message introuvable.');
    if (c.authorId !== user.id && c.resource.authorId !== user.id && !isStaff(user.role)) {
      throw forbidden('NOT_COMMENT_AUTHOR', 'Vous ne pouvez pas supprimer ce message.');
    }
    await this.prisma.resourceComment.delete({ where: { id: commentId } });
    return { ok: true };
  }

  /** Lecture dans la plateforme : uniquement les PDF et les images. */
  async view(id: string, viewer: AuthUser | undefined) {
    const file = await this.download(id, viewer, false);
    if (file.mimeType !== 'application/pdf' && !file.mimeType.startsWith('image/')) {
      throw unprocessable('NOT_VIEWABLE', 'Ce document se lit après téléchargement.');
    }
    return file;
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

  /** Fiche détaillée d'une ressource de la bibliothèque (note moyenne, mon avis). */
  @Public()
  @Get('resources/:id')
  detail(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.resources.detail(id, req.user);
  }

  /** Lecture dans la plateforme (PDF ou image, affiché dans la liseuse). */
  @Public()
  @Get('resources/:id/view')
  async view(@Param('id') id: string, @Req() req: AuthenticatedRequest, @Res() res: Response) {
    const file = await this.resources.view(id, req.user);
    res
      .status(200)
      .type(file.mimeType)
      .set({
        'Content-Disposition': 'inline',
        'Content-Length': String(file.size),
        'Cache-Control': file.isPublic ? 'public, max-age=300' : 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Cross-Origin-Resource-Policy': 'same-origin',
      })
      .send(Buffer.from(file.data));
  }

  /** Couverture ajoutée ou remplacée après publication (multipart « cover » ; vide : retirée). */
  @Put('resources/:id/cover')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(coverUpload())
  setCover(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @UploadedFile() cover?: UploadedDocument,
  ) {
    return this.resources.setCover(user, id, cover);
  }

  @Public()
  @Get('resources/:id/reviews')
  reviews(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.resources.reviews(id, req.user);
  }

  @Put('resources/:id/review')
  rate(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReviewResourceDto) {
    return this.resources.rate(user, id, dto);
  }

  @Delete('resources/:id/review')
  deleteReview(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.resources.deleteReview(user, id);
  }

  @Public()
  @Get('resources/:id/comments')
  comments(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.resources.comments(id, req.user);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('resources/:id/comments')
  comment(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CommentResourceDto) {
    return this.resources.comment(user, id, dto);
  }

  @Delete('resource-comments/:id')
  deleteComment(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.resources.deleteComment(user, id);
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
