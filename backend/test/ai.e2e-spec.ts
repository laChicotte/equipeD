import type { INestApplication } from '@nestjs/common';
import { vi } from 'vitest';
import { OpenAiClient, type JsonCompletion } from '../src/modules/ai/openai.client.js';
import {
  API,
  createApp,
  createMentee,
  createMentor,
  createMentorship,
  prismaOf,
  type TestUser,
} from './helpers.js';

describe('Assistance par IA (fournisseur simulé)', () => {
  let app: INestApplication;
  let mentor: TestUser;
  let mentee: TestUser;
  let stranger: TestUser;
  let mentorshipId: string;
  let calls: JsonCompletion[];
  let reply: (r: JsonCompletion) => unknown;

  beforeAll(async () => {
    app = await createApp();
    [mentor, mentee, stranger] = await Promise.all([
      createMentor(app),
      createMentee(app),
      createMentee(app),
    ]);
    mentorshipId = await createMentorship(mentee, mentor);
  });
  beforeEach(() => {
    calls = [];
    const client = app.get(OpenAiClient);
    vi.spyOn(client, 'enabled', 'get').mockReturnValue(true);
    vi.spyOn(client, 'completeJson').mockImplementation((r) => {
      calls.push(r);
      return Promise.resolve(reply(r));
    });
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await app.close();
  });

  it('oriente vers des domaines réels sans envoyer de coordonnées', async () => {
    reply = () => ({
      summary: 'Vous voulez devenir développeur.',
      domains: [
        { slug: 'numerique-technologies', reason: 'Le web en fait partie.' },
        { slug: 'domaine-invente', reason: 'Écarté.' },
      ],
      skills: ['React', 'Portfolio'],
    });
    const res = await mentee.agent
      .post(`${API}/ai/orientation`)
      .send({ need: 'Je veux devenir développeur, écrivez-moi à moi@mail.gn ou au 622123456.' })
      .expect(200);
    expect(res.body.domains).toHaveLength(1);
    expect(res.body.domains[0].slug).toBe('numerique-technologies');
    expect(res.body.skills).toEqual(['React', 'Portfolio']);
    expect(calls[0].user).not.toMatch(/moi@mail|622123456/);

    const short = await mentee.agent
      .post(`${API}/ai/orientation`)
      .send({ need: 'court' })
      .expect(422);
    expect(short.body.code).toBe('VALIDATION_FAILED');
  });

  it('signale une panne du fournisseur sans erreur 500', async () => {
    reply = () => null;
    const res = await mentee.agent
      .post(`${API}/ai/orientation`)
      .send({ need: 'Je cherche à créer mon entreprise de livraison à Conakry.' })
      .expect(503);
    expect(res.body.code).toBe('AI_UNAVAILABLE');
  });

  it('explique un mentor à partir du score par règles, avec repli et cache', async () => {
    reply = () => ({ explanation: 'Ce mentor couvre votre domaine et le web.' });
    const first = await mentee.agent.post(`${API}/ai/mentors/${mentor.id}/explanation`).expect(200);
    expect(first.body).toMatchObject({
      source: 'ai',
      text: 'Ce mentor couvre votre domaine et le web.',
    });
    expect(first.body.score).toBeGreaterThan(0);
    expect(first.body.reasons.length).toBeGreaterThan(0);
    // Ni nom ni identifiant de personne dans ce qui part chez le fournisseur.
    expect(calls[0].user).not.toMatch(/Test Mentor|Mentoré|example\.test/);

    // Deuxième demande : servie par le cache, sans nouvel appel payant.
    await mentee.agent.post(`${API}/ai/mentors/${mentor.id}/explanation`).expect(200);
    expect(calls).toHaveLength(1);

    // Fournisseur en panne ou absent : les raisons calculées restent disponibles.
    const other = await createMentor(app);
    reply = () => null;
    const fallback = await mentee.agent
      .post(`${API}/ai/mentors/${other.id}/explanation`)
      .expect(200);
    expect(fallback.body).toMatchObject({ source: 'rules', text: null });
    expect(fallback.body.reasons.length).toBeGreaterThan(0);

    await mentor.agent.post(`${API}/ai/mentors/${other.id}/explanation`).expect(403);
  });

  it('propose un parcours aux seuls participants, sans rien enregistrer', async () => {
    reply = () => ({
      goals: [
        {
          title: 'Construire un portfolio',
          description: 'Trois projets montrés.',
          milestones: ['Choisir les projets', 'Publier le site'],
        },
      ],
    });
    const before = await prismaOf(app).goal.count({ where: { mentorshipId } });
    const res = await mentor.agent
      .post(`${API}/ai/mentorships/${mentorshipId}/path-proposal`)
      .send({ focus: 'Priorité au premier emploi' })
      .expect(200);
    expect(res.body.goals[0].title).toBe('Construire un portfolio');
    expect(await prismaOf(app).goal.count({ where: { mentorshipId } })).toBe(before);

    await stranger.agent
      .post(`${API}/ai/mentorships/${mentorshipId}/path-proposal`)
      .send({})
      .expect(403);
  });

  it('applique le quota quotidien par personne', async () => {
    reply = () => ({
      summary: 'Besoin reformulé.',
      domains: [{ slug: 'numerique-technologies', reason: 'Raison.' }],
      skills: [],
    });
    const user = await createMentee(app);
    const status = await user.agent.get(`${API}/ai/status`).expect(200);
    expect(status.body).toMatchObject({ enabled: true, remainingToday: 30 });
    const send = () =>
      user.agent
        .post(`${API}/ai/orientation`)
        .send({ need: 'Je cherche un accompagnement pour progresser.' });
    for (let i = 0; i < 30; i++) await send().expect(200);
    const after = await user.agent.get(`${API}/ai/status`).expect(200);
    expect(after.body.remainingToday).toBe(0);
    const refused = await send().expect(429);
    expect(refused.body.code).toBe('AI_QUOTA_REACHED');
  });

  it('est masquable : sans clé, le statut l’indique et les routes refusent', async () => {
    vi.spyOn(app.get(OpenAiClient), 'enabled', 'get').mockReturnValue(false);
    expect((await mentee.agent.get(`${API}/ai/status`).expect(200)).body.enabled).toBe(false);
    await mentee.agent
      .post(`${API}/ai/orientation`)
      .send({ need: 'Je cherche un accompagnement pour progresser.' })
      .expect(503);
  });
});

