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

/** Compte promu directement en base : aucun endpoint ne permet de devenir super-administrateur. */
async function makeStaff(
  app: INestApplication,
  user: TestUser,
  role: 'ADMIN' | 'SUPER_ADMIN',
): Promise<Agent> {
  await prismaOf(app).user.update({ where: { id: user.id }, data: { role } });
  return loginAs(app, user.email, TEST_PASSWORD);
}

describe('Espace super-administrateur', () => {
  let app: INestApplication;
  let superAgent: Agent;
  let superUser: TestUser;
  let adminAgent: Agent;

  beforeAll(async () => {
    app = await createApp();
    superUser = await createMentee(app, { withProfile: false });
    superAgent = await makeStaff(app, superUser, 'SUPER_ADMIN');
    adminAgent = await makeStaff(app, await createMentee(app, { withProfile: false }), 'ADMIN');
  });
  afterAll(async () => {
    await app.close();
  });

  it('réserve le pilotage au super-administrateur, qui garde les droits d’administrateur', async () => {
    const denied = await adminAgent.get(`${API}/superadmin/metrics`).expect(403);
    expect(denied.body.code).toBe('ROLE_FORBIDDEN');
    const mentee = await createMentee(app);
    await mentee.agent.get(`${API}/superadmin/metrics`).expect(403);

    const m = await superAgent.get(`${API}/superadmin/metrics`).expect(200);
    expect(m.body.activity.signups).toHaveLength(30);
    expect(m.body.users.byRole.SUPER_ADMIN).toBeGreaterThanOrEqual(1);
    expect(m.body.domains.length).toBeGreaterThanOrEqual(7);
    expect(JSON.stringify(m.body)).not.toMatch(/passwordHash|content/);

    // Hérite des routes d'administration.
    await superAgent.get(`${API}/admin/overview`).expect(200);
  });

  it('nomme puis retire un administrateur, avec traces dans le journal', async () => {
    const candidate = await createMentee(app, { withProfile: false });
    const res = await superAgent
      .patch(`${API}/superadmin/users/${candidate.id}/role`)
      .send({ role: 'ADMIN' })
      .expect(200);
    expect(res.body.role).toBe('ADMIN');
    // Sessions révoquées : la personne se reconnecte avec ses nouveaux droits.
    await candidate.agent.get(`${API}/auth/me`).expect(401);
    const team = await superAgent.get(`${API}/superadmin/team`).expect(200);
    expect(team.body.map((u: { id: string }) => u.id)).toContain(candidate.id);

    await superAgent
      .patch(`${API}/superadmin/users/${candidate.id}/role`)
      .send({ role: 'MENTEE' })
      .expect(200);
    const audit = await superAgent.get(`${API}/superadmin/audit?action=ROLE_CHANGED`).expect(200);
    const mine = audit.body.items.filter((i: { targetId: string }) => i.targetId === candidate.id);
    expect(mine).toHaveLength(2);
    expect(mine[0].summary).toMatch(/administrateur → mentoré/);
  });

  it('refuse les changements de rôle dangereux', async () => {
    const self = await superAgent
      .patch(`${API}/superadmin/users/${superUser.id}/role`)
      .send({ role: 'ADMIN' })
      .expect(403);
    expect(self.body.code).toBe('SELF_ROLE_CHANGE');

    const mentor = await createMentor(app);
    const mentee = await createMentee(app);
    await createMentorship(mentee, mentor);
    const busy = await superAgent
      .patch(`${API}/superadmin/users/${mentor.id}/role`)
      .send({ role: 'ADMIN' })
      .expect(409);
    expect(busy.body.code).toBe('USER_HAS_ACTIVE_MENTORING');

    const invalid = await superAgent
      .patch(`${API}/superadmin/users/${mentee.id}/role`)
      .send({ role: 'SUPER_ADMIN' })
      .expect(422);
    expect(invalid.body.code).toBe('VALIDATION_FAILED');

    // Un administrateur ne peut pas suspendre un autre membre de l'équipe.
    const other = await createMentee(app, { withProfile: false });
    await makeStaff(app, other, 'ADMIN');
    const protectedRes = await adminAgent
      .patch(`${API}/admin/users/${other.id}/status`)
      .send({ status: 'SUSPENDED' })
      .expect(403);
    expect(protectedRes.body.code).toBe('STAFF_PROTECTED');
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

    await adminAgent
      .post(`${API}/superadmin/certificates/${code}/revoke`)
      .send({ reason: 'Erreur de saisie constatée' })
      .expect(403);
    await superAgent
      .post(`${API}/superadmin/certificates/${code}/revoke`)
      .send({ reason: 'court' })
      .expect(422);
    const revoked = await superAgent
      .post(`${API}/superadmin/certificates/${code}/revoke`)
      .send({ reason: 'Séances déclarées sans réalité vérifiable' })
      .expect(201);
    expect(revoked.body.revokedReason).toMatch(/Séances/);
    await superAgent
      .post(`${API}/superadmin/certificates/${code}/revoke`)
      .send({ reason: 'Séances déclarées sans réalité vérifiable' })
      .expect(409);

    const pub = await mentee.agent.get(`${API}/certificates/${code}`).expect(200);
    expect(pub.body.valid).toBe(false);
    const card = await mentee.agent.get(`${API}/mentors/${mentor.id}`).expect(200);
    expect(card.body.certificatesCount).toBe(0);
    const audit = await superAgent
      .get(`${API}/superadmin/audit?action=CERTIFICATE_REVOKED`)
      .expect(200);
    expect(audit.body.items[0].targetId).toBe(code);
  });

  it('trace la modération des mentors par un administrateur', async () => {
    const mentor = await createMentor(app);
    await adminAgent
      .patch(`${API}/admin/mentors/${mentor.id}`)
      .send({ verificationStatus: 'VERIFIED' })
      .expect(200);
    const audit = await superAgent
      .get(`${API}/superadmin/audit?action=MENTOR_MODERATED`)
      .expect(200);
    expect(audit.body.items.some((i: { targetId: string }) => i.targetId === mentor.id)).toBe(true);
  });
});
