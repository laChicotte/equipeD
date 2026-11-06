import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { notFound } from '../../common/errors.js';
import { normalizeSearch } from '../../common/text.js';
import { paginate } from '../../common/pagination.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { computeMatch } from '../matching/matching.js';
import type { AvailabilityRangeQuery, ListMentorsQuery } from './mentors.dto.js';
import { isConfirmedMentor, rankMentors } from './ranking.js';
import { closestWord, matchText, tokenize, wordMatch } from './search.js';

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
  avatarUpdatedAt: true,
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
      verificationStatus: true,
      domains: { select: { domain: { select: { id: true, slug: true, name: true } } } },
    },
  },
  _count: { select: { mentorshipsAsMentor: { where: { status: 'ACTIVE' } } } },
} satisfies Prisma.UserSelect;

type MentorRow = Prisma.UserGetPayload<{ select: typeof mentorCardSelect }>;

interface VocabDomain {
  slug: string;
  name: string;
  icon: string;
  topics: string[];
  mentorCount: number;
}

@Injectable()
export class MentorsService {
  constructor(private readonly prisma: PrismaService) {}

  private baseWhere(): Prisma.UserWhereInput {
    return { role: 'MENTOR', status: 'ACTIVE', mentorProfile: { isPublished: true } };
  }