describe('Messages renvoyés après une coupure', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('ne duplique pas un message envoyé deux fois avec le même identifiant', async () => {
    const mentor = await createMentor(app);
    const mentee = await createMentee(app);
    const mentorshipId = await createMentorship(mentee, mentor);
    const clientId = '5f3c0a52-1f7e-4c55-9d3a-0a1b2c3d4e5f';
    const body = { content: 'Écrit hors ligne', clientId };
    const first = await mentee.agent
      .post(`${API}/mentorships/${mentorshipId}/messages`)
      .send(body)
      .expect(201);
    const again = await mentee.agent
      .post(`${API}/mentorships/${mentorshipId}/messages`)
      .send(body)
      .expect(201);
    expect(again.body.id).toBe(first.body.id);
    const list = await mentor.agent.get(`${API}/mentorships/${mentorshipId}/messages`).expect(200);
    expect(list.body).toHaveLength(1);

    const group = await mentor.agent
      .post(`${API}/groups`)
      .send({ name: 'Groupe coupure', memberIds: [mentee.id] })
      .expect(201);
    for (let i = 0; i < 2; i++) {
      await mentee.agent
        .post(`${API}/groups/${group.body.id}/messages`)
        .send({ content: 'Écrit hors ligne', clientId: 'groupe-0001' })
        .expect(201);
    }
    const thread = await mentor.agent.get(`${API}/groups/${group.body.id}/messages`).expect(200);
    expect(thread.body).toHaveLength(1);

    await mentee.agent
      .post(`${API}/mentorships/${mentorshipId}/messages`)
      .send({ content: 'x', clientId: 'mauvais identifiant !' })
      .expect(422);
  });
});
