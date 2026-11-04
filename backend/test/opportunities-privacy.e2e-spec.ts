import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  API,
  TEST_PASSWORD,
  createApp,
  createMentee,
  createMentor,
  createMentorship,
  createSlot,
  demoEmail,
  loginAs,
  prismaOf,
} from './helpers.js';

const opportunity = (overrides: Record<string, unknown> = {}) => ({
  type: 'INTERNSHIP',
  title: 'Stage en analyse de données',
  organization: 'Structure de test',
  description: 'Description de test suffisamment longue pour passer la validation métier.',
  isRemote: true,
  deadline: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  ...overrides,
});

describe('Opportunités et confidentialité', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
  });

  describe('opportunités', () => {
    it('liste publiquement les opportunités ouvertes, échéance la plus proche en premier', async () => {
      const res = await request(app.getHttpServer()).get(`${API}/opportunities`).expect(200);
      expect(res.body.total).toBeGreaterThanOrEqual(3);
      const deadlines = res.body.items
        .map((o: { deadline: string | null }) => o.deadline)
        .filter(Boolean)
        .map((d: string) => new Date(d).getTime());
      expect([...deadlines].sort((a, b) => a - b)).toEqual(deadlines);
      expect(JSON.stringify(res.body)).not.toMatch(/email|passwordHash/);
    });

    it('filtre par type, domaine, distance et mot-clé', async () => {
      const server = app.getHttpServer();
      const calls = await request(server)
        .get(`${API}/opportunities?type=CALL_FOR_PROJECTS`)
        .expect(200);
      expect(calls.body.items.every((o: { type: string }) => o.type === 'CALL_FOR_PROJECTS')).toBe(
        true,
      );
      const remote = await request(server).get(`${API}/opportunities?remote=true`).expect(200);
      expect(remote.body.items.every((o: { isRemote: boolean }) => o.isRemote)).toBe(true);
      const dom = await request(server)
        .get(`${API}/opportunities?domain=entrepreneuriat`)
        .expect(200);
      expect(
        dom.body.items.every(
          (o: { domain: { slug: string } }) => o.domain.slug === 'entrepreneuriat',
        ),
      ).toBe(true);
      const q = await request(server).get(`${API}/opportunities?q=atelier`).expect(200);
      expect(q.body.items[0].title).toMatch(/Atelier/);
      await request(server).get(`${API}/opportunities?type=LOTERIE`).expect(422);
    });

    it('réserve la publication aux mentors et admins, et valide les champs', async () => {
      const mentor = await createMentor(app);
      const mentee = await createMentee(app);
      await mentee.agent.post(`${API}/opportunities`).send(opportunity()).expect(403);
      const past = await mentor.agent
        .post(`${API}/opportunities`)
        .send(opportunity({ deadline: new Date(Date.now() - 86_400_000).toISOString() }))
        .expect(422);
      expect(past.body.code).toBe('DEADLINE_IN_PAST');
      await mentor.agent
        .post(`${API}/opportunities`)
        .send(opportunity({ url: 'http://x.example' }))
        .expect(422);
      const ok = await mentor.agent.post(`${API}/opportunities`).send(opportunity()).expect(201);
      expect(ok.body.author.id).toBe(mentor.id);
    });

    it('archive : retirée du public, visible de l’auteur, modifiable seulement par l’auteur ou un admin', async () => {
      const author = await createMentor(app);
      const other = await createMentor(app);
      const created = await author.agent
        .post(`${API}/opportunities`)
        .send(opportunity({ title: 'Opportunité à archiver' }))
        .expect(201);
      const id = created.body.id;
      const denied = await other.agent
        .patch(`${API}/opportunities/${id}`)
        .send({ archived: true })
        .expect(403);
      expect(denied.body.code).toBe('NOT_OPPORTUNITY_AUTHOR');

      await author.agent.patch(`${API}/opportunities/${id}`).send({ archived: true }).expect(200);
      await request(app.getHttpServer()).get(`${API}/opportunities/${id}`).expect(404);
      await author.agent.get(`${API}/opportunities/${id}`).expect(200);
      const mine = await author.agent.get(`${API}/opportunities/mine`).expect(200);
      expect(mine.body[0].archivedAt).toBeTruthy();

      const admin = await loginAs(app, demoEmail('admin'));
      await admin.patch(`${API}/opportunities/${id}`).send({ archived: false }).expect(200);
      await request(app.getHttpServer()).get(`${API}/opportunities/${id}`).expect(200);
    });

    it('masque automatiquement une opportunité dont la date limite est passée', async () => {
      const mentor = await createMentor(app);
      const created = await mentor.agent
        .post(`${API}/opportunities`)
        .send(opportunity({ title: 'Échéance dépassée' }))
        .expect(201);
      await prismaOf(app).opportunity.update({
        where: { id: created.body.id },
        data: { deadline: new Date(Date.now() - 3_600_000) },
      });
      const list = await request(app.getHttpServer())
        .get(`${API}/opportunities?q=%C3%89ch%C3%A9ance`)
        .expect(200);
      expect(list.body.total).toBe(0);
    });
  });

  describe('export des données', () => {
    it('exporte les données de l’utilisateur, sans secret ni message d’autrui', async () => {
      const mentor = await createMentor(app);
      const mentee = await createMentee(app);
      const mentorshipId = await createMentorship(mentee, mentor);
      await mentee.agent
        .post(`${API}/mentorships/${mentorshipId}/messages`)
        .send({ content: 'Mon message' })
        .expect(201);
      await mentor.agent
        .post(`${API}/mentorships/${mentorshipId}/messages`)
        .send({ content: 'Message du mentor' })
        .expect(201);

      const res = await mentee.agent.get(`${API}/profile/me/export`).expect(200);
      expect(res.headers['content-disposition']).toMatch(/attachment/);
      expect(res.body.account.email).toBe(mentee.email);
      expect(res.body.mentorshipRequests.sent).toHaveLength(1);
      expect(res.body.messagesSent.map((m: { content: string }) => m.content)).toEqual([
        'Mon message',
      ]);
      const json = JSON.stringify(res.body);
      expect(json).not.toMatch(/passwordHash|tokenHash|Message du mentor/);
      await request(app.getHttpServer()).get(`${API}/profile/me/export`).expect(401);
    });
  });

  describe('suppression du compte', () => {
    it('exige le mot de passe et la confirmation explicite', async () => {
      const mentee = await createMentee(app);
      const noConfirm = await mentee.agent
        .delete(`${API}/profile/me`)
        .send({ password: TEST_PASSWORD, confirmation: 'oui' })
        .expect(422);
      expect(noConfirm.body.details[0].field).toBe('confirmation');
      const wrong = await mentee.agent
        .delete(`${API}/profile/me`)
        .send({ password: 'mauvais', confirmation: 'SUPPRIMER' })
        .expect(422);
      expect(wrong.body.code).toBe('INVALID_PASSWORD');
      await mentee.agent.get(`${API}/auth/me`).expect(200);
    });

    it('anonymise le mentor, ferme ses mentorats, le retire de l’annuaire et préserve l’historique de l’autre', async () => {
      const mentor = await createMentor(app);
      const mentee = await createMentee(app);
      const pending = await createMentee(app);
      const mentorshipId = await createMentorship(mentee, mentor);
      await mentee.agent
        .post(`${API}/mentorships/${mentorshipId}/messages`)
        .send({ content: 'Question' })
        .expect(201);
      await mentor.agent
        .post(`${API}/mentorships/${mentorshipId}/messages`)
        .send({ content: 'Réponse du mentor' })
        .expect(201);
      const slotId = await createSlot(mentor, 14, 9);
      const session = await mentee.agent
        .post(`${API}/sessions`)
        .send({ slotId, topic: 'Séance prévue' })
        .expect(201);
      const req = await pending.agent
        .post(`${API}/mentorship-requests`)
        .send({
          mentorId: mentor.id,
          goal: 'Objectif en attente de réponse',
          message: 'Bonjour, je souhaiterais être accompagné sur la structuration de mon projet.',
        })
        .expect(201);

      const res = await mentor.agent
        .delete(`${API}/profile/me`)
        .send({ password: TEST_PASSWORD, confirmation: 'SUPPRIMER' })
        .expect(200);
      expect(res.body).toEqual({ ok: true, closedMentorships: 1 });

      // Session invalidée, connexion impossible.
      await mentor.agent.get(`${API}/auth/me`).expect(401);
      await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: mentor.email, password: TEST_PASSWORD })
        .expect(401);

      // Retiré de l'annuaire public.
      await request(app.getHttpServer()).get(`${API}/mentors/${mentor.id}`).expect(404);

      // Données personnelles anonymisées.
      const stored = await prismaOf(app).user.findUniqueOrThrow({ where: { id: mentor.id } });
      expect(stored).toMatchObject({
        status: 'DELETED',
        firstName: 'Compte',
        lastName: 'supprimé',
      });
      expect(stored.email).not.toBe(mentor.email);
      expect(await prismaOf(app).mentorProfile.count({ where: { userId: mentor.id } })).toBe(0);

      // Effets métier : mentorat clos, séance annulée, demande en attente refusée.
      const m = await mentee.agent.get(`${API}/mentorships/${mentorshipId}`).expect(200);
      expect(m.body.status).toBe('COMPLETED');
      expect(m.body.mentor).toMatchObject({ firstName: 'Compte', lastName: 'supprimé' });
      const s = await prismaOf(app).mentoringSession.findUniqueOrThrow({
        where: { id: session.body.id },
      });
      expect(s.status).toBe('CANCELLED');
      const r = await pending.agent.get(`${API}/mentorship-requests/${req.body.id}`).expect(200);
      expect(r.body.status).toBe('DECLINED');

      // L'historique de conversation du mentoré est préservé.
      const msgs = await mentee.agent
        .get(`${API}/mentorships/${mentorshipId}/messages`)
        .expect(200);
      expect(msgs.body.map((x: { content: string }) => x.content)).toEqual([
        'Question',
        'Réponse du mentor',
      ]);
      const [notif] = (await mentee.agent.get(`${API}/notifications`).expect(200)).body;
      expect(notif).toMatchObject({ type: 'MENTORSHIP_COMPLETED' });

      // Un compte supprimé ne peut pas être réactivé par un administrateur.
      const admin = await loginAs(app, demoEmail('admin'));
      const reactivate = await admin
        .patch(`${API}/admin/users/${mentor.id}/status`)
        .send({ status: 'ACTIVE' })
        .expect(409);
      expect(reactivate.body.code).toBe('ACCOUNT_DELETED');
      await admin
        .patch(`${API}/admin/users/${mentee.id}/status`)
        .send({ status: 'DELETED' })
        .expect(422);
    });

    it('interdit l’auto-suppression d’un administrateur', async () => {
      const admin = await loginAs(app, demoEmail('admin'));
      const res = await admin
        .delete(`${API}/profile/me`)
        .send({ password: 'Mentorat2026!', confirmation: 'SUPPRIMER' })
        .expect(403);
      expect(res.body.code).toBe('ADMIN_CANNOT_SELF_DELETE');
    });
  });
});
