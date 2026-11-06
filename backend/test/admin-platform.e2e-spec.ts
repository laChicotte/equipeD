import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import {
  API,
  createApp,
  createMentee,
  createMentor,
  createMentorship,
  loginAs,
  prismaOf,
  TEST_PASSWORD,
  type Agent,
  type TestUser,
} from './helpers.js';

/** Premier administrateur promu directement en base (comme la seed le fait pour la démo). */
async function makeAdmin(app: INestApplication, user: TestUser): Promise<Agent> {
  await prismaOf(app).user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
  return loginAs(app, user.email, TEST_PASSWORD);
}

describe('Administration : pilotage, équipe, journal et certificats', () => {
  let app: INestApplication;
  let adminAgent: Agent;
  let adminUser: TestUser;
  let otherAdminAgent: Agent;

  beforeAll(async () => {
    app = await createApp();
    adminUser = await createMentee(app, { withProfile: false });
    adminAgent = await makeAdmin(app, adminUser);
    otherAdminAgent = await makeAdmin(app, await createMentee(app, { withProfile: false }));
  });
  afterAll(async () => {
    await app.close();
  });

  it('réserve le pilotage à l’équipe d’administration', async () => {
    const mentee = await createMentee(app);
    const denied = await mentee.agent.get(`${API}/admin/metrics`).expect(403);
    expect(denied.body.code).toBe('ROLE_FORBIDDEN');
    const mentor = await createMentor(app);
    await mentor.agent.get(`${API}/admin/metrics`).expect(403);

    const m = await adminAgent.get(`${API}/admin/metrics`).expect(200);
    expect(m.body.activity.signups).toHaveLength(30);
    expect(m.body.users.byRole.ADMIN).toBeGreaterThanOrEqual(2);
    expect(m.body.users.byRole.SUPER_ADMIN).toBeUndefined();
    expect(m.body.domains.length).toBeGreaterThanOrEqual(7);
    expect(JSON.stringify(m.body)).not.toMatch(/passwordHash|content/);
    await adminAgent.get(`${API}/admin/overview`).expect(200);
  });

  it('nomme puis retire un administrateur, avec traces dans le journal', async () => {
    const candidate = await createMentee(app, { withProfile: false });
    const res = await adminAgent
      .patch(`${API}/admin/users/${candidate.id}/role`)
      .send({ role: 'ADMIN' })
      .expect(200);
    expect(res.body.role).toBe('ADMIN');
    // Sessions révoquées : la personne se reconnecte avec ses nouveaux droits.
    await candidate.agent.get(`${API}/auth/me`).expect(401);
    const team = await adminAgent.get(`${API}/admin/team`).expect(200);
    expect(team.body.map((u: { id: string }) => u.id)).toContain(candidate.id);

    await adminAgent
      .patch(`${API}/admin/users/${candidate.id}/role`)
      .send({ role: 'MENTEE' })
      .expect(200);
    const audit = await adminAgent.get(`${API}/admin/audit?action=ROLE_CHANGED`).expect(200);
    const mine = audit.body.items.filter((i: { targetId: string }) => i.targetId === candidate.id);
    expect(mine).toHaveLength(2);
    expect(mine[0].summary).toMatch(/administrateur → mentoré/);
  });

  it('refuse les changements de rôle dangereux', async () => {
    const self = await adminAgent
      .patch(`${API}/admin/users/${adminUser.id}/role`)
      .send({ role: 'ADMIN' })
      .expect(403);
    expect(self.body.code).toBe('SELF_ROLE_CHANGE');

    const mentor = await createMentor(app);
    const mentee = await createMentee(app);
    await createMentorship(mentee, mentor);
    const busy = await adminAgent
      .patch(`${API}/admin/users/${mentor.id}/role`)
      .send({ role: 'ADMIN' })
      .expect(409);
    expect(busy.body.code).toBe('USER_HAS_ACTIVE_MENTORING');

    const invalid = await adminAgent
      .patch(`${API}/admin/users/${mentee.id}/role`)
      .send({ role: 'SUPER_ADMIN' })
      .expect(422);
    expect(invalid.body.code).toBe('VALIDATION_FAILED');

    // Un administrateur peut suspendre un autre administrateur (action tracée), jamais lui-même.
    const other = await createMentee(app, { withProfile: false });
    await makeAdmin(app, other);
    await adminAgent
      .patch(`${API}/admin/users/${other.id}/status`)
      .send({ status: 'SUSPENDED' })
      .expect(200);
    const selfSuspend = await adminAgent
      .patch(`${API}/admin/users/${adminUser.id}/status`)
      .send({ status: 'SUSPENDED' })
      .expect(403);
    expect(selfSuspend.body.code).toBe('SELF_MODERATION');
  });

  it('révoque un certificat avec un motif, et la vérification publique le signale', async () => {
    const mentor = await createMentor(app);
    const mentee = await createMentee(app);
    const mentorshipId = await createMentorship(mentee, mentor);
    const start = new Date(Date.now() - 3 * 86_400_000);
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
    await mentor.agent.post(`${API}/sessions/${s.id}/complete`).send({}).expect(200);
    const closed = await mentee.agent
      .post(`${API}/mentorships/${mentorshipId}/complete`)
      .send({})
      .expect(200);
    const code = closed.body.certificate.code as string;

    await mentee.agent
      .post(`${API}/admin/certificates/${code}/revoke`)
      .send({ reason: 'Erreur de saisie constatée' })
      .expect(403);
    await adminAgent
      .post(`${API}/admin/certificates/${code}/revoke`)
      .send({ reason: 'court' })
      .expect(422);
    const revoked = await adminAgent
      .post(`${API}/admin/certificates/${code}/revoke`)
      .send({ reason: 'Séances déclarées sans réalité vérifiable' })
      .expect(201);
    expect(revoked.body.revokedReason).toMatch(/Séances/);
    await adminAgent
      .post(`${API}/admin/certificates/${code}/revoke`)
      .send({ reason: 'Séances déclarées sans réalité vérifiable' })
      .expect(409);

    const pub = await mentee.agent.get(`${API}/certificates/${code}`).expect(200);
    expect(pub.body.valid).toBe(false);
    const card = await mentee.agent.get(`${API}/mentors/${mentor.id}`).expect(200);
    expect(card.body.certificatesCount).toBe(0);
    const audit = await adminAgent.get(`${API}/admin/audit?action=CERTIFICATE_REVOKED`).expect(200);
    expect(audit.body.items[0].targetId).toBe(code);
  });

  it('trace la modération des mentors par un administrateur', async () => {
    const mentor = await createMentor(app);
    await adminAgent
      .patch(`${API}/admin/mentors/${mentor.id}`)
      .send({ verificationStatus: 'VERIFIED' })
      .expect(200);
    const audit = await otherAdminAgent
      .get(`${API}/admin/audit?action=MENTOR_MODERATED`)
      .expect(200);
    expect(audit.body.items.some((i: { targetId: string }) => i.targetId === mentor.id)).toBe(true);
  });

  it('invite une nouvelle personne dans l’équipe, qui active son compte par le lien', async () => {
    const email = `invitee-${Date.now()}@example.test`;
    const res = await adminAgent
      .post(`${API}/admin/team/invite`)
      .send({ email, firstName: 'Nouvelle', lastName: 'Admin' })
      .expect(201);
    // Sans service d'email (tests) : le lien est renvoyé pour être remis en main propre.
    expect(res.body.emailed).toBe(false);
    expect(res.body.path).toContain('/reinitialiser-mot-de-passe?jeton=');
    await adminAgent
      .post(`${API}/admin/team/invite`)
      .send({ email, firstName: 'Doublon', lastName: 'Admin' })
      .expect(409);
    const mentor = await createMentor(app);
    await mentor.agent
      .post(`${API}/admin/team/invite`)
      .send({ email: `x-${Date.now()}@example.test`, firstName: 'X', lastName: 'Y' })
      .expect(403);

    const token = new URLSearchParams(res.body.path.split('?')[1]).get('jeton');
    await request(app.getHttpServer())
      .post(`${API}/auth/password-reset`)
      .set('Origin', 'http://localhost:3000')
      .send({ token, newPassword: 'EquipeAdmin2026' })
      .expect(200);
    const agent = await loginAs(app, email, 'EquipeAdmin2026');
    const me = await agent.get(`${API}/auth/me`).expect(200);
    expect(me.body.role).toBe('ADMIN');
    const team = await adminAgent.get(`${API}/admin/team`).expect(200);
    expect(team.body.map((u: { email: string }) => u.email)).toContain(email);
  });
});
