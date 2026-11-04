import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  API,
  createApp,
  createMentee,
  createMentor,
  createMentorship,
  createSlot,
  prismaOf,
  slotAt,
  type TestUser,
} from './helpers.js';

describe('Disponibilités et séances', () => {
  let app: INestApplication;
  let mentor: TestUser;
  let mentee: TestUser;
  beforeAll(async () => {
    app = await createApp();
    mentor = await createMentor(app);
    mentee = await createMentee(app);
    await createMentorship(mentee, mentor);
  });
  afterAll(async () => {
    await app.close();
  });

  describe('créneaux', () => {
    it('crée un créneau et le publie dans les disponibilités du mentor', async () => {
      const id = await createSlot(mentor, 3, 9);
      const free = await request(app.getHttpServer())
        .get(`${API}/mentors/${mentor.id}/availability`)
        .expect(200);
      expect(free.body.map((s: { id: string }) => s.id)).toContain(id);
    });

    it('refuse un créneau qui en chevauche un autre (409 SLOT_OVERLAP)', async () => {
      await createSlot(mentor, 4, 9);
      const overlapping = slotAt(4, 9);
      overlapping.startsAt = new Date(
        new Date(overlapping.startsAt).getTime() + 30 * 60_000,
      ).toISOString();
      overlapping.endsAt = new Date(
        new Date(overlapping.endsAt).getTime() + 30 * 60_000,
      ).toISOString();
      const res = await mentor.agent.post(`${API}/availability`).send(overlapping).expect(409);
      expect(res.body.code).toBe('SLOT_OVERLAP');
    });

    it('accepte deux créneaux contigus (bornes semi-ouvertes)', async () => {
      await createSlot(mentor, 5, 9);
      await createSlot(mentor, 5, 10);
    });

    it('refuse les créneaux passés, trop courts ou trop longs (422)', async () => {
      const past = await mentor.agent.post(`${API}/availability`).send(slotAt(-1, 9)).expect(422);
      expect(past.body.code).toBe('SLOT_IN_PAST');
      const short = await mentor.agent
        .post(`${API}/availability`)
        .send(slotAt(6, 9, 10))
        .expect(422);
      expect(short.body.code).toBe('SLOT_INVALID_DURATION');
      await mentor.agent
        .post(`${API}/availability`)
        .send(slotAt(6, 9, 300))
        .expect(422);
      await mentor.agent
        .post(`${API}/availability`)
        .send({ startsAt: 'demain', endsAt: 'après' })
        .expect(422);
    });

    it('réserve la création de créneaux aux mentors', async () => {
      await mentee.agent.post(`${API}/availability`).send(slotAt(7, 9)).expect(403);
    });

    it('empêche un mentor de supprimer le créneau d’un autre', async () => {
      const id = await createSlot(mentor, 7, 11);
      const other = await createMentor(app);
      await other.agent.delete(`${API}/availability/${id}`).expect(403);
      await mentor.agent.delete(`${API}/availability/${id}`).expect(200);
      const free = await request(app.getHttpServer())
        .get(`${API}/mentors/${mentor.id}/availability`)
        .expect(200);
      expect(free.body.map((s: { id: string }) => s.id)).not.toContain(id);
    });
  });

  describe('réservation', () => {
    it('interdit de réserver chez un mentor sans mentorat actif (403 NO_ACTIVE_MENTORSHIP)', async () => {
      const slotId = await createSlot(mentor, 8, 9);
      const stranger = await createMentee(app);
      const res = await stranger.agent
        .post(`${API}/sessions`)
        .send({ slotId, topic: 'Tentative' })
        .expect(403);
      expect(res.body.code).toBe('NO_ACTIVE_MENTORSHIP');
    });

    it('ne crée qu’une seule séance quand 8 réservations simultanées visent le même créneau', async () => {
      const slotId = await createSlot(mentor, 9, 9);
      const others = await Promise.all(Array.from({ length: 3 }, () => createMentee(app)));
      await Promise.all(others.map((m) => createMentorship(m, mentor)));
      const contenders = [mentee, ...others];
      const results = await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          contenders[i % contenders.length].agent
            .post(`${API}/sessions`)
            .send({ slotId, topic: `Séance ${i}` }),
        ),
      );
      const statuses = results.map((r) => r.status);
      expect(statuses.filter((s) => s === 201)).toHaveLength(1);
      expect(statuses.filter((s) => s === 409)).toHaveLength(7);
      for (const r of results.filter((x) => x.status === 409)) {
        expect(['SLOT_ALREADY_BOOKED', 'MENTEE_TIME_CONFLICT']).toContain(r.body.code);
      }
      const active = await prismaOf(app).mentoringSession.count({
        where: { slotId, status: { in: ['REQUESTED', 'CONFIRMED'] } },
      });
      expect(active).toBe(1);
    });

    it('déroule le cycle REQUESTED → CONFIRMED, avec les bonnes permissions', async () => {
      const slotId = await createSlot(mentor, 10, 9);
      const booked = await mentee.agent
        .post(`${API}/sessions`)
        .send({ slotId, topic: 'Revue de mon portfolio' })
        .expect(201);
      expect(booked.body.status).toBe('REQUESTED');

      const free = await request(app.getHttpServer())
        .get(`${API}/mentors/${mentor.id}/availability`)
        .expect(200);
      expect(free.body.map((s: { id: string }) => s.id)).not.toContain(slotId);

      await mentee.agent.post(`${API}/sessions/${booked.body.id}/confirm`).send({}).expect(403);
      const other = await createMentor(app);
      const foreign = await other.agent
        .post(`${API}/sessions/${booked.body.id}/confirm`)
        .send({})
        .expect(403);
      expect(foreign.body.code).toBe('NOT_SESSION_MENTOR');

      await mentor.agent
        .post(`${API}/sessions/${booked.body.id}/confirm`)
        .send({ meetingUrl: 'http://non-securise.example' })
        .expect(422);
      const confirmed = await mentor.agent
        .post(`${API}/sessions/${booked.body.id}/confirm`)
        .send({ meetingUrl: 'https://meet.example.org/abc' })
        .expect(200);
      expect(confirmed.body).toMatchObject({
        status: 'CONFIRMED',
        meetingUrl: 'https://meet.example.org/abc',
      });

      const upcoming = await mentee.agent.get(`${API}/sessions/me?scope=upcoming`).expect(200);
      expect(upcoming.body.map((s: { id: string }) => s.id)).toContain(booked.body.id);

      const del = await mentor.agent.delete(`${API}/availability/${slotId}`).expect(409);
      expect(del.body.code).toBe('SLOT_BOOKED');

      const early = await mentor.agent
        .post(`${API}/sessions/${booked.body.id}/complete`)
        .expect(409);
      expect(early.body.code).toBe('SESSION_NOT_STARTED');
    });

    it('libère le créneau après annulation et permet de le réserver à nouveau', async () => {
      const slotId = await createSlot(mentor, 11, 9);
      const first = await mentee.agent
        .post(`${API}/sessions`)
        .send({ slotId, topic: 'Premier essai' })
        .expect(201);
      const stranger = await createMentee(app);
      await stranger.agent.post(`${API}/sessions/${first.body.id}/cancel`).expect(403);
      const cancelled = await mentee.agent
        .post(`${API}/sessions/${first.body.id}/cancel`)
        .expect(200);
      expect(cancelled.body.status).toBe('CANCELLED');
      await mentor.agent.post(`${API}/sessions/${first.body.id}/confirm`).send({}).expect(409);
      await mentee.agent
        .post(`${API}/sessions`)
        .send({ slotId, topic: 'Second essai' })
        .expect(201);
    });

    it('refuse un créneau inexistant (404)', async () => {
      const res = await mentee.agent
        .post(`${API}/sessions`)
        .send({ slotId: 'inexistant', topic: 'Créneau fantôme' })
        .expect(404);
      expect(res.body.code).toBe('SLOT_NOT_FOUND');
    });

    it('ne montre à chacun que ses propres séances', async () => {
      const stranger = await createMentee(app);
      const res = await stranger.agent.get(`${API}/sessions/me?scope=all`).expect(200);
      expect(res.body).toEqual([]);
    });
  });
});
