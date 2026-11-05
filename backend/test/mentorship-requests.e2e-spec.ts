import type { INestApplication } from '@nestjs/common';
import { API, createApp, createMentee, createMentor, prismaOf, type TestUser } from './helpers.js';

const validRequest = (mentorId: string) => ({
  mentorId,
  goal: 'Préparer mon premier entretien technique',
  message: 'Bonjour, je termine ma formation et je souhaite être accompagné pour mes entretiens.',
});

describe('Demandes de mentorat', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('exige un profil mentoré complet avant toute demande (422 PROFILE_REQUIRED)', async () => {
    const mentor = await createMentor(app);
    const mentee = await createMentee(app, { withProfile: false });
    const res = await mentee.agent
      .post(`${API}/mentorship-requests`)
      .send(validRequest(mentor.id))
      .expect(422);
    expect(res.body.code).toBe('PROFILE_REQUIRED');
  });

  it('interdit à un mentor d’envoyer une demande (403)', async () => {
    const mentor = await createMentor(app);
    const other = await createMentor(app);
    await mentor.agent.post(`${API}/mentorship-requests`).send(validRequest(other.id)).expect(403);
  });

  it('renvoie 404 pour un mentor inexistant et 422 pour un message trop court', async () => {
    const mentee = await createMentee(app);
    const missing = await mentee.agent
      .post(`${API}/mentorship-requests`)
      .send(validRequest('inexistant'))
      .expect(404);
    expect(missing.body.code).toBe('MENTOR_NOT_FOUND');
    const mentor = await createMentor(app);
    const short = await mentee.agent
      .post(`${API}/mentorship-requests`)
      .send({ ...validRequest(mentor.id), message: 'Trop court' })
      .expect(422);
    expect(short.body.details.map((d: { field: string }) => d.field)).toContain('message');
  });

  describe('cycle de vie complet', () => {
    let mentor: TestUser;
    let otherMentor: TestUser;
    let mentee: TestUser;
    let intruder: TestUser;
    let requestId: string;

    beforeAll(async () => {
      [mentor, otherMentor, mentee, intruder] = await Promise.all([
        createMentor(app),
        createMentor(app),
        createMentee(app),
        createMentee(app),
      ]);
    });

    it('crée une demande PENDING visible uniquement par le bon mentor', async () => {
      const res = await mentee.agent
        .post(`${API}/mentorship-requests`)
        .send(validRequest(mentor.id))
        .expect(201);
      requestId = res.body.id;
      expect(res.body.status).toBe('PENDING');

      const inbox = await mentor.agent.get(`${API}/mentorship-requests/inbox`).expect(200);
      expect(inbox.body.map((r: { id: string }) => r.id)).toContain(requestId);
      const otherInbox = await otherMentor.agent
        .get(`${API}/mentorship-requests/inbox`)
        .expect(200);
      expect(otherInbox.body.map((r: { id: string }) => r.id)).not.toContain(requestId);
      const sent = await mentee.agent.get(`${API}/mentorship-requests/sent`).expect(200);
      expect(sent.body[0].id).toBe(requestId);
    });

    it('refuse une seconde demande en attente au même mentor (409)', async () => {
      const res = await mentee.agent
        .post(`${API}/mentorship-requests`)
        .send(validRequest(mentor.id))
        .expect(409);
      expect(res.body.code).toBe('REQUEST_ALREADY_PENDING');
    });

    it('cache la demande aux tiers (403)', async () => {
      await intruder.agent.get(`${API}/mentorship-requests/${requestId}`).expect(403);
    });

    it('refuse une décision prise par un autre mentor (403 NOT_REQUEST_MENTOR)', async () => {
      const res = await otherMentor.agent
        .post(`${API}/mentorship-requests/${requestId}/accept`)
        .send({})
        .expect(403);
      expect(res.body.code).toBe('NOT_REQUEST_MENTOR');
      await otherMentor.agent
        .post(`${API}/mentorship-requests/${requestId}/decline`)
        .send({})
        .expect(403);
    });

    it('refuse que le mentoré accepte sa propre demande (403)', async () => {
      await mentee.agent
        .post(`${API}/mentorship-requests/${requestId}/accept`)
        .send({})
        .expect(403);
    });

    it('accepte une seule fois même en cas de double clic simultané', async () => {
      const results = await Promise.all([
        mentor.agent
          .post(`${API}/mentorship-requests/${requestId}/accept`)
          .send({ note: 'Avec plaisir' }),
        mentor.agent
          .post(`${API}/mentorship-requests/${requestId}/accept`)
          .send({ note: 'Avec plaisir' }),
      ]);
      for (const r of results) expect([200, 409]).toContain(r.status);
      const count = await prismaOf(app).mentorship.count({ where: { requestId } });
      expect(count).toBe(1);
    });

    it('est idempotente : rejouer l’acceptation renvoie le même mentorat', async () => {
      const res = await mentor.agent
        .post(`${API}/mentorship-requests/${requestId}/accept`)
        .send({})
        .expect(200);
      expect(res.body.status).toBe('ACCEPTED');
      expect(res.body.mentorship.status).toBe('ACTIVE');
      expect(res.body.decisionNote).toBe('Avec plaisir');
    });

    it('rejette les transitions invalides après acceptation (409)', async () => {
      const decline = await mentor.agent
        .post(`${API}/mentorship-requests/${requestId}/decline`)
        .send({})
        .expect(409);
      expect(decline.body.code).toBe('INVALID_TRANSITION');
      await mentee.agent.post(`${API}/mentorship-requests/${requestId}/cancel`).expect(409);
    });

    it('refuse une nouvelle demande tant que le mentorat est actif (409 ALREADY_MENTORED)', async () => {
      const res = await mentee.agent
        .post(`${API}/mentorship-requests`)
        .send(validRequest(mentor.id))
        .expect(409);
      expect(res.body.code).toBe('ALREADY_MENTORED');
    });

    it('expose le mentorat aux deux participants uniquement', async () => {
      const mine = await mentee.agent.get(`${API}/mentorships/me`).expect(200);
      const mentorship = mine.body.find(
        (m: { mentor: { id: string } }) => m.mentor.id === mentor.id,
      );
      expect(mentorship).toMatchObject({ status: 'ACTIVE', myRole: 'MENTEE' });
      await mentor.agent.get(`${API}/mentorships/${mentorship.id}`).expect(200);
      await intruder.agent.get(`${API}/mentorships/${mentorship.id}`).expect(403);
    });
  });

  it('permet au mentor de refuser, puis au mentoré de refaire une demande', async () => {
    const mentor = await createMentor(app);
    const mentee = await createMentee(app);
    const first = await mentee.agent
      .post(`${API}/mentorship-requests`)
      .send(validRequest(mentor.id))
      .expect(201);
    const declined = await mentor.agent
      .post(`${API}/mentorship-requests/${first.body.id}/decline`)
      .send({ note: 'Je ne suis pas disponible ce mois-ci.' })
      .expect(200);
    expect(declined.body.status).toBe('DECLINED');
    await mentor.agent
      .post(`${API}/mentorship-requests/${first.body.id}/accept`)
      .send({})
      .expect(409);
    await mentee.agent.post(`${API}/mentorship-requests`).send(validRequest(mentor.id)).expect(201);
  });

  it('permet au mentoré d’annuler une demande en attente, mais pas à un tiers', async () => {
    const mentor = await createMentor(app);
    const mentee = await createMentee(app);
    const other = await createMentee(app);
    const req = await mentee.agent
      .post(`${API}/mentorship-requests`)
      .send(validRequest(mentor.id))
      .expect(201);
    await other.agent.post(`${API}/mentorship-requests/${req.body.id}/cancel`).expect(403);
    const res = await mentee.agent
      .post(`${API}/mentorship-requests/${req.body.id}/cancel`)
      .expect(200);
    expect(res.body.status).toBe('CANCELLED');
  });

  it('accepte autant de mentorés que le mentor le souhaite (plus de plafond)', async () => {
    const mentor = await createMentor(app);
    const mentees = await Promise.all(Array.from({ length: 7 }, () => createMentee(app)));
    for (const m of mentees) {
      const r = await m.agent
        .post(`${API}/mentorship-requests`)
        .send(validRequest(mentor.id))
        .expect(201);
      await mentor.agent
        .post(`${API}/mentorship-requests/${r.body.id}/accept`)
        .send({})
        .expect(200);
    }
    const card = await mentees[0].agent.get(`${API}/mentors/${mentor.id}`).expect(200);
    expect(card.body).toMatchObject({ activeMentees: 7, mentoredCount: 7 });
    expect(card.body).not.toHaveProperty('maxMentees');
  });
});
