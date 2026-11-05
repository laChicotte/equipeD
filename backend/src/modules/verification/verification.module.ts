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
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUrl, Length, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { PrismaService } from '../../database/prisma.service.js';
import { CurrentUser, Roles } from '../../common/auth/decorators.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { recordAudit } from '../../common/audit.js';
import { conflict, isConstraintViolation, notFound, unprocessable } from '../../common/errors.js';
import { cleanTags } from '../../common/text.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { VerificationKind, VerificationRequestStatus } from '../../generated/prisma/enums.js';
import { NotificationsService } from '../notifications/notifications.module.js';
import { UpsertMentorProfileDto } from '../profile/profile.dto.js';
import { mentorSearchText } from '../profile/profile.service.js';
import {
  documentUpload,
  readUploadedDocument,
  sendStoredFile,
  type UploadedDocument,
} from '../resources/resource-file.js';

/** Justificatifs par demande. */
export const MAX_VERIFICATION_DOCUMENTS = 3;
const PROOF_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

class VerificationFields {
  /** Parcours, expériences vérifiables, références : ce que l'équipe doit savoir. */
  @Transform(trim)
  @IsString()
  @Length(30, 2000, { message: 'Présentez votre démarche en 30 à 2000 caractères.' })
  message!: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    { message: 'Le lien de profil doit être une adresse https.' },
  )
  @MaxLength(300)
  profileUrl?: string;
}

/** Demande de vérification d'un profil mentor existant. */
export class MentorVerificationDto extends VerificationFields {}

/** Candidature d'un mentoré : profil mentor complet + motivation. */
export class MentorApplicationDto extends UpsertMentorProfileDto {
  @Transform(trim)
  @IsString()
  @Length(30, 2000, { message: 'Expliquez votre motivation en 30 à 2000 caractères.' })
  message!: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    { message: 'Le lien de profil doit être une adresse https.' },
  )
  @MaxLength(300)
  profileUrl?: string;
}

export class DecisionDto {
  /** Facultatif pour une validation, obligatoire (10 caractères au moins) pour un refus. */
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Le motif contient au plus 1000 caractères.' })
  note?: string;
}

export class ListVerificationsQuery {
  @IsOptional()
  @IsEnum(VerificationRequestStatus)
  status?: VerificationRequestStatus;

  @IsOptional()
  @IsEnum(VerificationKind)
  kind?: VerificationKind;
}

const documentMeta = { id: true, fileName: true, mimeType: true, size: true, createdAt: true };

