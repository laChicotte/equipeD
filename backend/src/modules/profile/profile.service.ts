import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { forbidden, unprocessable } from '../../common/errors.js';
import { cleanTags, normalizeSearch } from '../../common/text.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import type {
  UpdateAccountDto,
  UpsertMenteeProfileDto,
  UpsertMentorProfileDto,
} from './profile.dto.js';

/** Texte de recherche normalisé d'un mentor : nom, titre, poste, ville, compétences et domaines. */
export function mentorSearchText(p: {
  firstName: string;
  lastName: string;
  headline: string;
  currentPosition?: string | null;
  organization?: string | null;
  city?: string | null;
  expertise: string[];
  domains: { name: string; topics: string[] }[];
}): string {
  return normalizeSearch(
    [
      p.firstName,
      p.lastName,
      p.headline,
      p.currentPosition ?? '',
      p.organization ?? '',
      p.city ?? '',
      ...p.expertise,
      ...p.domains.flatMap((d) => [d.name, ...d.topics]),
    ].join(' '),
  );
}

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

  /** Mise à jour des informations de compte (nom, fuseau horaire). */
  async updateAccount(user: AuthUser, dto: UpdateAccountDto) {
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { firstName: dto.firstName, lastName: dto.lastName, timezone: dto.timezone },
      select: { firstName: true, lastName: true },
    });
    // Le nom fait partie du texte de recherche de l'annuaire : on le recalcule pour un mentor.
    const profile = await this.prisma.mentorProfile.findUnique({
      where: { userId: user.id },
      select: {
        headline: true,
        currentPosition: true,
        organization: true,
        city: true,
        expertise: true,
        domains: { select: { domain: { select: { name: true, topics: true } } } },
      },
    });
    if (profile) {
      await this.prisma.mentorProfile.update({
        where: { userId: user.id },
        data: {
          searchText: mentorSearchText({
            ...profile,
            ...updated,
            domains: profile.domains.map((d) => d.domain),
          }),
        },
      });
    }
    return this.getMine({ ...user, ...updated });
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
    const searchText = mentorSearchText({
      firstName: user.firstName,
      lastName: user.lastName,
      headline: dto.headline,
      currentPosition: dto.currentPosition,
      organization: dto.organization,
      city: dto.city,
      expertise,
      domains: domainNames,
    });

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