  async list(query: ListMentorsQuery) {
    const now = new Date();
    const profileFilters: Prisma.MentorProfileWhereInput[] = [{ isPublished: true }];

    const terms = query.q ? tokenize(query.q) : [];
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

    // Le classement dépend de l'historique (accompagnements, avis, créneaux) : il est calculé sur
    // l'ensemble des résultats, puis découpé en pages. Suffisant pour quelques milliers de mentors.
    const candidates = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        mentorProfile: {
          select: { verificationStatus: true, yearsExperience: true, searchText: true },
        },
      },
      take: 2_000,
    });

    // Recherche : tous les mots retrouvés d'abord ; sinon, les profils proches (au moins un mot).
    let pool = candidates;
    let mode: 'none' | 'exact' | 'approximate' | 'empty' = 'none';
    const relevance = new Map<string, number>();
    if (terms.length > 0) {
      const phrase = normalizeSearch(query.q ?? '');
      const scored = candidates.map((c) => ({
        c,
        m: matchText(c.mentorProfile?.searchText ?? '', terms, phrase),
      }));
      const exact = scored.filter((s) => s.m.matched === terms.length);
      const partial = scored.filter((s) => s.m.matched > 0);
      const chosen = exact.length > 0 ? exact : partial;
      mode = exact.length > 0 ? 'exact' : partial.length > 0 ? 'approximate' : 'empty';
      for (const s of chosen) relevance.set(s.c.id, s.m.score + s.m.matched);
      pool = chosen.map((s) => s.c);
    }
    const extras = await this.extras(
      pool.map((c) => c.id),
      now,
    );
    let ranked = rankMentors(
      pool.map((c) => {
        const e = extras.get(c.id)!;
        return {
          id: c.id,
          createdAt: c.createdAt,
          verified: c.mentorProfile?.verificationStatus === 'VERIFIED',
          yearsExperience: c.mentorProfile?.yearsExperience ?? 0,
          completedMentorships: e.completedMentorships,
          mentoredCount: e.mentoredCount,
          certificatesCount: e.certificatesCount,
          ratingAverage: e.ratingCount ? e.ratingSum / e.ratingCount : null,
          ratingCount: e.ratingCount,
          nextAvailableAt: e.nextAvailableAt,
        };
      }),
      query.sort,
      now,
      AVAILABILITY_WINDOW_DAYS,
    );
    // Tri par pertinence : les profils qui correspondent le mieux aux mots saisis passent devant
    // (à pertinence égale, l'ordre de l'annuaire est conservé : tri stable).
    if (relevance.size > 0 && query.sort === 'relevance') {
      ranked = [...ranked].sort(
        (a, b) =>
          Math.round((relevance.get(b.id) ?? 0) * 4) - Math.round((relevance.get(a.id) ?? 0) * 4),
      );
    }
    const pageIds = ranked
      .slice((query.page - 1) * query.pageSize, query.page * query.pageSize)
      .map((m) => m.id);
    const rows = await this.prisma.user.findMany({
      where: { id: { in: pageIds } },
      select: mentorCardSelect,
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return {
      ...paginate(
        pageIds.flatMap((id) => (byId.has(id) ? [this.toCard(byId.get(id)!, extras.get(id))] : [])),
        pool.length,
        query,
      ),
      search:
        terms.length === 0
          ? null
          : {
              mode,
              terms: terms.map((t) => t.word),
              didYouMean: mode === 'exact' ? null : await this.didYouMean(terms.map((t) => t.word)),
            },
    };
  }

  /** Vocabulaire de l'annuaire : compétences, domaines et thèmes (autocomplétion, correction). */
  private vocabCache: { at: number; skills: Map<string, number>; domains: VocabDomain[] } | null =
    null;

  private async vocabulary() {
    if (this.vocabCache && Date.now() - this.vocabCache.at < 60_000) return this.vocabCache;
    const [profiles, domains] = await Promise.all([
      this.prisma.mentorProfile.findMany({
        where: { isPublished: true, user: { status: 'ACTIVE', role: 'MENTOR' } },
        select: { expertise: true },
      }),
      this.prisma.expertiseDomain.findMany({
        where: { isActive: true },
        select: {
          slug: true,
          name: true,
          icon: true,
          topics: true,
          _count: {
            select: {
              mentors: {
                where: {
                  mentorProfile: { isPublished: true, user: { status: 'ACTIVE', role: 'MENTOR' } },
                },
              },
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
      }),
    ]);
    const skills = new Map<string, number>();
    for (const p of profiles) for (const s of p.expertise) skills.set(s, (skills.get(s) ?? 0) + 1);
    this.vocabCache = {
      at: Date.now(),
      skills,
      domains: domains.map((d) => ({
        slug: d.slug,
        name: d.name,
        icon: d.icon,
        topics: d.topics,
        mentorCount: d._count.mentors,
      })),
    };
    return this.vocabCache;
  }

  /** Correction d'une faute de frappe : le mot connu le plus proche, s'il y en a un. */
  private async didYouMean(words: string[]): Promise<string | null> {
    const { skills, domains } = await this.vocabulary();
    const vocab = [...skills.keys(), ...domains.flatMap((d) => [d.name, ...d.topics])].flatMap(
      (v) => [v, ...v.split(/\s+/)],
    );
    const fixed = words.map((w) => closestWord(w, vocab));
    if (fixed.every((f, i) => !f || normalizeSearch(f) === words[i])) return null;
    return fixed.map((f, i) => f ?? words[i]).join(' ');
  }

  /** Suggestions pendant la saisie : domaines, compétences et mentors (noms publics). */
  async autocomplete(q: string) {
    const terms = tokenize(q);
    const phrase = normalizeSearch(q);
    if (phrase.length < 2) return { domains: [], skills: [], mentors: [] };
    const { skills, domains } = await this.vocabulary();
    const score = (label: string) => {
      const n = normalizeSearch(label);
      if (n.startsWith(phrase)) return 3;
      if (n.split(/\s+/).some((w) => w.startsWith(phrase))) return 2.5;
      if (terms.length === 0) return 0;
      const words = n.split(/[^a-z0-9+#]+/).filter(Boolean);
      const matched = terms.filter((t) =>
        t.forms.some((f) => words.some((w) => wordMatch(f, w) >= 0.7)),
      ).length;
      return matched === terms.length ? 1.5 + matched * 0.1 : matched > 0 ? 0.5 : 0;
    };
    const domainHits = domains
      .map((d) => ({
        d,
        s: Math.max(score(d.name), ...d.topics.map((t) => score(t) * 0.8)),
      }))
      .filter((x) => x.s > 0 && x.d.mentorCount > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 3)
      .map(({ d }) => ({ slug: d.slug, name: d.name, icon: d.icon, mentorCount: d.mentorCount }));
    const skillHits = [...skills.entries()]
      .map(([label, count]) => ({ label, count, s: score(label) }))
      .filter((x) => x.s >= 1)
      .sort((a, b) => b.s - a.s || b.count - a.count)
      .slice(0, 5)
      .map(({ label, count }) => ({ label, count }));
    const people = terms.length
      ? await this.prisma.user.findMany({
          where: {
            ...this.baseWhere(),
            OR: terms.flatMap((t) => [
              { firstName: { startsWith: t.word, mode: 'insensitive' as const } },
              { lastName: { startsWith: t.word, mode: 'insensitive' as const } },
            ]),
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUpdatedAt: true,
            mentorProfile: { select: { headline: true } },
          },
          take: 3,
        })
      : [];
    return {
      domains: domainHits,
      skills: skillHits,
      mentors: people.map((p) => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        avatarUpdatedAt: p.avatarUpdatedAt,
        headline: p.mentorProfile?.headline ?? '',
      })),
    };
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
    const [slots, feedbacks, pairs, certificates, completed] = await Promise.all([
      this.prisma.availabilitySlot.groupBy({
        by: ['mentorId'],
        where: { mentorId: { in: mentorIds }, ...freeSlotWhere(now) },
        _min: { startsAt: true },
      }),
      this.prisma.sessionFeedback.findMany({
        where: { session: { mentorId: { in: mentorIds } }, author: { role: 'MENTEE' } },
        select: { rating: true, session: { select: { mentorId: true } } },
      }),
      this.prisma.mentorship.groupBy({
        by: ['mentorId', 'menteeId'],
        where: { mentorId: { in: mentorIds }, status: { in: ['ACTIVE', 'COMPLETED'] } },
      }),
      this.prisma.mentorshipCertificate.groupBy({
        by: ['mentorId'],
        where: { mentorId: { in: mentorIds }, revokedAt: null },
        _count: { _all: true },
      }),
      this.prisma.mentorship.groupBy({
        by: ['mentorId'],
        where: { mentorId: { in: mentorIds }, status: 'COMPLETED' },
        _count: { _all: true },
      }),
    ]);
    for (const id of mentorIds)
      result.set(id, {
        nextAvailableAt: null,
        ratingSum: 0,
        ratingCount: 0,
        mentoredCount: 0,
        certificatesCount: 0,
        completedMentorships: 0,
      });
    for (const c of completed) result.get(c.mentorId)!.completedMentorships = c._count._all;
    for (const p of pairs) result.get(p.mentorId)!.mentoredCount += 1;
    for (const c of certificates) result.get(c.mentorId)!.certificatesCount = c._count._all;
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
      avatarUpdatedAt: row.avatarUpdatedAt,
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
      /** Personnes distinctes accompagnées (mentorats en cours ou menés à terme), tous domaines. */
      mentoredCount: extra?.mentoredCount ?? 0,
      /** Certificats d'accompagnement valides. */
      certificatesCount: extra?.certificatesCount ?? 0,
      nextAvailableAt,
      rating: {
        average: ratingCount ? Math.round((extra!.ratingSum / ratingCount) * 10) / 10 : null,
        count: ratingCount,
      },
      /** Accompagnements menés à terme. */
      completedMentorships: extra?.completedMentorships ?? 0,
      /** Badge « Mentor confirmé » (règle publique : voir ranking.ts). */
      isConfirmed: isConfirmedMentor({
        completedMentorships: extra?.completedMentorships ?? 0,
        ratingAverage: ratingCount ? extra!.ratingSum / ratingCount : null,
        ratingCount,
      }),
    };
  }
}

interface MentorExtras {
  nextAvailableAt: Date | null;
  ratingSum: number;
  ratingCount: number;
  mentoredCount: number;
  certificatesCount: number;
  completedMentorships: number;
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
