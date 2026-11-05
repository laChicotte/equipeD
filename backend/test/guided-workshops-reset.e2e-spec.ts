import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  API,
  createApp,
  createMentee,
  createMentor,
  createMentorship,
  loginAs,
  prismaOf,
  slotAt,
  TEST_PASSWORD,
  type Agent,
  type TestUser,
} from './helpers.js';

async function makeStaff(app: INestApplication, user: TestUser, role: 'ADMIN'): Promise<Agent> {
  await prismaOf(app).user.update({ where: { id: user.id }, data: { role } });
  return loginAs(app, user.email, TEST_PASSWORD);
}

describe('Parcours guidés', () => {
  let app: INestApplication;
  let mentor: TestUser;
  let mentee: TestUser;
  let stranger: TestUser;
  let mentorshipId: string;

  beforeAll(async () => {
    app = await createApp();
    mentor = await createMentor(app);
    mentee = await createMentee(app);
    stranger = await createMentee(app);
    mentorshipId = await createMentorship(mentee, mentor);
  });
  afterAll(async () => {
    await app.close();
  });

  it('expose un catalogue public, dont le parcours Campus France avec sa mention', async () => {
    const all = await request(app.getHttpServer()).get(`${API}/guided-paths`).expect(200);
    expect(all.body.length).toBeGreaterThanOrEqual(7);
    const cf = await request(app.getHttpServer())
      .get(`${API}/guided-paths?domain=campus-france`)
      .expect(200);
    expect(cf.body).toHaveLength(1);
    expect(cf.body[0]).toMatchObject({
      key: 'campus-france',
      domain: { slug: 'campus-france' },
    });
    expect(cf.body[0].notice).toMatch(/ne garantit ni l’admission/);
    expect(cf.body[0].goals.map((g: { key: string }) => g.key)).toEqual([
      'projet-etudes',
      'dossier-candidature',
      'entretien',
      'demarches-depart',
    ]);
  });

  it('ajoute les objectifs choisis avec leurs jalons, sans doublon, et notifie l’autre', async () => {
    const res = await mentee.agent
      .post(`${API}/mentorships/${mentorshipId}/guided-paths/campus-france`)
      .send({ goalKeys: ['dossier-candidature', 'entretien'] })
      .expect(201);
    expect(res.body.created).toHaveLength(2);
    expect(res.body.created[0].milestones.length).toBeGreaterThan(3);
    expect(res.body.created[0].progress).toBe(0);

    const again = await mentee.agent
      .post(`${API}/mentorships/${mentorshipId}/guided-paths/campus-france`)
      .send({})
      .expect(201);
    expect(again.body.created).toHaveLength(2); // projet d'études et démarches
    expect(again.body.skipped).toEqual(['dossier-candidature', 'entretien']);

    const goals = await mentor.agent.get(`${API}/mentorships/${mentorshipId}/goals`).expect(200);
    expect(goals.body).toHaveLength(4);
    const [notif] = (await mentor.agent.get(`${API}/notifications`).expect(200)).body;
    expect(notif.title).toMatch(/Préparer sa candidature Campus France/);
  });

  it('refuse un tiers, un parcours inconnu et un objectif inconnu', async () => {
    await stranger.agent
      .post(`${API}/mentorships/${mentorshipId}/guided-paths/campus-france`)
      .send({})
      .expect(403);
    const unknownPath = await mentee.agent
      .post(`${API}/mentorships/${mentorshipId}/guided-paths/inexistant`)
      .send({})
      .expect(404);
    expect(unknownPath.body.code).toBe('GUIDED_PATH_NOT_FOUND');
    const unknownGoal = await mentee.agent
      .post(`${API}/mentorships/${mentorshipId}/guided-paths/campus-france`)
      .send({ goalKeys: ['inconnu'] })
      .expect(422);
    expect(unknownGoal.body.code).toBe('INVALID_GUIDED_GOAL');
  });
});

