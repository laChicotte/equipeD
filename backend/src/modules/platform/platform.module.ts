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
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { recordAudit } from '../../common/audit.js';
import { CurrentUser, Roles } from '../../common/auth/decorators.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { conflict, forbidden, notFound } from '../../common/errors.js';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.module.js';
import { buildImpactCsv } from './impact-report.js';

export class ChangeRoleDto {
  /** Nommer administrateur, ou rendre à un administrateur un rôle de mentor ou de mentoré. */
  @IsIn(['ADMIN', 'MENTOR', 'MENTEE'], { message: 'Rôle attendu : ADMIN, MENTOR ou MENTEE.' })
  role!: 'ADMIN' | 'MENTOR' | 'MENTEE';
}

export class RevokeCertificateDto {
  @IsString()
  @Length(10, 300, { message: 'Motif : entre 10 et 300 caractères.' })
  reason!: string;
}

export class AuditQuery {
  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(100)
  pageSize = 30;
}

const DAY_MS = 86_400_000;

/** Série quotidienne sur 30 jours, jours sans activité compris (fuseau de référence : UTC = Conakry). */
function fillDays(rows: { day: Date; n: bigint | number }[], from: Date, days: number) {
  const byDay = new Map(rows.map((r) => [new Date(r.day).toISOString().slice(0, 10), Number(r.n)]));
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(from.getTime() + i * DAY_MS).toISOString().slice(0, 10);
    return { day: d, count: byDay.get(d) ?? 0 };
  });
}

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Tableau de pilotage : uniquement des chiffres calculés sur la base, aucun contenu privé. */
  async metrics() {
    const now = new Date();
    const from = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 29 * DAY_MS,
    );
    const weekAgo = new Date(now.getTime() - 7 * DAY_MS);

    const [
      usersByRole,
      usersByStatus,
      newUsers7d,
      mentorProfiles,
      requestsByStatus,
      decided,
      mentorshipsByStatus,
      sessionsByStatus,
      completedSessions,
      rating,
      certificates,
      messagesTotal,
      messages7d,
      domains,
      signups,
      requestsDaily,
      sessionsDaily,
      messagesDaily,
      goalsByStatus,
      workshops,
      workshopGoing,
      calls,
    ] = await Promise.all([
      this.prisma.user.groupBy({
        by: ['role'],
        where: { status: { not: 'DELETED' } },
        _count: { _all: true },
      }),
      this.prisma.user.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.user.count({
        where: {
          createdAt: { gte: weekAgo },
          status: { not: 'DELETED' },
          role: { in: ['MENTEE', 'MENTOR'] },
        },
      }),
      this.prisma.mentorProfile.groupBy({
        by: ['verificationStatus', 'isPublished'],
        _count: { _all: true },
      }),
      this.prisma.mentorshipRequest.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.mentorshipRequest.findMany({
        where: { status: { in: ['ACCEPTED', 'DECLINED'] }, respondedAt: { not: null } },
        select: { createdAt: true, respondedAt: true },
        take: 5000,
      }),
      this.prisma.mentorship.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.mentoringSession.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.mentoringSession.findMany({
        where: { status: 'COMPLETED' },
        select: { startsAt: true, endsAt: true },
        take: 20000,
      }),
      this.prisma.sessionFeedback.aggregate({ _avg: { rating: true }, _count: { _all: true } }),
      this.prisma.mentorshipCertificate.groupBy({
        by: ['revokedAt'],
        _count: { _all: true },
      }),
      this.prisma.message.count(),
      this.prisma.message.count({ where: { createdAt: { gte: weekAgo } } }),
      this.prisma.expertiseDomain.findMany({
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          isActive: true,
          _count: { select: { mentors: true, mentees: true, requests: true } },
        },
      }),
      this.prisma.$queryRaw<{ day: Date; n: bigint }[]>`
        SELECT date_trunc('day', created_at) AS day, count(*) AS n FROM users
        WHERE created_at >= ${from} AND status <> 'DELETED' GROUP BY 1`,
      this.prisma.$queryRaw<{ day: Date; n: bigint }[]>`
        SELECT date_trunc('day', created_at) AS day, count(*) AS n FROM mentorship_requests
        WHERE created_at >= ${from} GROUP BY 1`,
      this.prisma.$queryRaw<{ day: Date; n: bigint }[]>`
        SELECT date_trunc('day', starts_at) AS day, count(*) AS n FROM mentoring_sessions
        WHERE starts_at >= ${from} AND starts_at <= ${now} AND status = 'COMPLETED' GROUP BY 1`,
      this.prisma.$queryRaw<{ day: Date; n: bigint }[]>`
        SELECT date_trunc('day', created_at) AS day, count(*) AS n FROM messages
        WHERE created_at >= ${from} GROUP BY 1`,
      this.prisma.goal.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.groupWorkshop.findMany({
        where: { cancelledAt: null },
        select: { startsAt: true, endsAt: true },
        take: 20000,
      }),
      this.prisma.workshopAttendance.count({
        where: { response: 'GOING', workshop: { cancelledAt: null, endsAt: { lte: now } } },
      }),
      this.prisma.call.findMany({
        where: { status: 'ENDED', answeredAt: { not: null }, endedAt: { not: null } },
        select: { kind: true, answeredAt: true, endedAt: true },
        take: 20000,
      }),
    ]);

    const count = <T extends { _count: { _all: number } }>(rows: T[], pick: (r: T) => string) =>
      Object.fromEntries(rows.map((r) => [pick(r), r._count._all]));
    const requests = count(requestsByStatus, (r) => r.status);
    const accepted = requests.ACCEPTED ?? 0;
    const declined = requests.DECLINED ?? 0;
    const responseHours = decided
      .map((r) => (r.respondedAt!.getTime() - r.createdAt.getTime()) / 3_600_000)
      .sort((a, b) => a - b);
    const median = responseHours.length
      ? responseHours[Math.floor(responseHours.length / 2)]
      : null;
    const minutes = completedSessions.reduce(
      (s, x) => s + (x.endsAt.getTime() - x.startsAt.getTime()) / 60_000,
      0,
    );
    const goals = count(goalsByStatus, (r) => r.status);
    const heldWorkshops = workshops.filter((w) => w.endsAt <= now);
    const workshopMinutes = heldWorkshops.reduce(
      (s, w) => s + (w.endsAt.getTime() - w.startsAt.getTime()) / 60_000,
      0,
    );
    const callMinutes = (kind: 'AUDIO' | 'VIDEO') =>
      Math.round(
        calls
          .filter((c) => c.kind === kind)
          .reduce((s, c) => s + (c.endedAt!.getTime() - c.answeredAt!.getTime()) / 60_000, 0),
      );
    const mentors = mentorProfiles.reduce(
      (acc, p) => {
        acc.total += p._count._all;
        if (p.isPublished) acc.published += p._count._all;
        if (p.verificationStatus === 'VERIFIED') acc.verified += p._count._all;
        if (p.verificationStatus === 'PENDING' || p.verificationStatus === 'UNVERIFIED')
          acc.toReview += p._count._all;
        return acc;
      },
      { total: 0, published: 0, verified: 0, toReview: 0 },
    );

    return {
      generatedAt: now,
      users: {
        byRole: count(usersByRole, (r) => r.role),
        byStatus: count(usersByStatus, (r) => r.status),
        new7d: newUsers7d,
      },
      mentors,
      requests: {
        byStatus: requests,
        acceptanceRate:
          accepted + declined ? Math.round((accepted / (accepted + declined)) * 100) : null,
        medianResponseHours: median === null ? null : Math.round(median * 10) / 10,
      },
      mentorships: count(mentorshipsByStatus, (r) => r.status),
      sessions: {
        byStatus: count(sessionsByStatus, (r) => r.status),
        completedHours: Math.round((minutes / 60) * 10) / 10,
      },
      feedback: {
        average: rating._avg.rating === null ? null : Math.round(rating._avg.rating * 10) / 10,
        count: rating._count._all,
      },
      certificates: {
        valid: certificates
          .filter((c) => c.revokedAt === null)
          .reduce((s, c) => s + c._count._all, 0),
        revoked: certificates
          .filter((c) => c.revokedAt !== null)
          .reduce((s, c) => s + c._count._all, 0),
      },
      messages: { total: messagesTotal, last7d: messages7d },
      goals: {
        total: Object.values(goals).reduce((a, b) => a + b, 0),
        completed: goals.COMPLETED ?? 0,
        inProgress: goals.IN_PROGRESS ?? 0,
      },
      workshops: {
        held: heldWorkshops.length,
        upcoming: workshops.length - heldWorkshops.length,
        hours: Math.round((workshopMinutes / 60) * 10) / 10,
        participations: workshopGoing,
      },
      calls: {
        audio: calls.filter((c) => c.kind === 'AUDIO').length,
        video: calls.filter((c) => c.kind === 'VIDEO').length,
        audioMinutes: callMinutes('AUDIO'),
        videoMinutes: callMinutes('VIDEO'),
      },
      domains: domains.map((d) => ({
        id: d.id,
        name: d.name,
        isActive: d.isActive,
        mentors: d._count.mentors,
        menteeInterests: d._count.mentees,
        requests: d._count.requests,
      })),
      activity: {
        from,
        signups: fillDays(signups, from, 30),
        requests: fillDays(requestsDaily, from, 30),
        sessions: fillDays(sessionsDaily, from, 30),
        messages: fillDays(messagesDaily, from, 30),
      },
    };
  }

  team() {
    return this.prisma.user.findMany({
      where: { role: 'ADMIN', status: { not: 'DELETED' } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        status: true,
        avatarUpdatedAt: true,
        createdAt: true,
      },
    });
  }

  /**
   * Changement de rôle par un administrateur :
   *  - jamais sur soi-même (il reste donc toujours au moins un administrateur) ;
   *  - un compte avec un mentorat en cours ou une demande en attente ne peut pas devenir administrateur ;
   *  - les sessions de la personne sont révoquées pour que ses droits soient recalculés.
   */
  async changeRole(actor: AuthUser, userId: string, dto: ChangeRoleDto) {
    if (userId === actor.id)
      throw forbidden('SELF_ROLE_CHANGE', 'Vous ne pouvez pas modifier votre propre rôle.');
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true, firstName: true, lastName: true },
    });
    if (!user || user.status === 'DELETED')
      throw notFound('USER_NOT_FOUND', 'Utilisateur introuvable.');
    if (user.role === dto.role) return { id: user.id, role: user.role };
    if (dto.role !== 'ADMIN' && user.role !== 'ADMIN') {
      throw conflict(
        'INVALID_TRANSITION',
        'Seul un administrateur peut redevenir mentor ou mentoré.',
      );
    }
    if (dto.role === 'ADMIN') {
      if (user.status !== 'ACTIVE')
        throw conflict('USER_NOT_ACTIVE', 'Réactivez d’abord ce compte.');
      const [active, pending] = await Promise.all([
        this.prisma.mentorship.count({
          where: { status: 'ACTIVE', OR: [{ mentorId: userId }, { menteeId: userId }] },
        }),
        this.prisma.mentorshipRequest.count({
          where: { status: 'PENDING', OR: [{ mentorId: userId }, { menteeId: userId }] },
        }),
      ]);
      if (active + pending > 0) {
        throw conflict(
          'USER_HAS_ACTIVE_MENTORING',
          'Cette personne a un mentorat en cours ou une demande en attente : clôturez-les avant de la nommer administratrice.',
        );
      }
    }
    const labels = {
      ADMIN: 'administrateur',
      MENTOR: 'mentor',
      MENTEE: 'mentoré',
    };
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { role: dto.role },
        select: { id: true, role: true },
      });
      await tx.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await recordAudit(tx, actor, {
        action: 'ROLE_CHANGED',
        targetType: 'USER',
        targetId: userId,
        summary: `${user.firstName} ${user.lastName} : ${labels[user.role]} → ${labels[dto.role]}`,
      });
      return updated;
    });
  }

  async audit(query: AuditQuery) {
    const where = query.action ? { action: query.action } : {};
    const [total, items] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          actorId: true,
          actorName: true,
          action: true,
          targetType: true,
          targetId: true,
          summary: true,
          createdAt: true,
        },
      }),
    ]);
    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  certificates() {
    return this.prisma.mentorshipCertificate.findMany({
      orderBy: { issuedAt: 'desc' },
      take: 500,
      select: {
        code: true,
        mentorId: true,
        mentorName: true,
        menteeName: true,
        domainName: true,
        completedSessions: true,
        totalMinutes: true,
        averageRating: true,
        issuedAt: true,
        revokedAt: true,
        revokedReason: true,
      },
    });
  }

  /** Révocation motivée d'un certificat (fraude, erreur) : le mentor est prévenu, l'action est tracée. */
  async revokeCertificate(actor: AuthUser, code: string, dto: RevokeCertificateDto) {
    const cert = await this.prisma.mentorshipCertificate.findUnique({
      where: { code: code.trim().toUpperCase() },
      select: { id: true, code: true, mentorId: true, mentorName: true, revokedAt: true },
    });
    if (!cert) throw notFound('CERTIFICATE_NOT_FOUND', 'Certificat introuvable.');
    if (cert.revokedAt)
      throw conflict('CERTIFICATE_ALREADY_REVOKED', 'Ce certificat est déjà révoqué.');
    const revoked = await this.prisma.$transaction(async (tx) => {
      const r = await tx.mentorshipCertificate.update({
        where: { id: cert.id },
        data: { revokedAt: new Date(), revokedReason: dto.reason },
        select: { code: true, revokedAt: true, revokedReason: true },
      });
      await recordAudit(tx, actor, {
        action: 'CERTIFICATE_REVOKED',
        targetType: 'CERTIFICATE',
        targetId: cert.code,
        summary: `Certificat ${cert.code} de ${cert.mentorName} révoqué : ${dto.reason}`,
      });
      return r;
    });
    await this.notifications.notify({
      userId: cert.mentorId,
      type: 'CERTIFICATE_ISSUED',
      title: 'Un de vos certificats a été révoqué',
      body: `Certificat ${cert.code} : ${dto.reason}`,
      link: `/certificats/${cert.code}`,
    });
    return revoked;
  }
}

