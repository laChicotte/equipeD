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
  prismaOf,
} from './helpers.js';

describe('Évaluation des séances', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('refuse d’évaluer une séance qui n’est pas terminée (409 SESSION_NOT_ENDED)', async () => {
    const mentor = await createMentor(app);
    const mentee = await createMentee(app);
    await createMentorship(mentee, mentor);
    const slotId = await createSlot(mentor, 2, 9);
    const session = await mentee.agent
      .post(`${API}/sessions`)
      .send({ slotId, topic: 'Séance à venir' })
      .expect(201);
    const res = await mentee.agent
      .post(`${API}/sessions/${session.body.id}/feedback`)
      .send({ rating: 5 })
      .expect(409);
    expect(res.body.code).toBe('SESSION_NOT_ENDED');
  });

  describe('séance terminée', () => {
    let sessionId: string;
    let mentorId: string;
    let menteeAgent: Awaited<ReturnType<typeof createMentee>>['agent'];
    let mentorAgent: Awaited<ReturnType<typeof createMentor>>['agent'];

    beforeAll(async () => {
      const mentor = await createMentor(app);
      const mentee = await createMentee(app);
      const mentorshipId = await createMentorship(mentee, mentor);
      mentorId = mentor.id;
      menteeAgent = mentee.agent;
      mentorAgent = mentor.agent;
      // Séance passée insérée directement : l'API interdit (à juste titre) de réserver dans le passé.
      const start = new Date(Date.now() - 2 * 86_400_000);
      const s = await prismaOf(app).mentoringSession.create({
        data: {
          mentorshipId,
          mentorId: mentor.id,
          menteeId: mentee.id,
          startsAt: start,
          endsAt: new Date(start.getTime() + 3_600_000),
          status: 'CONFIRMED',
          topic: 'Séance passée',
        },
      });
      sessionId = s.id;
    });

    it('valide la note (1 à 5, entier)', async () => {
      await menteeAgent
        .post(`${API}/sessions/${sessionId}/feedback`)
        .send({ rating: 6 })
        .expect(422);
      await menteeAgent
        .post(`${API}/sessions/${sessionId}/feedback`)
        .send({ rating: 0 })
        .expect(422);
      await menteeAgent.post(`${API}/sessions/${sessionId}/feedback`).send({}).expect(422);
    });

    it('enregistre l’évaluation du mentoré, une seule fois', async () => {
      const res = await menteeAgent
        .post(`${API}/sessions/${sessionId}/feedback`)
        .send({ rating: 4, comment: 'Très utile' })
        .expect(201);
      expect(res.body.feedbacks).toHaveLength(1);
      expect(res.body.feedbacks[0]).toMatchObject({ rating: 4, comment: 'Très utile' });
      const again = await menteeAgent
        .post(`${API}/sessions/${sessionId}/feedback`)
        .send({ rating: 1 })
        .expect(409);
      expect(again.body.code).toBe('FEEDBACK_ALREADY_GIVEN');
    });

    it('permet aussi au mentor d’évaluer, mais pas à un tiers', async () => {
      await mentorAgent
        .post(`${API}/sessions/${sessionId}/feedback`)
        .send({ rating: 5 })
        .expect(201);
      const stranger = await createMentee(app);
      await stranger.agent
        .post(`${API}/sessions/${sessionId}/feedback`)
        .send({ rating: 1 })
        .expect(403);
    });

    it('affiche sur la fiche mentor la note moyenne laissée par les mentorés uniquement', async () => {
      const res = await request(app.getHttpServer()).get(`${API}/mentors/${mentorId}`).expect(200);
      expect(res.body.rating).toEqual({ average: 4, count: 1 });
    });
  });

  it('expose l’évaluation de la séance seedée (démo)', async () => {
    const mohamed = await loginAs(app, demoEmail('mohamed'));
    const past = await mohamed.get(`${API}/sessions/me?scope=past`).expect(200);
    const seeded = past.body.find((s: { topic: string }) => s.topic.startsWith('Clarifier'));
    expect(seeded.status).toBe('COMPLETED');
    expect(seeded.feedbacks[0].rating).toBe(5);
  });
});
