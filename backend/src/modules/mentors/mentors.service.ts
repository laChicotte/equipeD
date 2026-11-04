import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { notFound } from '../../common/errors.js';
import { normalizeSearch } from '../../common/text.js';
import { paginate } from '../../common/pagination.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { computeMatch } from '../matching/matching.js';
import type { AvailabilityRangeQuery, ListMentorsQuery } from './mentors.dto.js';

const AVAILABILITY_WINDOW_DAYS = 14;
const ACTIVE_SESSION_STATUSES = ['REQUESTED', 'CONFIRMED'] as const;

/** Créneau libre : actif, futur et sans séance en cours de réservation/confirmée. */
export function freeSlotWhere(now: Date, until?: Date): Prisma.AvailabilitySlotWhereInput {
  return {
    isActive: true,
    startsAt: { gt: now, ...(until ? { lte: until } : {}) },
    sessions: { none: { status: { in: [...ACTIVE_SESSION_STATUSES] } } },
  };
}

/** Champs publics d'un mentor : jamais d'email, de téléphone ni de hash. */
const mentorCardSelect = {
  id: true,
  firstName: true,
  lastName: true,
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
      sessionDurationMin: true,
      maxMentees: true,
      verificationStatus: true,
      domains: { select: { domain: { select: { id: true, slug: true, name: true } } } },
    },
  },
  _count: { select: { mentorshipsAsMentor: { where: { status: 'ACTIVE' } } } },
} satisfies Prisma.UserSelect;

type MentorRow = Prisma.UserGetPayload<{ select: typeof mentorCardSelect }>;

@Injectable()
export class MentorsService {
  constructor(private readonly prisma: PrismaService) {}

  private baseWhere(): Prisma.UserWhereInput {
    return { role: 'MENTOR', status: 'ACTIVE', mentorProfile: { isPublished: true } };
  }

