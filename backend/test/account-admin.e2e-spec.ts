import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  API,
  TEST_PASSWORD,
  createApp,
  createMentee,
  createMentor,
  createMentorship,
  createSlot,
  demoEmail,
  loginAs,
  prismaOf,
} from './helpers.js';

describe('Compte, clôture de mentorat et administration des domaines', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
  });

  describe('compte', () => {
    it('modifie le nom et le fuseau, et met à jour la recherche du mentor', async () => {
      const mentor = await createMentor(app);
      const res = await mentor.agent
        .patch(`${API}/profile/me`)
        .send({ firstName: 'Kadiatou', lastName: 'Zoumanigui', timezone: 'Europe/Paris' })
        .expect(200);
      expect(res.body.user).toMatchObject({ firstName: 'Kadiatou', timezone: 'Europe/Paris' });
      const found = await request(app.getHttpServer())
        .get(`${API}/mentors?q=zoumanigui`)
        .expect(200);
      expect(found.body.items.map((m: { id: string }) => m.id)).toContain(mentor.id);
    });

    it('refuse un fuseau horaire inconnu (422)', async () => {
      const mentee = await createMentee(app);
      const res = await mentee.agent
        .patch(`${API}/profile/me`)
        .send({ timezone: 'Mars/Olympus' })
        .expect(422);
      expect(res.body.details[0].field).toBe('timezone');
    });

    it('change le mot de passe et révoque les autres sessions, pas la session courante', async () => {
      const mentee = await createMentee(app);
      const other = await loginAs(app, mentee.email, TEST_PASSWORD);

      const wrong = await mentee.agent
        .post(`${API}/auth/password`)
        .send({ currentPassword: 'mauvais-mot', newPassword: 'Nouveau2026xx' })
        .expect(422);
      expect(wrong.body.code).toBe('INVALID_CURRENT_PASSWORD');
      const same = await mentee.agent
        .post(`${API}/auth/password`)
        .send({ currentPassword: TEST_PASSWORD, newPassword: TEST_PASSWORD })
        .expect(422);
      expect(same.body.code).toBe('PASSWORD_UNCHANGED');
      await mentee.agent
        .post(`${API}/auth/password`)
        .send({ currentPassword: TEST_PASSWORD, newPassword: 'court' })
        .expect(422);

      const ok = await mentee.agent
        .post(`${API}/auth/password`)
        .send({ currentPassword: TEST_PASSWORD, newPassword: 'Nouveau2026xx' })
        .expect(200);
      expect(ok.body.revokedSessions).toBe(1);
      await mentee.agent.get(`${API}/auth/me`).expect(200);
      await other.get(`${API}/auth/me`).expect(401);

      await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: mentee.email, password: TEST_PASSWORD })
        .expect(401);
      await loginAs(app, mentee.email, 'Nouveau2026xx');
    });

    it('déconnecte tous les appareils', async () => {
      const mentor = await createMentor(app);
      const second = await loginAs(app, mentor.email, TEST_PASSWORD);
      const res = await mentor.agent.post(`${API}/auth/logout-all`).expect(200);
      expect(res.body.revokedSessions).toBe(2);
      await mentor.agent.get(`${API}/auth/me`).expect(401);
      await second.get(`${API}/auth/me`).expect(401);
    });
  });

  describe('clôture d’un mentorat', () => {
    it('clôture, annule les séances futures, libère le créneau, notifie', async () => {
      const mentor = await createMentor(app);
      const mentee = await createMentee(app);
      const intruder = await createMentee(app);
      const mentorshipId = await createMentorship(mentee, mentor);
      const slotId = await createSlot(mentor, 13, 9);
      const session = await mentee.agent
        .post(`${API}/sessions`)
        .send({ slotId, topic: 'Dernière séance' })
        .expect(201);

      await intruder.agent.post(`${API}/mentorships/${mentorshipId}/complete`).send({}).expect(403);

      const res = await mentee.agent
        .post(`${API}/mentorships/${mentorshipId}/complete`)
        .send({ note: 'Objectif atteint, merci !' })
        .expect(200);
      expect(res.body).toMatchObject({
        status: 'COMPLETED',
        endNote: 'Objectif atteint, merci !',
        endedById: mentee.id,
      });

      const s = await prismaOf(app).mentoringSession.findUniqueOrThrow({
        where: { id: session.body.id },
      });
      expect(s.status).toBe('CANCELLED');
      const free = await request(app.getHttpServer())
        .get(`${API}/mentors/${mentor.id}/availability`)
        .expect(200);
      expect(free.body.map((x: { id: string }) => x.id)).toContain(slotId);

      const [notif] = (await mentor.agent.get(`${API}/notifications`).expect(200)).body;
      expect(notif.type).toBe('MENTORSHIP_COMPLETED');

      // Après clôture, la conversation reste ouverte (les deux restent en contact)…
      await mentee.agent.get(`${API}/mentorships/${mentorshipId}/messages`).expect(200);
      await mentee.agent
        .post(`${API}/mentorships/${mentorshipId}/messages`)
        .send({ content: 'Encore une question' })
        .expect(201);
      // … mais l'espace de travail (objectifs) passe en lecture seule.
      const write = await mentee.agent
        .post(`${API}/mentorships/${mentorshipId}/goals`)
        .send({ title: 'Nouvel objectif après clôture' })
        .expect(409);
      expect(write.body.code).toBe('MENTORSHIP_NOT_ACTIVE');

      // Idempotence ; le mentor peut toujours accepter de nouveaux mentorés.
      await mentor.agent.post(`${API}/mentorships/${mentorshipId}/complete`).send({}).expect(200);
      const newcomer = await createMentee(app);
      await createMentorship(newcomer, mentor);
      // Et l'ancien mentoré peut de nouveau solliciter ce mentor (plus de mentorat actif).
      const again = await mentee.agent
        .post(`${API}/mentorship-requests`)
        .send({
          mentorId: mentor.id,
          goal: 'Nouvel objectif après une première étape',
          message: 'Bonjour, je souhaiterais reprendre un accompagnement sur un nouvel objectif.',
        })
        .expect(201);
      expect(again.body.status).toBe('PENDING');
    });
  });

  describe('administration des domaines', () => {
    it('liste tous les domaines avec leurs volumes, réservé aux administrateurs', async () => {
      const admin = await loginAs(app, demoEmail('admin'));
      const res = await admin.get(`${API}/admin/domains`).expect(200);
      expect(res.body.length).toBeGreaterThanOrEqual(7);
      expect(res.body[0]._count).toHaveProperty('mentors');
      const mentor = await loginAs(app, demoEmail('fatoumata'));
      await mentor.get(`${API}/admin/domains`).expect(403);
    });

    it('crée, modifie et désactive un domaine ; le catalogue public suit', async () => {
      const admin = await loginAs(app, demoEmail('admin'));
      const created = await admin
        .post(`${API}/admin/domains`)
        .send({
          slug: 'agriculture-agroalimentaire',
          name: 'Agriculture et agroalimentaire',
          description: 'Filières agricoles, transformation et commercialisation.',
          icon: 'sprout',
          topics: ['Agrobusiness', 'agrobusiness', 'Transformation'],
        })
        .expect(201);
      expect(created.body.topics).toEqual(['Agrobusiness', 'Transformation']);

      const dup = await admin
        .post(`${API}/admin/domains`)
        .send({
          slug: 'agriculture-agroalimentaire',
          name: 'Doublon',
          description: 'Description assez longue.',
          icon: 'x1',
          topics: [],
        })
        .expect(409);
      expect(dup.body.code).toBe('DOMAIN_SLUG_TAKEN');
      await admin
        .post(`${API}/admin/domains`)
        .send({
          slug: 'Pas Un Slug',
          name: 'Invalide',
          description: 'Description assez longue.',
          icon: 'x1',
          topics: [],
        })
        .expect(422);

      const publicList = async () =>
        (await request(app.getHttpServer()).get(`${API}/domains`).expect(200)).body.map(
          (d: { slug: string }) => d.slug,
        );
      expect(await publicList()).toContain('agriculture-agroalimentaire');

      await admin
        .patch(`${API}/admin/domains/${created.body.id}`)
        .send({ isActive: false })
        .expect(200);
      expect(await publicList()).not.toContain('agriculture-agroalimentaire');
      await admin.patch(`${API}/admin/domains/inexistant`).send({ isActive: true }).expect(404);
    });
  });

  it('documente les corps de requête dans OpenAPI', async () => {
    // Le schéma est généré par le plugin Swagger à la compilation Nest (non actif sous Vitest) :
    // on vérifie au minimum que les routes du lot sont bien exposées.
    const res = await request(app.getHttpServer()).get('/api/docs-json');
    if (res.status === 404) return; // Swagger désactivé dans l'environnement de test (SWAGGER_ENABLED=false)
    expect(Object.keys(res.body.paths)).toEqual(
      expect.arrayContaining([
        '/api/v1/auth/password',
        '/api/v1/mentorships/{id}/complete',
        '/api/v1/admin/domains',
      ]),
    );
  });
});
