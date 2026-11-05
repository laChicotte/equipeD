import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  API,
  createApp,
  createMentee,
  createMentor,
  createMentorship,
  prismaOf,
  type TestUser,
} from './helpers.js';

/** Séance passée confirmée, insérée directement (l'API interdit de réserver dans le passé). */
async function pastSession(
  app: INestApplication,
  mentorshipId: string,
  mentor: TestUser,
  mentee: TestUser,
  daysAgo: number,
) {
  const start = new Date(Date.now() - daysAgo * 86_400_000);
  const s = await prismaOf(app).mentoringSession.create({
    data: {
      mentorshipId,
      mentorId: mentor.id,
      menteeId: mentee.id,
      startsAt: start,
      endsAt: new Date(start.getTime() + 90 * 60_000),
      status: 'CONFIRMED',
      topic: 'Séance passée',
    },
  });
  return s.id;
}

describe('Certificats d’accompagnement', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('délivre un certificat vérifiable à la clôture d’un mentorat avec séances réalisées', async () => {
    const mentor = await createMentor(app);
    const mentee = await createMentee(app);
    const mentorshipId = await createMentorship(mentee, mentor);
    const s1 = await pastSession(app, mentorshipId, mentor, mentee, 10);
    const s2 = await pastSession(app, mentorshipId, mentor, mentee, 5);
    for (const id of [s1, s2]) {
      await mentor.agent.post(`${API}/sessions/${id}/complete`).send({}).expect(200);
    }
    await mentee.agent.post(`${API}/sessions/${s1}/feedback`).send({ rating: 5 }).expect(201);
    await mentee.agent.post(`${API}/sessions/${s2}/feedback`).send({ rating: 4 }).expect(201);

    const closed = await mentee.agent
      .post(`${API}/mentorships/${mentorshipId}/complete`)
      .send({ note: 'Merci pour tout' })
      .expect(200);
    const code = closed.body.certificate.code as string;
    expect(code).toMatch(/^TC-[A-Z2-9]{4}-[A-Z2-9]{4}$/);

    // Vérification publique, sans session : chiffres figés, mentoré réduit au prénom + initiale.
    const cert = await request(app.getHttpServer())
      .get(`${API}/certificates/${code.toLowerCase()}`)
      .expect(200);
    expect(cert.body).toMatchObject({
      code,
      valid: true,
      mentorName: 'Test Mentor',
      menteeName: 'Test M.',
      completedSessions: 2,
      totalMinutes: 180,
      averageRating: 4.5,
      mentor: { id: mentor.id },
    });
    expect(JSON.stringify(cert.body)).not.toContain(mentee.email);

    // Fiche publique du mentor : compteurs et liste.
    const card = await request(app.getHttpServer()).get(`${API}/mentors/${mentor.id}`).expect(200);
    expect(card.body).toMatchObject({ mentoredCount: 1, activeMentees: 0, certificatesCount: 1 });
    const list = await request(app.getHttpServer())
      .get(`${API}/mentors/${mentor.id}/certificates`)
      .expect(200);
    expect(list.body.map((c: { code: string }) => c.code)).toEqual([code]);

    // Le mentor est notifié ; la clôture répétée ne crée pas de second certificat.
    const notifs = (await mentor.agent.get(`${API}/notifications`).expect(200)).body as {
      type: string;
    }[];
    expect(notifs.map((n) => n.type)).toContain('CERTIFICATE_ISSUED');
    await mentor.agent.post(`${API}/mentorships/${mentorshipId}/complete`).send({}).expect(200);
    expect(await prismaOf(app).mentorshipCertificate.count({ where: { mentorshipId } })).toBe(1);
  });

  it('ne délivre rien sans séance réalisée, et 404 pour un code inconnu', async () => {
    const mentor = await createMentor(app);
    const mentee = await createMentee(app);
    const mentorshipId = await createMentorship(mentee, mentor);
    const closed = await mentor.agent
      .post(`${API}/mentorships/${mentorshipId}/complete`)
      .send({})
      .expect(200);
    expect(closed.body.certificate).toBeNull();
    await request(app.getHttpServer()).get(`${API}/certificates/TC-AAAA-BBBB`).expect(404);
  });

  it('la base refuse un certificat sans séance (contrainte CHECK)', async () => {
    const mentor = await createMentor(app);
    const mentee = await createMentee(app);
    const mentorshipId = await createMentorship(mentee, mentor);
    await expect(
      prismaOf(app).mentorshipCertificate.create({
        data: {
          code: 'TC-ZZZZ-ZZZZ',
          mentorshipId,
          mentorId: mentor.id,
          menteeId: mentee.id,
          mentorName: 'x',
          menteeName: 'y',
          domainName: 'z',
          startedAt: new Date(),
          endedAt: new Date(),
          completedSessions: 0,
          totalMinutes: 60,
          goalsCompleted: 0,
          goalsTotal: 0,
        },
      }),
    ).rejects.toThrow();
  });

  it('révoque les certificats d’un mentor qui supprime son compte', async () => {
    const mentor = await createMentor(app);
    const mentee = await createMentee(app);
    const mentorshipId = await createMentorship(mentee, mentor);
    const s = await pastSession(app, mentorshipId, mentor, mentee, 3);
    await mentor.agent.post(`${API}/sessions/${s}/complete`).send({}).expect(200);
    const closed = await mentor.agent
      .post(`${API}/mentorships/${mentorshipId}/complete`)
      .send({})
      .expect(200);
    await mentor.agent
      .delete(`${API}/profile/me`)
      .send({ password: 'Motdepasse2026', confirmation: 'SUPPRIMER' })
      .expect(200);
    const cert = await request(app.getHttpServer())
      .get(`${API}/certificates/${closed.body.certificate.code}`)
      .expect(200);
    expect(cert.body.valid).toBe(false);
    expect(cert.body.mentor.id).toBeNull();
  });
});