const requestSelect = {
  id: true,
  kind: true,
  status: true,
  message: true,
  profileUrl: true,
  decisionNote: true,
  decidedAt: true,
  createdAt: true,
  documents: { select: documentMeta, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.VerificationRequestSelect;

@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ─── Côté demandeur ──────────────────────────────────────────────────────

  /** Demandes de la personne (la plus récente d'abord) et état de son profil mentor. */
  async mine(user: AuthUser) {
    const [requests, profile] = await Promise.all([
      this.prisma.verificationRequest.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: requestSelect,
      }),
      this.prisma.mentorProfile.findUnique({
        where: { userId: user.id },
        select: { verificationStatus: true, isPublished: true },
      }),
    ]);
    return { requests, mentorProfile: profile };
  }

  private async assertNoPending(userId: string) {
    const pending = await this.prisma.verificationRequest.count({
      where: { userId, status: 'PENDING' },
    });
    if (pending) {
      throw conflict(
        'VERIFICATION_ALREADY_PENDING',
        'Une demande est déjà en cours d’examen : attendez la réponse de l’équipe.',
      );
    }
  }

  private pendingConflict(error: unknown): never {
    if (isConstraintViolation(error, 'verification_requests_one_pending_per_user')) {
      throw conflict(
        'VERIFICATION_ALREADY_PENDING',
        'Une demande est déjà en cours d’examen : attendez la réponse de l’équipe.',
      );
    }
    throw error;
  }

  /** Un mentor demande la vérification de son profil. */
  async requestMentorVerification(user: AuthUser, dto: MentorVerificationDto) {
    const profile = await this.prisma.mentorProfile.findUnique({
      where: { userId: user.id },
      select: { verificationStatus: true },
    });
    if (!profile) {
      throw conflict('MENTOR_PROFILE_REQUIRED', 'Complétez d’abord votre profil mentor.');
    }
    if (profile.verificationStatus === 'VERIFIED') {
      throw conflict('ALREADY_VERIFIED', 'Votre profil est déjà vérifié.');
    }
    await this.assertNoPending(user.id);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const request = await tx.verificationRequest.create({
          data: {
            userId: user.id,
            kind: 'MENTOR_VERIFICATION',
            message: dto.message,
            profileUrl: dto.profileUrl ?? null,
          },
          select: requestSelect,
        });
        await tx.mentorProfile.update({
          where: { userId: user.id },
          data: { verificationStatus: 'PENDING' },
        });
        return request;
      });
    } catch (error) {
      this.pendingConflict(error);
    }
  }

  /**
   * Un mentoré candidate pour devenir mentor : son profil mentor est enregistré sans être publié,
   * puis examiné par l'équipe. Il reste mentoré tant que la candidature n'est pas acceptée.
   */
  async applyAsMentor(user: AuthUser, dto: MentorApplicationDto) {
    await this.assertNoPending(user.id);
    const domainIds = [...new Set(dto.domainIds)];
    const domains = await this.prisma.expertiseDomain.findMany({
      where: { id: { in: domainIds }, isActive: true },
      select: { id: true, name: true, topics: true },
    });
    if (domains.length !== domainIds.length) {
      throw unprocessable(
        'INVALID_DOMAIN',
        'Un ou plusieurs domaines sélectionnés sont invalides.',
      );
    }
    const expertise = cleanTags(dto.expertise);
    const data = {
      headline: dto.headline,
      bio: dto.bio,
      currentPosition: dto.currentPosition ?? null,
      organization: dto.organization ?? null,
      yearsExperience: dto.yearsExperience,
      expertise,
      languages: cleanTags(dto.languages),
      modalities: [...new Set(dto.modalities)],
      city: dto.city ?? null,
      sessionDurationMin: dto.sessionDurationMin,
      searchText: mentorSearchText({
        firstName: user.firstName,
        lastName: user.lastName,
        headline: dto.headline,
        currentPosition: dto.currentPosition,
        organization: dto.organization,
        city: dto.city,
        expertise,
        domains,
      }),
      // Jamais visible dans l'annuaire avant la décision de l'équipe.
      isPublished: false,
      verificationStatus: 'PENDING' as const,
    };
    try {
      return await this.prisma.$transaction(async (tx) => {
        const profile = await tx.mentorProfile.upsert({
          where: { userId: user.id },
          create: { userId: user.id, ...data },
          update: data,
          select: { id: true },
        });
        await tx.mentorDomain.deleteMany({ where: { mentorProfileId: profile.id } });
        await tx.mentorDomain.createMany({
          data: domainIds.map((domainId) => ({ mentorProfileId: profile.id, domainId })),
        });
        return tx.verificationRequest.create({
          data: {
            userId: user.id,
            kind: 'MENTOR_APPLICATION',
            message: dto.message,
            profileUrl: dto.profileUrl ?? null,
          },
          select: requestSelect,
        });
      });
    } catch (error) {
      this.pendingConflict(error);
    }
  }

  /** Ajout d'un justificatif (PDF ou image) à sa propre demande en attente. */
  async addDocument(user: AuthUser, requestId: string, upload?: UploadedDocument) {
    const request = await this.prisma.verificationRequest.findUnique({
      where: { id: requestId },
      select: { userId: true, status: true, _count: { select: { documents: true } } },
    });
    if (!request || request.userId !== user.id) {
      throw notFound('VERIFICATION_NOT_FOUND', 'Demande introuvable.');
    }
    if (request.status !== 'PENDING') {
      throw conflict('VERIFICATION_CLOSED', 'Cette demande a déjà été traitée.');
    }
    if (request._count.documents >= MAX_VERIFICATION_DOCUMENTS) {
      throw conflict(
        'TOO_MANY_DOCUMENTS',
        `${MAX_VERIFICATION_DOCUMENTS} justificatifs au maximum par demande.`,
      );
    }
    if (!upload) {
      throw unprocessable('FILE_REQUIRED', 'Choisissez un justificatif.', [
        { field: 'file', messages: ['Choisissez un justificatif.'] },
      ]);
    }
    const file = readUploadedDocument(upload);
    if (!PROOF_TYPES.has(file.mimeType)) {
      throw unprocessable('FILE_INVALID_TYPE', 'Justificatif attendu : PDF, JPEG, PNG ou WebP.', [
        { field: 'file', messages: ['Justificatif attendu : PDF, JPEG, PNG ou WebP.'] },
      ]);
    }
    return this.prisma.verificationDocument.create({
      data: { requestId, ...file },
      select: documentMeta,
    });
  }

  /** Retrait de sa demande tant qu'elle n'est pas traitée. */
  async withdraw(user: AuthUser, requestId: string) {
    const request = await this.prisma.verificationRequest.findUnique({
      where: { id: requestId },
      select: { userId: true, status: true, kind: true },
    });
    if (!request || request.userId !== user.id) {
      throw notFound('VERIFICATION_NOT_FOUND', 'Demande introuvable.');
    }
    if (request.status !== 'PENDING') {
      throw conflict('VERIFICATION_CLOSED', 'Cette demande a déjà été traitée.');
    }
    await this.prisma.$transaction([
      this.prisma.verificationRequest.update({
        where: { id: requestId },
        data: { status: 'WITHDRAWN' },
      }),
      this.prisma.mentorProfile.updateMany({
        where: { userId: user.id, verificationStatus: 'PENDING' },
        data: { verificationStatus: 'UNVERIFIED' },
      }),
    ]);
    return { ok: true };
  }

  /** Justificatif : la personne concernée ou un administrateur (404 pour les autres). */
  async document(viewer: AuthUser, documentId: string) {
    const doc = await this.prisma.verificationDocument.findUnique({
      where: { id: documentId },
      select: {
        fileName: true,
        mimeType: true,
        size: true,
        data: true,
        request: { select: { userId: true } },
      },
    });
    if (!doc || (doc.request.userId !== viewer.id && viewer.role !== 'ADMIN')) {
      throw notFound('FILE_NOT_FOUND', 'Fichier introuvable.');
    }
    return doc;
  }

  // ─── Côté équipe ─────────────────────────────────────────────────────────

  async list(q: ListVerificationsQuery) {
    const status = q.status ?? 'PENDING';
    const rows = await this.prisma.verificationRequest.findMany({
      where: { status, ...(q.kind ? { kind: q.kind } : {}) },
      // En attente : les plus anciennes d'abord (file d'attente) ; sinon les plus récentes.
      orderBy: { createdAt: status === 'PENDING' ? 'asc' : 'desc' },
      take: 100,
      select: {
        ...requestSelect,
        decidedBy: { select: { firstName: true, lastName: true } },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            status: true,
            avatarUpdatedAt: true,
            createdAt: true,
            mentorProfile: {
              select: {
                headline: true,
                bio: true,
                currentPosition: true,
                organization: true,
                yearsExperience: true,
                expertise: true,
                languages: true,
                modalities: true,
                city: true,
                verificationStatus: true,
                isPublished: true,
                domains: { select: { domain: { select: { id: true, name: true } } } },
              },
            },
          },
        },
      },
    });
    // Historique utile à la décision : accompagnements suivis en tant que mentoré.
    const ids = rows.map((r) => r.user.id);
    const [asMentee, certificates, active] = await Promise.all([
      this.prisma.mentorship.groupBy({
        by: ['menteeId'],
        where: { menteeId: { in: ids }, status: 'COMPLETED' },
        _count: { _all: true },
      }),
      this.prisma.mentorshipCertificate.groupBy({
        by: ['menteeId'],
        where: { menteeId: { in: ids }, revokedAt: null },
        _count: { _all: true },
      }),
      this.prisma.mentorship.groupBy({
        by: ['menteeId'],
        where: { menteeId: { in: ids }, status: 'ACTIVE' },
        _count: { _all: true },
      }),
    ]);
    const count = (list: { menteeId: string; _count: { _all: number } }[], id: string) =>
      list.find((x) => x.menteeId === id)?._count._all ?? 0;
    return rows.map(({ user, ...r }) => {
      const { mentorProfile, ...person } = user;
      return {
        ...r,
        user: person,
        mentorProfile: mentorProfile
          ? {
              ...mentorProfile,
              domains: mentorProfile.domains.map((d) => d.domain),
            }
          : null,
        history: {
          completedMentorshipsAsMentee: count(asMentee, user.id),
          certificatesAsMentee: count(certificates, user.id),
          activeMentorshipsAsMentee: count(active, user.id),
        },
      };
    });
  }

  private async pending(id: string) {
    const request = await this.prisma.verificationRequest.findUnique({
      where: { id },
      select: {
        id: true,
        kind: true,
        status: true,
        userId: true,
        user: { select: { firstName: true, lastName: true, role: true, status: true } },
      },
    });
    if (!request) throw notFound('VERIFICATION_NOT_FOUND', 'Demande introuvable.');
    if (request.status !== 'PENDING') {
      throw conflict('VERIFICATION_CLOSED', 'Cette demande a déjà été traitée.');
    }
    return request;
  }

  /**
   * Validation :
   *  - vérification : le profil mentor reçoit le badge « Profil vérifié » ;
   *  - candidature : la personne devient mentor, son profil est publié et vérifié. Elle ne doit
   *    plus avoir de mentorat en cours en tant que mentorée ; ses demandes en attente sont annulées.
   */
  async approve(admin: AuthUser, id: string, dto: DecisionDto) {
    const request = await this.pending(id);
    const name = `${request.user.firstName} ${request.user.lastName}`;
    const now = new Date();

    if (request.kind === 'MENTOR_APPLICATION') {
      if (request.user.role !== 'MENTEE' || request.user.status !== 'ACTIVE') {
        throw conflict('APPLICANT_NOT_ELIGIBLE', 'Ce compte n’est plus un compte mentoré actif.');
      }
      const active = await this.prisma.mentorship.count({
        where: { menteeId: request.userId, status: 'ACTIVE' },
      });
      if (active > 0) {
        throw conflict(
          'USER_HAS_ACTIVE_MENTORING',
          'Cette personne suit encore un mentorat en tant que mentorée : il doit être clôturé avant qu’elle devienne mentor.',
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const closed = await tx.verificationRequest.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status: 'APPROVED',
          decisionNote: dto.note ?? null,
          decidedById: admin.id,
          decidedAt: now,
        },
      });
      if (closed.count === 0) {
        throw conflict('VERIFICATION_CLOSED', 'Cette demande a déjà été traitée.');
      }
      if (request.kind === 'MENTOR_APPLICATION') {
        await tx.mentorshipRequest.updateMany({
          where: { menteeId: request.userId, status: 'PENDING' },
          data: { status: 'CANCELLED', respondedAt: now },
        });
        await tx.user.update({ where: { id: request.userId }, data: { role: 'MENTOR' } });
        await tx.mentorProfile.update({
          where: { userId: request.userId },
          data: { isPublished: true, verificationStatus: 'VERIFIED' },
        });
      } else {
        await tx.mentorProfile.update({
          where: { userId: request.userId },
          data: { verificationStatus: 'VERIFIED' },
        });
      }
      await recordAudit(tx, admin, {
        action:
          request.kind === 'MENTOR_APPLICATION'
            ? 'MENTOR_APPLICATION_APPROVED'
            : 'VERIFICATION_APPROVED',
        targetType: 'USER',
        targetId: request.userId,
        summary:
          request.kind === 'MENTOR_APPLICATION'
            ? `${name} devient mentor (candidature acceptée)`
            : `Profil de ${name} vérifié`,
      });
    });

    await this.notifications.notify({
      userId: request.userId,
      type: 'VERIFICATION_APPROVED',
      title:
        request.kind === 'MENTOR_APPLICATION'
          ? 'Bienvenue parmi les mentors !'
          : 'Votre profil est vérifié',
      body:
        dto.note ??
        (request.kind === 'MENTOR_APPLICATION'
          ? 'Votre candidature est acceptée : votre profil est publié. Ajoutez vos premiers créneaux.'
          : 'Le badge « Profil vérifié » apparaît désormais sur votre fiche.'),
      link:
        request.kind === 'MENTOR_APPLICATION' ? '/disponibilites' : '/compte?section=verification',
    });
    return { ok: true };
  }

  /** Refus motivé : le motif est communiqué ; une nouvelle demande reste possible. */
  async reject(admin: AuthUser, id: string, dto: DecisionDto) {
    if (!dto.note || dto.note.length < 10) {
      throw unprocessable(
        'DECISION_NOTE_REQUIRED',
        'Expliquez le refus (10 caractères au moins).',
        [{ field: 'note', messages: ['Expliquez le refus (10 caractères au moins).'] }],
      );
    }
    const request = await this.pending(id);
    const name = `${request.user.firstName} ${request.user.lastName}`;
    await this.prisma.$transaction(async (tx) => {
      const closed = await tx.verificationRequest.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status: 'REJECTED',
          decisionNote: dto.note,
          decidedById: admin.id,
          decidedAt: new Date(),
        },
      });
      if (closed.count === 0) {
        throw conflict('VERIFICATION_CLOSED', 'Cette demande a déjà été traitée.');
      }
      await tx.mentorProfile.updateMany({
        where: { userId: request.userId },
        data: { verificationStatus: 'REJECTED' },
      });
      await recordAudit(tx, admin, {
        action:
          request.kind === 'MENTOR_APPLICATION'
            ? 'MENTOR_APPLICATION_REJECTED'
            : 'VERIFICATION_REJECTED',
        targetType: 'USER',
        targetId: request.userId,
        summary:
          request.kind === 'MENTOR_APPLICATION'
            ? `Candidature mentor de ${name} refusée`
            : `Vérification du profil de ${name} refusée`,
      });
    });
    await this.notifications.notify({
      userId: request.userId,
      type: 'VERIFICATION_REJECTED',
      title:
        request.kind === 'MENTOR_APPLICATION'
          ? 'Votre candidature de mentor n’a pas été retenue'
          : 'La vérification de votre profil n’a pas abouti',
      body: dto.note,
      link:
        request.kind === 'MENTOR_APPLICATION' ? '/devenir-mentor' : '/compte?section=verification',
    });
    return { ok: true };
  }
}

