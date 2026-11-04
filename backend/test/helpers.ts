import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { setupApp } from '../src/setup-app.js';

export const API = '/api/v1';
export const DEMO_PASSWORD = 'Mentorat2026!';
export const TEST_PASSWORD = 'Motdepasse2026';
export type Agent = ReturnType<typeof request.agent>;

export async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ bodyParser: false });
  setupApp(app);
  // Écoute réelle sur un port libre : évite que des agents supertest concurrents
  // démarrent et arrêtent chacun le serveur (ECONNREFUSED).
  await app.listen(0, '127.0.0.1');
  return app;
}

export function prismaOf(app: INestApplication): PrismaService {
  return app.get(PrismaService);
}

export const uniqueEmail = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8)}@example.test`;

/** Agent supertest authentifié (le cookie de session est conservé entre les requêtes). */
export async function loginAs(
  app: INestApplication,
  email: string,
  password = DEMO_PASSWORD,
): Promise<Agent> {
  const agent = request.agent(app.getHttpServer());
  await agent.post(`${API}/auth/login`).send({ email, password }).expect(200);
  return agent;
}

export const demoEmail = (key: string) => `${key}@demo.talents-connectes.test`;

async function domainIds(app: INestApplication, slugs: string[]): Promise<string[]> {
  const rows = await prismaOf(app).expertiseDomain.findMany({
    where: { slug: { in: slugs } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export interface TestUser {
  agent: Agent;
  id: string;
  email: string;
}

/** Nouveau mentoré inscrit via l'API, avec profil complet (domaine numérique). */
export async function createMentee(
  app: INestApplication,
  opts: { withProfile?: boolean } = {},
): Promise<TestUser> {
  const email = uniqueEmail('mentee');
  const agent = request.agent(app.getHttpServer());
  await agent
    .post(`${API}/auth/register`)
    .send({
      email,
      password: TEST_PASSWORD,
      firstName: 'Test',
      lastName: 'Mentoré',
      role: 'MENTEE',
    })
    .expect(201);
  if (opts.withProfile !== false) {
    await agent
      .put(`${API}/profile/mentee`)
      .send({
        situation: 'STUDENT',
        goalsSummary: 'Je souhaite progresser en développement web et trouver un stage.',
        desiredSkills: ['React'],
        preferredModality: 'REMOTE',
        interestDomainIds: await domainIds(app, ['numerique-technologies']),
      })
      .expect(200);
  }
  const me = await agent.get(`${API}/auth/me`).expect(200);
  return { agent, id: me.body.id, email };
}

/** Nouveau mentor inscrit via l'API, avec profil publié. */
export async function createMentor(
  app: INestApplication,
  opts: { maxMentees?: number } = {},
): Promise<TestUser> {
  const email = uniqueEmail('mentor');
  const agent = request.agent(app.getHttpServer());
  await agent
    .post(`${API}/auth/register`)
    .send({ email, password: TEST_PASSWORD, firstName: 'Test', lastName: 'Mentor', role: 'MENTOR' })
    .expect(201);
  await agent
    .put(`${API}/profile/mentor`)
    .send({
      headline: 'Mentor de test en développement web',
      bio: 'Profil créé automatiquement par la suite de tests e2e. Il sert à vérifier les règles métier de bout en bout sans dépendre des données de démonstration.',
      yearsExperience: 5,
      expertise: ['Développement web', 'TypeScript'],
      languages: ['Français'],
      modalities: ['REMOTE'],
      domainIds: await domainIds(app, ['numerique-technologies']),
      sessionDurationMin: 60,
      maxMentees: opts.maxMentees ?? 5,
    })
    .expect(200);
  const me = await agent.get(`${API}/auth/me`).expect(200);
  return { agent, id: me.body.id, email };
}

/** Demande + acceptation : renvoie l'identifiant du mentorat actif. */
export async function createMentorship(mentee: TestUser, mentor: TestUser): Promise<string> {
  const req = await mentee.agent
    .post(`${API}/mentorship-requests`)
    .send({
      mentorId: mentor.id,
      goal: 'Construire un portfolio professionnel',
      message:
        'Bonjour, je souhaite être accompagné pour structurer mon apprentissage et mon portfolio.',
    })
    .expect(201);
  const accepted = await mentor.agent
    .post(`${API}/mentorship-requests/${req.body.id}/accept`)
    .send({})
    .expect(200);
  return accepted.body.mentorship.id as string;
}

/** Créneau d'une heure à J+days, à l'heure UTC donnée. */
export function slotAt(days: number, hourUtc: number, durationMin = 60) {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + days);
  start.setUTCHours(hourUtc, 0, 0, 0);
  return {
    startsAt: start.toISOString(),
    endsAt: new Date(start.getTime() + durationMin * 60_000).toISOString(),
  };
}

export async function createSlot(mentor: TestUser, days: number, hourUtc: number): Promise<string> {
  const res = await mentor.agent
    .post(`${API}/availability`)
    .send(slotAt(days, hourUtc))
    .expect(201);
  return res.body.id as string;
}
