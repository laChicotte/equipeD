import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  API,
  createApp,
  createMentee,
  createMentor,
  createMentorship,
  createSlot,
  demoEmail,
  loginAs,
  type TestUser,
} from './helpers.js';

describe('Ressources et notifications', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
  });

  describe('bibliothèque publique', () => {
    it('est consultable sans connexion, filtrable et paginée', async () => {
      const all = await request(app.getHttpServer()).get(`${API}/resources`).expect(200);
      expect(all.body.total).toBeGreaterThanOrEqual(4);
      const campus = await request(app.getHttpServer())
        .get(`${API}/resources?domain=campus-france`)
        .expect(200);
      expect(
        campus.body.items.every(
          (r: { domain: { slug: string } }) => r.domain.slug === 'campus-france',
        ),
      ).toBe(true);
      const search = await request(app.getHttpServer())
        .get(`${API}/resources?q=portfolio`)
        .expect(200);
      expect(search.body.items[0].title).toMatch(/portfolio/i);
      expect(JSON.stringify(all.body)).not.toMatch(/email|passwordHash/);
    });

    it('n’expose jamais les ressources privées d’un mentorat', async () => {
      const mentor = await createMentor(app);
      const mentee = await createMentee(app);
      const mentorshipId = await createMentorship(mentee, mentor);
      await mentor.agent
        .post(`${API}/mentorships/${mentorshipId}/resources`)
        .send({ title: 'Ressource privée unique', description: 'Réservée à ce mentorat.' })
        .expect(201);
      const lib = await request(app.getHttpServer())
        .get(`${API}/resources?q=Ressource%20priv%C3%A9e%20unique`)
        .expect(200);
      expect(lib.body.total).toBe(0);
    });

    it('autorise la publication aux mentors, pas aux mentorés', async () => {
      const mentor = await createMentor(app);
      const mentee = await createMentee(app);
      const res = await mentor.agent
        .post(`${API}/resources`)
        .send({
          title: 'Préparer un entretien',
          kind: 'ADVICE',
          description: 'Préparez trois exemples concrets.',
        })
        .expect(201);
      expect(res.body.mentorshipId).toBeNull();
      await mentee.agent
        .post(`${API}/resources`)
        .send({ title: 'Test', description: 'x' })
        .expect(403);
    });

    it('valide le contenu : lien https ou description obligatoire', async () => {
      const mentor = await createMentor(app);
      const empty = await mentor.agent.post(`${API}/resources`).send({ title: 'Vide' }).expect(422);
      expect(empty.body.code).toBe('RESOURCE_EMPTY');
      await mentor.agent
        .post(`${API}/resources`)
        .send({ title: 'Lien', url: 'http://non-securise.example' })
        .expect(422);
      await mentor.agent
        .post(`${API}/resources`)
        .send({ title: 'Lien', url: 'javascript:alert(1)' })
        .expect(422);
    });

    it('réserve la suppression à l’auteur ou à un administrateur', async () => {
      const author = await createMentor(app);
      const other = await createMentor(app);
      const r1 = await author.agent
        .post(`${API}/resources`)
        .send({ title: 'À supprimer', description: 'x' })
        .expect(201);
      const denied = await other.agent.delete(`${API}/resources/${r1.body.id}`).expect(403);
      expect(denied.body.code).toBe('NOT_RESOURCE_AUTHOR');
      await author.agent.delete(`${API}/resources/${r1.body.id}`).expect(200);

      const r2 = await author.agent
        .post(`${API}/resources`)
        .send({ title: 'À modérer', description: 'x' })
        .expect(201);
      const admin = await loginAs(app, demoEmail('admin'));
      await admin.delete(`${API}/resources/${r2.body.id}`).expect(200);
    });
  });

  describe('ressources d’un mentorat', () => {
    let mentor: TestUser;
    let mentee: TestUser;
    let intruder: TestUser;
    let mentorshipId: string;

    beforeAll(async () => {
      [mentor, mentee, intruder] = await Promise.all([
        createMentor(app),
        createMentee(app),
        createMentee(app),
      ]);
      mentorshipId = await createMentorship(mentee, mentor);
    });

    it('permet aux deux participants de partager, et notifie l’autre', async () => {
      await mentee.agent.post(`${API}/notifications/read-all`).expect(200);
      await mentor.agent
        .post(`${API}/mentorships/${mentorshipId}/resources`)
        .send({
          title: 'Checklist portfolio',
          url: 'https://developer.mozilla.org/fr/',
          kind: 'TOOL',
        })
        .expect(201);
      await mentee.agent
        .post(`${API}/mentorships/${mentorshipId}/resources`)
        .send({ title: 'Mon brouillon de CV', description: 'Lien vers mon brouillon à relire.' })
        .expect(201);
      const list = await mentor.agent
        .get(`${API}/mentorships/${mentorshipId}/resources`)
        .expect(200);
      expect(list.body).toHaveLength(2);
      const notifs = await mentee.agent.get(`${API}/notifications?unread=true`).expect(200);
      expect(notifs.body[0]).toMatchObject({
        type: 'RESOURCE_SHARED',
        link: `/mentorats/${mentorshipId}`,
      });
    });

    it('interdit tout accès à un tiers, y compris la suppression', async () => {
      await intruder.agent.get(`${API}/mentorships/${mentorshipId}/resources`).expect(403);
      await intruder.agent
        .post(`${API}/mentorships/${mentorshipId}/resources`)
        .send({ title: 'Intrusion', description: 'x' })
        .expect(403);
      const list = await mentor.agent
        .get(`${API}/mentorships/${mentorshipId}/resources`)
        .expect(200);
      await intruder.agent.delete(`${API}/resources/${list.body[0].id}`).expect(403);
    });
  });

  describe('notifications', () => {
    it('suivent tout le parcours : demande, acceptation, réservation, confirmation, annulation, retour', async () => {
      const mentor = await createMentor(app);
      const mentee = await createMentee(app);
      const types = async (u: TestUser) =>
        ((await u.agent.get(`${API}/notifications`).expect(200)).body as { type: string }[]).map(
          (n) => n.type,
        );

      const req = await mentee.agent
        .post(`${API}/mentorship-requests`)
        .send({
          mentorId: mentor.id,
          goal: 'Préparer un entretien technique',
          message: 'Bonjour, j’aimerais être accompagné pour préparer mes entretiens techniques.',
        })
        .expect(201);
      expect(await types(mentor)).toContain('REQUEST_RECEIVED');

      const accepted = await mentor.agent
        .post(`${API}/mentorship-requests/${req.body.id}/accept`)
        .send({})
        .expect(200);
      const menteeNotifs = (await mentee.agent.get(`${API}/notifications`).expect(200)).body;
      expect(menteeNotifs[0]).toMatchObject({
        type: 'REQUEST_ACCEPTED',
        link: `/mentorats/${accepted.body.mentorship.id}`,
      });

      // Rejouer l'acceptation (idempotente) ne crée pas de doublon.
      await mentor.agent
        .post(`${API}/mentorship-requests/${req.body.id}/accept`)
        .send({})
        .expect(200);
      expect((await types(mentee)).filter((t) => t === 'REQUEST_ACCEPTED')).toHaveLength(1);

      const slotId = await createSlot(mentor, 12, 9);
      const session = await mentee.agent
        .post(`${API}/sessions`)
        .send({ slotId, topic: 'Simulation' })
        .expect(201);
      expect(await types(mentor)).toContain('SESSION_REQUESTED');
      await mentor.agent.post(`${API}/sessions/${session.body.id}/confirm`).send({}).expect(200);
      expect(await types(mentee)).toContain('SESSION_CONFIRMED');
      await mentee.agent.post(`${API}/sessions/${session.body.id}/cancel`).expect(200);
      expect(await types(mentor)).toContain('SESSION_CANCELLED');

      const goal = await mentee.agent
        .post(`${API}/mentorships/${accepted.body.mentorship.id}/goals`)
        .send({ title: 'Réussir trois entretiens blancs' })
        .expect(201);
      await mentor.agent
        .patch(`${API}/goals/${goal.body.id}`)
        .send({ mentorFeedback: 'Bon début.' })
        .expect(200);
      expect(await types(mentee)).toContain('GOAL_FEEDBACK');
    });

    it('notifie le refus avec la note du mentor', async () => {
      const mentor = await createMentor(app);
      const mentee = await createMentee(app);
      const req = await mentee.agent
        .post(`${API}/mentorship-requests`)
        .send({
          mentorId: mentor.id,
          goal: 'Lancer mon activité en ligne',
          message:
            'Bonjour, je souhaite être accompagné pour lancer mon activité de vente en ligne.',
        })
        .expect(201);
      await mentor.agent
        .post(`${API}/mentorship-requests/${req.body.id}/decline`)
        .send({ note: 'Je vous conseille un mentor en marketing digital.' })
        .expect(200);
      const [last] = (await mentee.agent.get(`${API}/notifications`).expect(200)).body;
      expect(last).toMatchObject({
        type: 'REQUEST_DECLINED',
        body: 'Je vous conseille un mentor en marketing digital.',
      });
    });

    it('gère le compteur de non-lus et la lecture', async () => {
      const mentor = await createMentor(app);
      const mentee = await createMentee(app);
      await createMentorship(mentee, mentor);
      const before = await mentor.agent.get(`${API}/notifications/unread-count`).expect(200);
      expect(before.body.count).toBe(1);
      const [n] = (await mentor.agent.get(`${API}/notifications?unread=true`).expect(200)).body;
      await mentor.agent.post(`${API}/notifications/${n.id}/read`).expect(200);
      expect(
        (await mentor.agent.get(`${API}/notifications/unread-count`).expect(200)).body.count,
      ).toBe(0);
    });

    it('cloisonne les notifications entre utilisateurs', async () => {
      const mentor = await createMentor(app);
      const mentee = await createMentee(app);
      await createMentorship(mentee, mentor);
      const [n] = (await mentor.agent.get(`${API}/notifications`).expect(200)).body;
      const res = await mentee.agent.post(`${API}/notifications/${n.id}/read`).expect(404);
      expect(res.body.code).toBe('NOTIFICATION_NOT_FOUND');
      await request(app.getHttpServer()).get(`${API}/notifications`).expect(401);
    });
  });
});
