import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Injectable,
  Module,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { AppConfigService } from '../../config/app-config.service.js';
import { CurrentUser, Public, Roles } from '../../common/auth/decorators.js';
import type { Request } from 'express';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { conflict, DomainError, notFound } from '../../common/errors.js';
import { PrismaService } from '../../database/prisma.service.js';
import { computeMatch } from '../matching/matching.js';
import { MentorsModule } from '../mentors/mentors.module.js';
import { MentorsService } from '../mentors/mentors.service.js';
import { MentorshipAccessService } from '../mentorships/mentorship-access.service.js';
import {
  parseAssistant,
  parseExplanation,
  parseOrientation,
  parsePathProposal,
} from './ai.logic.js';
import { ASSISTANT_PAGES, VISITOR_PAGES } from './assistant.knowledge.js';
import {
  assistantPrompt,
  explanationPrompt,
  orientationPrompt,
  pathPrompt,
  templatesFor,
} from './ai.prompts.js';
import { OpenAiClient } from './openai.client.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const DAY_MS = 86_400_000;
/** Questions à l'assistant par visiteur non connecté (adresse IP) et par jour. */
const VISITOR_DAILY_LIMIT = 15;

export class OrientationDto {
  @Transform(trim)
  @IsString()
  @Length(20, 1000, { message: 'Décrivez votre besoin en 20 à 1000 caractères.' })
  need!: string;
}

export class AssistantTurnDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @MaxLength(1500)
  content!: string;
}

export class AssistantDto {
  @Transform(trim)
  @IsString()
  @Length(2, 600, { message: 'Posez votre question en 2 à 600 caractères.' })
  question!: string;

  /** Échanges précédents de la conversation (le serveur ne conserve rien). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => AssistantTurnDto)
  history: AssistantTurnDto[] = [];

  /** Page affichée, pour adapter la réponse (« je suis sur Disponibilités »). */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  page?: string;
}

export class PathProposalDto {
  /** Précision facultative : ce sur quoi le parcours doit insister. */
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: '300 caractères au maximum.' })
  focus?: string;
}

const unavailable = () =>
  new DomainError(
    HttpStatus.SERVICE_UNAVAILABLE,
    'AI_UNAVAILABLE',
    'L’assistant n’est pas disponible pour le moment. Réessayez plus tard.',
  );

/**
 * Assistance par IA, facultative : elle aide à formuler, sans jamais décider. Le score de
 * correspondance reste calculé par des règles (matching.ts) et rien n'est enregistré sans
 * validation humaine. Noms, emails et messages privés ne sont jamais envoyés au fournisseur.
 */
@Injectable()
export class AiService {
  /** Compteurs quotidiens en mémoire : garde-fou de coût pour une instance unique. */
  private usage = { day: 0, total: 0, perUser: new Map<string, number>() };
  private readonly explanations = new Map<string, { text: string; expiresAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly client: OpenAiClient,
    private readonly mentors: MentorsService,
    private readonly access: MentorshipAccessService,
  ) {}

  private counters() {
    const day = Math.floor(Date.now() / DAY_MS);
    if (this.usage.day !== day) this.usage = { day, total: 0, perUser: new Map() };
    return this.usage;
  }

  private remaining(userId: string) {
    const c = this.counters();
    return Math.max(
      0,
      Math.min(
        this.config.get('AI_USER_DAILY_LIMIT') - (c.perUser.get(userId) ?? 0),
        this.config.get('AI_GLOBAL_DAILY_LIMIT') - c.total,
      ),
    );
  }

  private consume(userId: string) {
    const c = this.counters();
    c.total += 1;
    c.perUser.set(userId, (c.perUser.get(userId) ?? 0) + 1);
  }

  /** Compétences que les mentors publiés proposent réellement : l'orientation s'y réfère. */
  private async availableSkills() {
    const rows = await this.prisma.mentorProfile.findMany({
      where: { isPublished: true, user: { status: 'ACTIVE' } },
      select: { expertise: true },
    });
    return [...new Set(rows.flatMap((r) => r.expertise))].sort((a, b) => a.localeCompare(b, 'fr'));
  }

  status(user: AuthUser | undefined, ip: string) {
    return {
      enabled: this.client.enabled,
      remainingToday: user ? this.remaining(user.id) : 0,
      assistantRemainingToday: this.assistantRemaining(user ? user.id : `ip:${ip}`, !user),
    };
  }

