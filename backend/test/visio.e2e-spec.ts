import type { INestApplication } from '@nestjs/common';
import {
  API,
  createApp,
  createMentee,
  createMentor,
  createMentorship,
  createSlot,
} from './helpers.js';

describe('Lien de visio généré à la confirmation', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('génère une salle externe imprévisible pour une séance à distance', async () => {
    const mentor = await createMentor(app);
    const mentee = await createMentee(app);
    await createMentorship(mentee, mentor);
    const [s1, s2] = [await createSlot(mentor, 15, 9), await createSlot(mentor, 15, 11)];
    const a = await mentee.agent
      .post(`${API}/sessions`)
      .send({ slotId: s1, topic: 'Séance à distance' })
      .expect(201);
    const b = await mentee.agent
      .post(`${API}/sessions`)
      .send({ slotId: s2, topic: 'Autre séance' })
      .expect(201);
    const ca = await mentor.agent.post(`${API}/sessions/${a.body.id}/confirm`).send({}).expect(200);
    const cb = await mentor.agent.post(`${API}/sessions/${b.body.id}/confirm`).send({}).expect(200);
    expect(ca.body.meetingUrl).toMatch(
      /^https:\/\/meet\.jit\.si\/TalentsConnectes-[A-Za-z0-9_-]{16}$/,
    );
    expect(ca.body.meetingUrl).not.toBe(cb.body.meetingUrl);
  });

  it('conserve le lien fourni par le mentor et n’en génère pas pour le présentiel', async () => {
    const mentor = await createMentor(app);
    const mentee = await createMentee(app);
    await createMentorship(mentee, mentor);
    const [s1, s2] = [await createSlot(mentor, 16, 9), await createSlot(mentor, 16, 11)];
    const remote = await mentee.agent
      .post(`${API}/sessions`)
      .send({ slotId: s1, topic: 'Avec mon lien' })
      .expect(201);
    const onsite = await mentee.agent
      .post(`${API}/sessions`)
      .send({ slotId: s2, topic: 'Rencontre sur place', modality: 'IN_PERSON' })
      .expect(201);
    const custom = await mentor.agent
      .post(`${API}/sessions/${remote.body.id}/confirm`)
      .send({ meetingUrl: 'https://visio.example.org/salle' })
      .expect(200);
    expect(custom.body.meetingUrl).toBe('https://visio.example.org/salle');
    const inPerson = await mentor.agent
      .post(`${API}/sessions/${onsite.body.id}/confirm`)
      .send({ location: 'CCFG, Conakry' })
      .expect(200);
    expect(inPerson.body).toMatchObject({ meetingUrl: null, location: 'CCFG, Conakry' });
  });
});