@ApiTags('admin')
@Roles('ADMIN')
@Controller('admin')
export class PlatformController {
  constructor(
    private readonly service: PlatformService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('metrics')
  metrics() {
    return this.service.metrics();
  }

  /** Rapport d'impact téléchargeable (CSV pour Excel) : comptages agrégés, aucune donnée personnelle. */
  @Get('impact-report.csv')
  async impactReport(@CurrentUser() actor: AuthUser, @Res() res: Response) {
    const csv = buildImpactCsv(await this.service.metrics());
    await recordAudit(this.prisma, actor, {
      action: 'IMPACT_REPORT_EXPORTED',
      targetType: 'REPORT',
      targetId: null,
      summary: 'Export du rapport d’impact (CSV)',
    });
    const day = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="rapport-impact-talents-connectes-${day}.csv"`,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.send(csv);
  }

  @Get('team')
  team() {
    return this.service.team();
  }

  @Patch('users/:id/role')
  changeRole(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: ChangeRoleDto) {
    return this.service.changeRole(actor, id, dto);
  }

  @Get('audit')
  audit(@Query() query: AuditQuery) {
    return this.service.audit(query);
  }

  @Get('certificates')
  certificates() {
    return this.service.certificates();
  }

  @Post('certificates/:code/revoke')
  revoke(
    @CurrentUser() actor: AuthUser,
    @Param('code') code: string,
    @Body() dto: RevokeCertificateDto,
  ) {
    return this.service.revokeCertificate(actor, code, dto);
  }
}

@Module({
  controllers: [PlatformController],
  providers: [PlatformService],
})
export class PlatformModule {}