  /** L'assistant a son propre budget quotidien : une conversation compte plusieurs questions. */
  private assistantUsage = { day: 0, perUser: new Map<string, number>() };

  private assistantRemaining(userId: string, visitor = false) {
    const day = Math.floor(Date.now() / DAY_MS);
    if (this.assistantUsage.day !== day) this.assistantUsage = { day, perUser: new Map() };
    const c = this.counters();
    return Math.max(
      0,
      Math.min(
        // Visiteur non connecté (compté par adresse IP) : un budget plus réduit.
        (visitor ? VISITOR_DAILY_LIMIT : this.config.get('AI_ASSISTANT_DAILY_LIMIT')) -
          (this.assistantUsage.perUser.get(userId) ?? 0),
        this.config.get('AI_GLOBAL_DAILY_LIMIT') - c.total,
      ),
    );
  }

  /** Questions sur le fonctionnement de la plateforme, à partir du guide intégré. */
  async assistant(user: AuthUser | undefined, dto: AssistantDto, ip: string) {
    if (!this.client.enabled) throw unavailable();
    const key = user ? user.id : `ip:${ip}`;
    if (this.assistantRemaining(key, !user) === 0) {
      throw new DomainError(
        HttpStatus.TOO_MANY_REQUESTS,
        'AI_QUOTA_REACHED',
        'Vous avez posé beaucoup de questions aujourd’hui. L’assistant sera de nouveau disponible demain.',
      );
    }
    const account = user
      ? await this.prisma.user.findUnique({
          where: { id: user.id },
          select: {
            mentorProfile: { select: { id: true } },
            menteeProfile: { select: { id: true } },
          },
        })
      : null;
    const pages = user
      ? ASSISTANT_PAGES.filter((p) => p.roles === 'all' || p.roles.includes(user.role)).map(
          ({ href, label }) => ({ href, label }),
        )
      : VISITOR_PAGES;
    const page = dto.page && /^\/[a-z0-9\-/?=]*$/i.test(dto.page) ? dto.page.split('?')[0] : null;

    this.counters().total += 1;
    this.assistantUsage.perUser.set(key, (this.assistantUsage.perUser.get(key) ?? 0) + 1);
    const raw = await this.client.completeJson(
      assistantPrompt({
        role: user?.role ?? 'VISITOR',
        hasProfile: Boolean(account?.mentorProfile ?? account?.menteeProfile),
        page,
        pages,
        history: dto.history,
        question: dto.question,
      }),
    );
    const result = parseAssistant(raw, pages);
    if (!result) throw unavailable();
    return result;
  }

  private assertUsable(user: AuthUser) {
    if (!this.client.enabled) throw unavailable();
    if (this.remaining(user.id) === 0) {
      throw new DomainError(
        HttpStatus.TOO_MANY_REQUESTS,
        'AI_QUOTA_REACHED',
        'La limite quotidienne de l’assistant est atteinte. Réessayez demain.',
      );
    }
  }

  /** Orientation : du besoin formulé librement vers des domaines et compétences à rechercher. */
  async orientation(user: AuthUser, dto: OrientationDto) {
    this.assertUsable(user);
    const catalog = await this.prisma.expertiseDomain.findMany({
      where: { isActive: true },
      select: { id: true, slug: true, name: true, topics: true },
    });
    this.consume(user.id);
    const raw = await this.client.completeJson(
      orientationPrompt(dto.need, catalog, await this.availableSkills()),
    );
    const result = parseOrientation(raw, catalog);
    if (!result) throw unavailable();
    return result;
  }