  async list(query: ListMentorsQuery) {
    const now = new Date();
    const profileFilters: Prisma.MentorProfileWhereInput[] = [{ isPublished: true }];

    if (query.q) {
      const terms = normalizeSearch(query.q)
        .split(' ')
        .filter((t) => t.length > 1)
        .slice(0, 6);
      for (const term of terms) profileFilters.push({ searchText: { contains: term } });
    }
    if (query.domain)
      profileFilters.push({ domains: { some: { domain: { slug: query.domain } } } });
    if (query.modality) {
      profileFilters.push(
        query.modality === 'HYBRID'
          ? { modalities: { has: 'HYBRID' } }
          : { modalities: { hasSome: [query.modality, 'HYBRID'] } },
      );
    }
    if (query.language) {
      const lang = query.language.charAt(0).toUpperCase() + query.language.slice(1).toLowerCase();
      profileFilters.push({ languages: { has: lang } });
    }

    const where: Prisma.UserWhereInput = {
      ...this.baseWhere(),
      mentorProfile: { AND: profileFilters },
      ...(query.available === 'true'
        ? {
            availabilitySlots: { some: freeSlotWhere(now, addDays(now, AVAILABILITY_WINDOW_DAYS)) },
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: mentorCardSelect,
        orderBy: [{ mentorProfile: { verificationStatus: 'desc' } }, { createdAt: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    const extras = await this.extras(
      rows.map((r) => r.id),
      now,
    );
    return paginate(
      rows.map((r) => this.toCard(r, extras.get(r.id))),
      total,
      query,
    );
  }

  /** Suggestions explicables pour le mentoré connecté (score déterministe, voir matching.ts). */
  async suggestions(user: AuthUser) {
    const mentee = await this.prisma.menteeProfile.findUnique({
      where: { userId: user.id },
      select: {
        desiredSkills: true,
        preferredModality: true,
        interests: { select: { domainId: true } },
      },
    });
    if (!mentee) return { profileRequired: true, items: [] };

    const now = new Date();
    const rows = await this.prisma.user.findMany({
      where: {
        ...this.baseWhere(),
        mentorshipsAsMentor: { none: { menteeId: user.id, status: 'ACTIVE' } },
      },
      select: mentorCardSelect,
      take: 100,
    });
    const extras = await this.extras(
      rows.map((r) => r.id),
      now,
    );
    const horizon = addDays(now, AVAILABILITY_WINDOW_DAYS);

    const items = rows
      .map((row) => {
        const card = this.toCard(row, extras.get(row.id));
        const match = computeMatch(
          {
            interestDomainIds: mentee.interests.map((i) => i.domainId),
            desiredSkills: mentee.desiredSkills,
            preferredModality: mentee.preferredModality,
          },
          {
            domains: card.domains,
            expertise: card.expertise,
            modalities: card.modalities,
            hasUpcomingAvailability: Boolean(
              card.nextAvailableAt && card.nextAvailableAt <= horizon,
            ),
            isVerified: card.verificationStatus === 'VERIFIED',
            hasCapacity: card.acceptingMentees,
          },
        );
        return { mentor: card, ...match };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    return { profileRequired: false, items };
  }

  async getById(id: string, viewer: AuthUser | undefined) {
    const row = await this.prisma.user.findFirst({
      where: { id, ...this.baseWhere() },
      select: mentorCardSelect,
    });
    if (!row)
      throw notFound(
        'MENTOR_NOT_FOUND',
        'Ce mentor est introuvable ou son profil n’est pas publié.',
      );

    const now = new Date();
    const extras = await this.extras([row.id], now);
    const card = this.toCard(row, extras.get(row.id), false);

    // Relation entre le visiteur connecté et ce mentor (pour adapter les actions proposées).
    let relation: {
      pendingRequestId: string | null;
      mentorshipId: string | null;
      lastDeclinedAt: Date | null;
    } | null = null;
    if (viewer?.role === 'MENTEE') {
      const [pending, mentorship, declined] = await Promise.all([
        this.prisma.mentorshipRequest.findFirst({
          where: { menteeId: viewer.id, mentorId: id, status: 'PENDING' },
          select: { id: true },
        }),
        this.prisma.mentorship.findFirst({
          where: { menteeId: viewer.id, mentorId: id, status: 'ACTIVE' },
          select: { id: true },
        }),
        this.prisma.mentorshipRequest.findFirst({
          where: { menteeId: viewer.id, mentorId: id, status: 'DECLINED' },
          orderBy: { respondedAt: 'desc' },
          select: { respondedAt: true },
        }),
      ]);
      relation = {
        pendingRequestId: pending?.id ?? null,
        mentorshipId: mentorship?.id ?? null,
        lastDeclinedAt: declined?.respondedAt ?? null,
      };
    }
    return { ...card, relation };
  }

  /** Créneaux libres d'un mentor (par défaut : 30 prochains jours). */
  async availability(mentorId: string, range: AvailabilityRangeQuery) {
    const exists = await this.prisma.user.count({ where: { id: mentorId, ...this.baseWhere() } });
    if (!exists) throw notFound('MENTOR_NOT_FOUND', 'Ce mentor est introuvable.');
    const now = new Date();
    const from = range.from ? maxDate(new Date(range.from), now) : now;
    const to = range.to ? new Date(range.to) : addDays(now, 30);
    const slots = await this.prisma.availabilitySlot.findMany({
      where: { mentorId, ...freeSlotWhere(from, to) },
      orderBy: { startsAt: 'asc' },
      select: { id: true, startsAt: true, endsAt: true, timezone: true },
      take: 100,
    });
    return slots;
  }

  /**
   * Données calculées par mentor : prochain créneau libre et note moyenne
   * (uniquement les évaluations laissées par des mentorés après une séance).
   */
  private async extras(mentorIds: string[], now: Date): Promise<Map<string, MentorExtras>> {
    const result = new Map<string, MentorExtras>();
    if (mentorIds.length === 0) return result;
    const [slots, feedbacks] = await Promise.all([
      this.prisma.availabilitySlot.groupBy({
        by: ['mentorId'],
        where: { mentorId: { in: mentorIds }, ...freeSlotWhere(now) },
        _min: { startsAt: true },
      }),
      this.prisma.sessionFeedback.findMany({
        where: { session: { mentorId: { in: mentorIds } }, author: { role: 'MENTEE' } },
        select: { rating: true, session: { select: { mentorId: true } } },
      }),
    ]);
    for (const id of mentorIds)
      result.set(id, { nextAvailableAt: null, ratingSum: 0, ratingCount: 0 });
    for (const g of slots) result.get(g.mentorId)!.nextAvailableAt = g._min.startsAt ?? null;
    for (const f of feedbacks) {
      const e = result.get(f.session.mentorId)!;
      e.ratingSum += f.rating;
      e.ratingCount += 1;
    }
    return result;
  }

  private toCard(row: MentorRow, extra: MentorExtras | undefined, excerpt = true) {
    const p = row.mentorProfile!;
    const activeMentees = row._count.mentorshipsAsMentor;
    const nextAvailableAt = extra?.nextAvailableAt ?? null;
    const ratingCount = extra?.ratingCount ?? 0;
    return {
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      headline: p.headline,
      bio: excerpt ? truncate(p.bio, 220) : p.bio,
      currentPosition: p.currentPosition,
      organization: p.organization,
      yearsExperience: p.yearsExperience,
      expertise: p.expertise,
      languages: p.languages,
      modalities: p.modalities,
      city: p.city,
      sessionDurationMin: p.sessionDurationMin,
      verificationStatus: p.verificationStatus,
      domains: p.domains.map((d) => d.domain),
      activeMentees,
      maxMentees: p.maxMentees,
      acceptingMentees: activeMentees < p.maxMentees,
      nextAvailableAt,
      rating: {
        average: ratingCount ? Math.round((extra!.ratingSum / ratingCount) * 10) / 10 : null,
        count: ratingCount,
      },
    };
  }
}

interface MentorExtras {
  nextAvailableAt: Date | null;
  ratingSum: number;
  ratingCount: number;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}
function maxDate(a: Date, b: Date): Date {
  return a > b ? a : b;
}
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' ')).trimEnd()}…`;
}