describe('Ateliers de groupe', () => {
  let app: INestApplication;
  let owner: TestUser;
  let colleague: TestUser;
  let member: TestUser;
  let stranger: TestUser;
  let groupId: string;
  let workshopId: string;

  beforeAll(async () => {
    app = await createApp();
    owner = await createMentor(app);
    colleague = await createMentor(app);
    member = await createMentee(app);
    stranger = await createMentee(app);
    await createMentorship(member, owner);
    const group = await owner.agent
      .post(`${API}/groups`)
      .send({ name: 'Atelier CV', memberIds: [member.id, colleague.id] })
      .expect(201);
    groupId = group.body.id;
  });
  afterAll(async () => {
    await app.close();
  });

  it('le responsable planifie un atelier : salle de visio générée, membres notifiés', async () => {
    await member.agent
      .post(`${API}/groups/${groupId}/workshops`)
      .send({ title: 'Atelier interdit', ...slotAt(3, 10) })
      .expect(403);
    await colleague.agent
      .post(`${API}/groups/${groupId}/workshops`)
      .send({ title: 'Atelier du collègue', ...slotAt(3, 10) })
      .expect(403);

    const res = await owner.agent
      .post(`${API}/groups/${groupId}/workshops`)
      .send({
        title: 'Rédiger un CV percutant',
        description: 'Venez avec votre CV actuel.',
        ...slotAt(3, 10, 90),
      })
      .expect(201);
    workshopId = res.body.id;
    expect(res.body).toMatchObject({
      isOwner: true,
      status: 'UPCOMING',
      goingCount: 1,
      myResponse: 'GOING',
      group: { id: groupId, name: 'Atelier CV' },
    });
    expect(res.body.meetingUrl).toMatch(/^https:\/\//);

    const [notif] = (await member.agent.get(`${API}/notifications`).expect(200)).body;
    expect(notif).toMatchObject({
      type: 'WORKSHOP_SCHEDULED',
      link: `/seances?atelier=${workshopId}`,
    });
  });

  it('refuse les horaires invalides et les chevauchements de l’animateur', async () => {
    const past = await owner.agent
      .post(`${API}/groups/${groupId}/workshops`)
      .send({ title: 'Passé', ...slotAt(-1, 10) })
      .expect(422);
    expect(past.body.code).toBe('INVALID_WORKSHOP_TIME');
    await owner.agent
      .post(`${API}/groups/${groupId}/workshops`)
      .send({ title: 'Trop long', ...slotAt(4, 8, 300) })
      .expect(422);
    const overlap = await owner.agent
      .post(`${API}/groups/${groupId}/workshops`)
      .send({ title: 'En même temps', ...slotAt(3, 10, 30) })
      .expect(409);
    expect(overlap.body.code).toBe('WORKSHOP_OVERLAP');
  });

  it('chaque membre répond, un tiers ne voit rien', async () => {
    const going = await member.agent
      .put(`${API}/workshops/${workshopId}/attendance`)
      .send({ going: true })
      .expect(200);
    expect(going.body).toMatchObject({ myResponse: 'GOING', goingCount: 2 });
    const no = await colleague.agent
      .put(`${API}/workshops/${workshopId}/attendance`)
      .send({ going: false })
      .expect(200);
    expect(no.body).toMatchObject({ goingCount: 2, notGoingCount: 1 });

    const mine = await member.agent.get(`${API}/workshops/me`).expect(200);
    expect(mine.body.map((w: { id: string }) => w.id)).toContain(workshopId);

    await stranger.agent
      .put(`${API}/workshops/${workshopId}/attendance`)
      .send({ going: true })
      .expect(404);
    await stranger.agent.get(`${API}/groups/${groupId}/workshops`).expect(404);
    expect((await stranger.agent.get(`${API}/workshops/me`).expect(200)).body).toEqual([]);
  });

  it('seul le responsable annule ; l’atelier annulé n’accepte plus de réponse', async () => {
    await member.agent.post(`${API}/workshops/${workshopId}/cancel`).expect(403);
    const cancelled = await owner.agent.post(`${API}/workshops/${workshopId}/cancel`).expect(200);
    expect(cancelled.body.status).toBe('CANCELLED');
    const late = await member.agent
      .put(`${API}/workshops/${workshopId}/attendance`)
      .send({ going: true })
      .expect(409);
    expect(late.body.code).toBe('WORKSHOP_CANCELLED');
    // Le créneau est libéré : un nouvel atelier peut le reprendre.
    await owner.agent
      .post(`${API}/groups/${groupId}/workshops`)
      .send({ title: 'Atelier reprogrammé', ...slotAt(3, 10, 60) })
      .expect(201);
  });
});

describe('Rapport d’impact et réinitialisation du mot de passe', () => {
  let app: INestApplication;
  let otherAdminAgent: Agent;
  let adminAgent: Agent;
  let adminUser: TestUser;
  let mentee: TestUser;

  beforeAll(async () => {
    app = await createApp();
    otherAdminAgent = await makeStaff(
      app,
      await createMentee(app, { withProfile: false }),
      'ADMIN',
    );
    adminUser = await createMentee(app, { withProfile: false });
    adminAgent = await makeStaff(app, adminUser, 'ADMIN');
    mentee = await createMentee(app);
  });
  afterAll(async () => {
    await app.close();
  });

  it('exporte un rapport d’impact CSV réservé à l’équipe, tracé dans le journal', async () => {
    await mentee.agent.get(`${API}/admin/impact-report.csv`).expect(403);
    const res = await adminAgent.get(`${API}/admin/impact-report.csv`).expect(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="rapport-impact/);
    expect(res.text.charCodeAt(0)).toBe(0xfeff);
    expect(res.text).toContain('Séances réalisées');
    expect(res.text).toContain('Ateliers réalisés');
    expect(res.text).toContain('Campus France');
    expect(res.text).not.toContain('@'); // aucune adresse email
    const audit = await otherAdminAgent
      .get(`${API}/admin/audit?action=IMPACT_REPORT_EXPORTED`)
      .expect(200);
    expect(audit.body.total).toBeGreaterThanOrEqual(1);
  });

  it('l’équipe émet un lien à usage unique qui change le mot de passe et ferme les sessions', async () => {
    await mentee.agent.post(`${API}/admin/users/${mentee.id}/password-reset-link`).expect(403);
    const issued = await adminAgent
      .post(`${API}/admin/users/${mentee.id}/password-reset-link`)
      .expect(201);
    expect(issued.body.path).toMatch(/^\/reinitialiser-mot-de-passe\?jeton=/);
    const token = issued.body.token as string;

    const anon = request(app.getHttpServer());
    const check = await anon.post(`${API}/auth/password-reset/check`).send({ token }).expect(200);
    expect(check.body).toMatchObject({ valid: true, firstName: 'Test' });

    const weak = await anon
      .post(`${API}/auth/password-reset`)
      .send({ token, newPassword: 'court' })
      .expect(422);
    expect(weak.body.code).toBe('VALIDATION_FAILED');

    await anon
      .post(`${API}/auth/password-reset`)
      .send({ token, newPassword: 'NouveauMotDePasse2026' })
      .expect(200);
    // Session existante révoquée, ancien mot de passe refusé, nouveau accepté.
    await mentee.agent.get(`${API}/auth/me`).expect(401);
    await anon
      .post(`${API}/auth/login`)
      .send({ email: mentee.email, password: TEST_PASSWORD })
      .expect(401);
    await loginAs(app, mentee.email, 'NouveauMotDePasse2026');

    const reused = await anon
      .post(`${API}/auth/password-reset`)
      .send({ token, newPassword: 'EncoreUnAutre2026' })
      .expect(404);
    expect(reused.body.code).toBe('RESET_LINK_INVALID');

    const audit = await otherAdminAgent
      .get(`${API}/admin/audit?action=PASSWORD_RESET_LINK_ISSUED`)
      .expect(200);
    expect(audit.body.total).toBeGreaterThanOrEqual(1);
  });

  it('un nouveau lien invalide le précédent ; l’équipe est protégée', async () => {
    const first = await adminAgent
      .post(`${API}/admin/users/${mentee.id}/password-reset-link`)
      .expect(201);
    await adminAgent.post(`${API}/admin/users/${mentee.id}/password-reset-link`).expect(201);
    await request(app.getHttpServer())
      .post(`${API}/auth/password-reset/check`)
      .send({ token: first.body.token })
      .expect(404);

    const other = await createMentee(app, { withProfile: false });
    await makeStaff(app, other, 'ADMIN');
    const protectedRes = await adminAgent
      .post(`${API}/admin/users/${other.id}/password-reset-link`)
      .expect(403);
    // Aucun administrateur ne peut obtenir de lien pour un autre : il pourrait prendre son compte.
    expect(protectedRes.body.code).toBe('STAFF_PROTECTED');
    await otherAdminAgent.post(`${API}/admin/users/${other.id}/password-reset-link`).expect(403);
  });
});
