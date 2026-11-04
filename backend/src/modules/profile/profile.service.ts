import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { forbidden, unprocessable } from '../../common/errors.js';
import { cleanTags, normalizeSearch } from '../../common/text.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import type { UpsertMenteeProfileDto, UpsertMentorProfileDto } from './profile.dto.js';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getMine(user: AuthUser) {
    const base = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        timezone: true,
        onboardedAt: true,
      },
    });
    if (user.role === 'MENTOR') {
      const profile = await this.prisma.mentorProfile.findUnique({
        where: { userId: user.id },
        include: {
          domains: { include: { domain: { select: { id: true, slug: true, name: true } } } },
        },
      });
      return {
        user: base,
        mentorProfile: profile
          ? {
              ...omitSearch(profile),
              domains: profile.domains.map((d) => d.domain),
            }
          : null,
        menteeProfile: null,
      };
    }
    if (user.role === 'MENTEE') {
      const profile = await this.prisma.menteeProfile.findUnique({
        where: { userId: user.id },
        include: {
          interests: { include: { domain: { select: { id: true, slug: true, name: true } } } },
        },
      });
      return {
        user: base,
        mentorProfile: null,
        menteeProfile: profile
          ? { ...profile, interests: profile.interests.map((i) => i.domain) }
          : null,
      };
    }
    return { user: base, mentorProfile: null, menteeProfile: null };
  }

  async upsertMentor(user: AuthUser, dto: UpsertMentorProfileDto) {
    if (user.role !== 'MENTOR')
      throw forbidden('ROLE_FORBIDDEN', 'Seul un mentor peut renseigner un profil mentor.');
    const domainIds = await this.assertDomains(dto.domainIds);
    const expertise = cleanTags(dto.expertise);
    const languages = cleanTags(dto.languages);
    const modalities = [...new Set(dto.modalities)];

    const domainNames = await this.prisma.expertiseDomain.findMany({
      where: { id: { in: domainIds } },
      select: { name: true, topics: true },
    });
    const searchText = normalizeSearch(
      [
        user.firstName,
        user.lastName,
        dto.headline,
        dto.currentPosition ?? '',
        dto.organization ?? '',
        dto.city ?? '',
        ...expertise,
        ...domainNames.flatMap((d) => [d.name, ...d.topics]),
      ].join(' '),
    );

    const data = {
      headline: dto.headline,
      bio: dto.bio,
      currentPosition: dto.currentPosition ?? null,
      organization: dto.organization ?? null,
      yearsExperience: dto.yearsExperience,
      expertise,
      languages,
      modalities,
      city: dto.city ?? null,
      sessionDurationMin: dto.sessionDurationMin,
      maxMentees: dto.maxMentees,
      searchText,
    };

    await this.prisma.$transaction(async (tx) => {
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
      await tx.user.updateMany({
        where: { id: user.id, onboardedAt: null },
        data: { onboardedAt: new Date() },
      });
    });
    return this.getMine(user);
  }

  async upsertMentee(user: AuthUser, dto: UpsertMenteeProfileDto) {
    if (user.role !== 'MENTEE')
      throw forbidden('ROLE_FORBIDDEN', 'Seul un mentoré peut renseigner un profil mentoré.');
    const domainIds = await this.assertDomains(dto.interestDomainIds);
    const data = {
      situation: dto.situation,
      goalsSummary: dto.goalsSummary,
      desiredSkills: cleanTags(dto.desiredSkills),
      preferredModality: dto.preferredModality,
      city: dto.city ?? null,
    };
    await this.prisma.$transaction(async (tx) => {
      const profile = await tx.menteeProfile.upsert({
        where: { userId: user.id },
        create: { userId: user.id, ...data },
        update: data,
        select: { id: true },
      });
      await tx.menteeInterest.deleteMany({ where: { menteeProfileId: profile.id } });
      await tx.menteeInterest.createMany({
        data: domainIds.map((domainId) => ({ menteeProfileId: profile.id, domainId })),
      });
      await tx.user.updateMany({
        where: { id: user.id, onboardedAt: null },
        data: { onboardedAt: new Date() },
      });
    });
    return this.getMine(user);
  }

  private async assertDomains(ids: string[]): Promise<string[]> {
    const unique = [...new Set(ids)];
    const count = await this.prisma.expertiseDomain.count({
      where: { id: { in: unique }, isActive: true },
    });
    if (count !== unique.length) {
      throw unprocessable(
        'INVALID_DOMAIN',
        'Un ou plusieurs domaines sélectionnés sont invalides.',
      );
    }
    return unique;
  }
}

function omitSearch<T extends { searchText: string }>(p: T): Omit<T, 'searchText'> {
  const { searchText: _s, ...rest } = p;
  return rest;
}
