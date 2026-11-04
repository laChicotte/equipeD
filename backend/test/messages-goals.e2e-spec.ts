import type { INestApplication } from '@nestjs/common';
import {
  API,
  createApp,
  createMentee,
  createMentor,
  createMentorship,
  prismaOf,
  type TestUser,
} from './helpers.js';

describe('Messagerie privée et objectifs', () => {
  let app: INestApplication;
  let mentor: TestUser;
  let mentee: TestUser;
  let intruder: TestUser;
  let mentorshipId: string;

  beforeAll(async () => {
    app = await createApp();
    [mentor, mentee, intruder] = await Promise.all([
      createMentor(app),
      createMentee(app),
      createMentee(app),
    ]);
    mentorshipId = await createMentorship(mentee, mentor);
  });
  afterAll(async () => {
    await app.close();
  });

  describe('messagerie', () => {
    it('échange, persiste et ordonne les messages entre participants', async () => {
      await mentee.agent
        .post(`${API}/mentorships/${mentorshipId}/messages`)
        .send({ content: '  Bonjour !  ' })
        .expect(201);
      await mentor.agent
        .post(`${API}/mentorships/${mentorshipId}/messages`)
        .send({ content: 'Bienvenue.' })
        .expect(201);
      const res = await mentor.agent.get(`${API}/mentorships/${mentorshipId}/messages`).expect(200);
      expect(res.body.map((m: { content: string }) => m.content)).toEqual([
        'Bonjour !',
        'Bienvenue.',
      ]);
      const stored = await prismaOf(app).message.count({ where: { mentorshipId } });
      expect(stored).toBe(2);
    });

    it('interdit toute lecture ou écriture à un tiers (403)', async () => {
      const read = await intruder.agent
        .get(`${API}/mentorships/${mentorshipId}/messages`)
        .expect(403);
      expect(read.body.code).toBe('NOT_PARTICIPANT');
      await intruder.agent
        .post(`${API}/mentorships/${mentorshipId}/messages`)
        .send({ content: 'Intrusion' })
        .expect(403);
      await intruder.agent.post(`${API}/mentorships/${mentorshipId}/messages/read`).expect(403);
    });

    it('rejette un message vide ou trop long (422)', async () => {
      await mentee.agent
        .post(`${API}/mentorships/${mentorshipId}/messages`)
        .send({ content: '   ' })
        .expect(422);
      await mentee.agent
        .post(`${API}/mentorships/${mentorshipId}/messages`)
        .send({ content: 'x'.repeat(2001) })
        .expect(422);
    });

    it('gère les non-lus et l’actualisation incrémentale', async () => {
      const before = await mentee.agent.get(`${API}/mentorships/${mentorshipId}`).expect(200);
      expect(before.body.unreadCount).toBe(1);
      const marked = await mentee.agent
        .post(`${API}/mentorships/${mentorshipId}/messages/read`)
        .expect(200);
      expect(marked.body.updated).toBe(1);
      const after = await mentee.agent.get(`${API}/mentorships/${mentorshipId}`).expect(200);
      expect(after.body.unreadCount).toBe(0);

      const all = await mentee.agent.get(`${API}/mentorships/${mentorshipId}/messages`).expect(200);
      const last = all.body.at(-1).createdAt as string;
      await mentor.agent
        .post(`${API}/mentorships/${mentorshipId}/messages`)
        .send({ content: 'Nouveau' })
        .expect(201);
      const delta = await mentee.agent
        .get(`${API}/mentorships/${mentorshipId}/messages?after=${encodeURIComponent(last)}`)
        .expect(200);
      expect(delta.body.map((m: { content: string }) => m.content)).toEqual(['Nouveau']);
    });

    it('renvoie 404 pour un mentorat inexistant', async () => {
      await mentee.agent.get(`${API}/mentorships/inexistant/messages`).expect(404);
    });
  });

  describe('objectifs et jalons', () => {
    let goalId: string;

    it('permet au mentoré de créer un objectif avec des jalons', async () => {
      const res = await mentee.agent
        .post(`${API}/mentorships/${mentorshipId}/goals`)
        .send({
          title: 'Publier mon portfolio',
          milestones: ['Maquette', 'Deux projets', 'Mise en ligne', 'Relecture'],
        })
        .expect(201);
      goalId = res.body.id;
      expect(res.body).toMatchObject({ status: 'NOT_STARTED', progress: 0 });
      expect(res.body.milestones).toHaveLength(4);
    });

    it('recalcule la progression quand un participant coche un jalon', async () => {
      const goal = await mentor.agent.get(`${API}/mentorships/${mentorshipId}/goals`).expect(200);
      const [m1, m2] = goal.body[0].milestones;
      await mentor.agent.patch(`${API}/milestones/${m1.id}`).send({ isDone: true }).expect(200);
      const res = await mentee.agent
        .patch(`${API}/milestones/${m2.id}`)
        .send({ isDone: true })
        .expect(200);
      expect(res.body).toMatchObject({ progress: 50, status: 'IN_PROGRESS' });
    });

    it('réserve le retour du mentor au mentor (403 MENTOR_ONLY)', async () => {
      const denied = await mentee.agent
        .patch(`${API}/goals/${goalId}`)
        .send({ mentorFeedback: 'Auto-évaluation' })
        .expect(403);
      expect(denied.body.code).toBe('MENTOR_ONLY');
      const ok = await mentor.agent
        .patch(`${API}/goals/${goalId}`)
        .send({ mentorFeedback: 'Très bon rythme, ajoute un projet API.' })
        .expect(200);
      expect(ok.body.mentorFeedback).toMatch(/projet API/);
    });

    it('déduit le statut de la progression manuelle et borne la valeur', async () => {
      const g = await mentee.agent
        .post(`${API}/mentorships/${mentorshipId}/goals`)
        .send({ title: 'Lire un livre sur l’architecture' })
        .expect(201);
      const done = await mentee.agent
        .patch(`${API}/goals/${g.body.id}`)
        .send({ progress: 100 })
        .expect(200);
      expect(done.body.status).toBe('COMPLETED');
      expect(done.body.completedAt).toBeTruthy();
      await mentee.agent.patch(`${API}/goals/${g.body.id}`).send({ progress: 150 }).expect(422);
    });

    it('interdit l’accès aux objectifs à un tiers', async () => {
      await intruder.agent.get(`${API}/mentorships/${mentorshipId}/goals`).expect(403);
      await intruder.agent.patch(`${API}/goals/${goalId}`).send({ progress: 10 }).expect(403);
    });

    it('réserve la suppression à l’auteur de l’objectif', async () => {
      const del = await mentor.agent.delete(`${API}/goals/${goalId}`).expect(403);
      expect(del.body.code).toBe('NOT_GOAL_AUTHOR');
      await mentee.agent.delete(`${API}/goals/${goalId}`).expect(200);
    });

    it('reflète les objectifs dans le tableau de bord', async () => {
      const res = await mentor.agent.get(`${API}/dashboard/me`).expect(200);
      expect(res.body.role).toBe('MENTOR');
      expect(res.body.activeMentorships).toBe(1);
      expect(res.body.goals.total).toBeGreaterThanOrEqual(1);
    });
  });
});