  /**
   * « Pourquoi ce mentor ? » : le score et ses raisons viennent toujours des règles ; l'IA ne fait
   * que les reformuler. Sans IA (absente, quota, panne), les raisons sont renvoyées telles quelles.
   */
  async explanation(user: AuthUser, mentorId: string) {
    const mentee = await this.prisma.menteeProfile.findUnique({
      where: { userId: user.id },
      select: {
        goalsSummary: true,
        desiredSkills: true,
        preferredModality: true,
        updatedAt: true,
        interests: { select: { domainId: true } },
      },
    });
    if (!mentee) {
      throw conflict('MENTEE_PROFILE_REQUIRED', 'Complétez d’abord votre profil de mentoré·e.');
    }
    const mentor = await this.mentors.getById(mentorId, user);
    const horizon = new Date(Date.now() + 14 * DAY_MS);
    const match = computeMatch(
      {
        interestDomainIds: mentee.interests.map((i) => i.domainId),
        desiredSkills: mentee.desiredSkills,
        preferredModality: mentee.preferredModality,
      },
      {
        domains: mentor.domains,
        expertise: mentor.expertise,
        modalities: mentor.modalities,
        hasUpcomingAvailability: Boolean(
          mentor.nextAvailableAt && new Date(mentor.nextAvailableAt) <= horizon,
        ),
        isVerified: mentor.verificationStatus === 'VERIFIED',
      },
    );
    const rules = { score: match.score, reasons: match.reasons };
    if (match.reasons.length === 0 || !this.client.enabled) {
      return { ...rules, text: null, source: 'rules' as const };
    }

    const key = `${user.id}:${mentorId}:${mentee.updatedAt.getTime()}:${match.score}`;
    const cached = this.explanations.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return { ...rules, text: cached.text, source: 'ai' as const };
    }
    if (this.remaining(user.id) === 0) return { ...rules, text: null, source: 'rules' as const };

    this.consume(user.id);
    const raw = await this.client.completeJson(
      explanationPrompt({
        goalsSummary: mentee.goalsSummary,
        desiredSkills: mentee.desiredSkills,
        score: match.score,
        reasons: match.reasons,
        mentor: {
          headline: mentor.headline,
          yearsExperience: mentor.yearsExperience,
          expertise: mentor.expertise,
          domains: mentor.domains.map((d) => d.name),
        },
      }),
    );
    const text = parseExplanation(raw);
    if (!text) return { ...rules, text: null, source: 'rules' as const };
    if (this.explanations.size > 2000) this.explanations.clear();
    this.explanations.set(key, { text, expiresAt: Date.now() + DAY_MS });
    return { ...rules, text, source: 'ai' as const };
  }

  /** Proposition d'objectifs et de jalons : rien n'est créé tant qu'un participant ne l'a pas validée. */
  async pathProposal(user: AuthUser, mentorshipId: string, dto: PathProposalDto) {
    await this.access.assertActiveParticipant(user, mentorshipId);
    this.assertUsable(user);
    const mentorship = await this.prisma.mentorship.findUnique({
      where: { id: mentorshipId },
      select: {
        request: { select: { goal: true, domain: { select: { name: true, slug: true } } } },
        mentee: { select: { menteeProfile: { select: { situation: true } } } },
        goals: { select: { title: true } },
      },
    });
    if (!mentorship) throw notFound('MENTORSHIP_NOT_FOUND', 'Mentorat introuvable.');
    const existing = mentorship.goals.map((g) => g.title);
    this.consume(user.id);
    const raw = await this.client.completeJson(
      pathPrompt({
        initialGoal: mentorship.request.goal,
        domain: mentorship.request.domain?.name ?? null,
        situation: mentorship.mentee.menteeProfile?.situation ?? null,
        existingGoals: existing,
        focus: dto.focus,
        templates: templatesFor(mentorship.request.domain?.slug),
      }),
    );
    const result = parsePathProposal(raw, existing);
    if (!result) throw unavailable();
    return result;
  }
}

@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  /** Disponibilité de l'assistant : l'interface masque ce qui ne fonctionnerait pas. */
  @Public()
  @Get('status')
  status(@CurrentUser() user: AuthUser | undefined, @Req() req: Request) {
    return this.ai.status(user, req.ip ?? '');
  }

  /** Assistant : questions sur le fonctionnement de la plateforme (20 par minute au plus). */
  /** Ouvert aux visiteurs : ils découvrent la plateforme avant de créer un compte. */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(200)
  @Post('assistant')
  assistant(
    @CurrentUser() user: AuthUser | undefined,
    @Body() dto: AssistantDto,
    @Req() req: Request,
  ) {
    return this.ai.assistant(user, dto, req.ip ?? '');
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('orientation')
  orientation(@CurrentUser() user: AuthUser, @Body() dto: OrientationDto) {
    return this.ai.orientation(user, dto);
  }

  @Roles('MENTEE')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(200)
  @Post('mentors/:id/explanation')
  explanation(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ai.explanation(user, id);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('mentorships/:id/path-proposal')
  pathProposal(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: PathProposalDto,
  ) {
    return this.ai.pathProposal(user, id, dto);
  }
}

@Module({
  imports: [MentorsModule],
  controllers: [AiController],
  providers: [AiService, OpenAiClient],
})
export class AiModule {}
