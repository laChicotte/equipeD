import { randomInt } from 'node:crypto';
import { Controller, Get, Injectable, Module, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public } from '../../common/auth/decorators.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { notFound } from '../../common/errors.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';

/** Alphabet sans caractères ambigus (ni 0/O, ni 1/I) : le code se recopie sans erreur. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateCertificateCode(): string {
  const part = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return `TC-${part()}-${part()}`;
}

/** Prénom et initiale du nom : le certificat est public, on limite les données du mentoré. */
export function shortName(firstName: string, lastName: string): string {
  const initial = lastName.trim().charAt(0);
  return initial ? `${firstName} ${initial.toUpperCase()}.` : firstName;
}

/**
 * Délivre le certificat d'un mentorat qui vient d'être clôturé, dans la transaction de clôture.
 * Condition : au moins une séance marquée comme réalisée. Les chiffres sont figés à cet instant.
 * Renvoie le certificat créé, ou null si le mentorat n'est pas éligible (ou déjà certifié).
 */
export async function issueCertificateIfEligible(
  tx: Prisma.TransactionClient,
  mentorshipId: string,
  endedAt: Date,
) {
  const m = await tx.mentorship.findUnique({
    where: { id: mentorshipId },
    select: {
      id: true,
      startedAt: true,
      mentorId: true,
      menteeId: true,
      certificate: { select: { id: true } },
      mentor: { select: { firstName: true, lastName: true } },
      mentee: { select: { firstName: true, lastName: true } },
      request: { select: { domain: { select: { name: true } } } },
      sessions: {
        where: { status: 'COMPLETED' },
        select: { id: true, startsAt: true, endsAt: true },
      },
      goals: { select: { status: true } },
    },
  });
  if (!m || m.certificate || m.sessions.length === 0) return null;

  const totalMinutes = m.sessions.reduce(
    (sum, s) => sum + Math.max(1, Math.round((s.endsAt.getTime() - s.startsAt.getTime()) / 60_000)),
    0,
  );
  const ratings = await tx.sessionFeedback.aggregate({
    where: { sessionId: { in: m.sessions.map((s) => s.id) }, authorId: m.menteeId },
    _avg: { rating: true },
  });
  const average = ratings._avg.rating;

  return tx.mentorshipCertificate.create({
    data: {
      code: generateCertificateCode(),
      mentorshipId: m.id,
      mentorId: m.mentorId,
      menteeId: m.menteeId,
      mentorName: `${m.mentor.firstName} ${m.mentor.lastName}`,
      menteeName: shortName(m.mentee.firstName, m.mentee.lastName),
      domainName: m.request.domain?.name ?? 'Accompagnement général',
      startedAt: m.startedAt,
      endedAt,
      completedSessions: m.sessions.length,
      totalMinutes,
      goalsCompleted: m.goals.filter((g) => g.status === 'COMPLETED').length,
      goalsTotal: m.goals.length,
      averageRating: average === null ? null : Math.round(average * 10) / 10,
      issuedAt: endedAt,
    },
  });
}

const publicSelect = {
  code: true,
  mentorId: true,
  mentorName: true,
  menteeName: true,
  domainName: true,
  startedAt: true,
  endedAt: true,
  completedSessions: true,
  totalMinutes: true,
  goalsCompleted: true,
  goalsTotal: true,
  averageRating: true,
  issuedAt: true,
  revokedAt: true,
} satisfies Prisma.MentorshipCertificateSelect;

@Injectable()
export class CertificatesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Vérification publique d'un certificat à partir de son code. */
  async verify(code: string) {
    const normalized = code.trim().toUpperCase();
    const cert = await this.prisma.mentorshipCertificate.findUnique({
      where: { code: normalized },
      select: {
        ...publicSelect,
        mentor: {
          select: {
            avatarUpdatedAt: true,
            mentorProfile: { select: { isPublished: true, headline: true } },
          },
        },
      },
    });
    if (!cert) throw notFound('CERTIFICATE_NOT_FOUND', 'Aucun certificat ne correspond à ce code.');
    const { mentor, revokedAt, ...rest } = cert;
    const published = mentor.mentorProfile?.isPublished === true;
    return {
      ...rest,
      valid: revokedAt === null,
      mentor: {
        id: published ? rest.mentorId : null,
        headline: published ? (mentor.mentorProfile?.headline ?? null) : null,
        avatarUpdatedAt: published ? mentor.avatarUpdatedAt : null,
      },
    };
  }

  /** Certificats valides d'un mentor publié (fiche publique). */
  async forMentor(mentorId: string) {
    const mentor = await this.prisma.user.findFirst({
      where: {
        id: mentorId,
        role: 'MENTOR',
        status: 'ACTIVE',
        mentorProfile: { isPublished: true },
      },
      select: { id: true },
    });
    if (!mentor) throw notFound('MENTOR_NOT_FOUND', 'Mentor introuvable.');
    return this.prisma.mentorshipCertificate.findMany({
      where: { mentorId, revokedAt: null },
      orderBy: { issuedAt: 'desc' },
      select: publicSelect,
      take: 50,
    });
  }

  /** Certificats qui me concernent : délivrés (mentor) ou liés à mes mentorats (mentoré). */
  async mine(user: AuthUser) {
    return this.prisma.mentorshipCertificate.findMany({
      where: user.role === 'MENTOR' ? { mentorId: user.id } : { menteeId: user.id },
      orderBy: { issuedAt: 'desc' },
      select: publicSelect,
    });
  }
}

@ApiTags('certificates')
@Controller()
export class CertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  /** Certificats de l'utilisateur connecté. */
  @Get('certificates/me')
  mine(@CurrentUser() user: AuthUser) {
    return this.certificates.mine(user);
  }

  /** Vérification publique : n'importe qui peut contrôler l'authenticité d'un certificat. */
  @Public()
  @Get('certificates/:code')
  verify(@Param('code') code: string) {
    return this.certificates.verify(code);
  }

  /** Certificats valides affichés sur la fiche publique d'un mentor. */
  @Public()
  @Get('mentors/:id/certificates')
  forMentor(@Param('id') id: string) {
    return this.certificates.forMentor(id);
  }
}

@Module({
  controllers: [CertificatesController],
  providers: [CertificatesService],
})
export class CertificatesModule {}