// ─── Contrôleurs ───────────────────────────────────────────────────────────

@ApiTags('verification')
@Controller('verification')
export class VerificationController {
  constructor(private readonly service: VerificationService) {}

  @Get('me')
  mine(@CurrentUser() user: AuthUser) {
    return this.service.mine(user);
  }

  @Roles('MENTOR')
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @Post('mentor')
  requestVerification(@CurrentUser() user: AuthUser, @Body() dto: MentorVerificationDto) {
    return this.service.requestMentorVerification(user, dto);
  }

  @Roles('MENTEE')
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @Post('mentor-application')
  apply(@CurrentUser() user: AuthUser, @Body() dto: MentorApplicationDto) {
    return this.service.applyAsMentor(user, dto);
  }

  /** Justificatif (multipart : « file »), PDF ou image, 3 par demande. */
  @Throttle({ default: { limit: 15, ttl: 3_600_000 } })
  @Post(':id/documents')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(documentUpload())
  addDocument(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @UploadedFile() file?: UploadedDocument,
  ) {
    return this.service.addDocument(user, id, file);
  }

  @Delete(':id')
  withdraw(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.withdraw(user, id);
  }

  @Get('documents/:documentId')
  async document(
    @CurrentUser() user: AuthUser,
    @Param('documentId') id: string,
    @Res() res: Response,
  ) {
    sendStoredFile(res, await this.service.document(user, id));
  }
}

@ApiTags('admin')
@Roles('ADMIN')
@Controller('admin/verifications')
export class AdminVerificationController {
  constructor(private readonly service: VerificationService) {}

  @Get()
  list(@Query() q: ListVerificationsQuery) {
    return this.service.list(q);
  }

  @HttpCode(200)
  @Post(':id/approve')
  approve(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: DecisionDto) {
    return this.service.approve(admin, id, dto);
  }

  @HttpCode(200)
  @Post(':id/reject')
  reject(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: DecisionDto) {
    return this.service.reject(admin, id, dto);
  }
}

@Module({
  controllers: [VerificationController, AdminVerificationController],
  providers: [VerificationService],
})
export class VerificationModule {}
