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
  TEST_PASSWORD,
  type TestUser,
} from './helpers.js';

describe('Ressources et notifications', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
  });

  describe('bibliothèque publique', () => {
    it('est consultable sans connexion, filtrable et paginée', async () => {
      const all = await request(app.getHttpServer()).get(`${API}/resources`).expect(200);
      expect(all.body.total).toBeGreaterThanOrEqual(4);
      const campus = await request(app.getHttpServer())
        .get(`${API}/resources?domain=campus-france`)
        .expect(200);
      expect(
        campus.body.items.every(
          (r: { domain: { slug: string } }) => r.domain.slug === 'campus-france',
        ),
      ).toBe(true);
      const search = await request(app.getHttpServer())
        .get(`${API}/resources?q=portfolio`)
        .expect(200);
      expect(search.body.items[0].title).toMatch(/portfolio/i);
      expect(JSON.stringify(all.body)).not.toMatch(/email|passwordHash/);
    });

    it('n’expose jamais les ressources privées d’un mentorat', async () => {
      const mentor = await createMentor(app);
      const mentee = await createMentee(app);
      const mentorshipId = await createMentorship(mentee, mentor);
      await mentor.agent
        .post(`${API}/mentorships/${mentorshipId}/resources`)
        .send({ title: 'Ressource privée unique', description: 'Réservée à ce mentorat.' })
        .expect(201);
      const lib = await request(app.getHttpServer())
        .get(`${API}/resources?q=Ressource%20priv%C3%A9e%20unique`)
        .expect(200);
      expect(lib.body.total).toBe(0);
    });

    it('autorise la publication aux mentors, pas aux mentorés', async () => {
      const mentor = await createMentor(app);
      const mentee = await createMentee(app);
      const res = await mentor.agent
        .post(`${API}/resources`)
        .send({
          title: 'Préparer un entretien',
          kind: 'ADVICE',
          description: 'Préparez trois exemples concrets.',
        })
        .expect(201);
      expect(res.body.mentorshipId).toBeNull();
      await mentee.agent
        .post(`${API}/resources`)
        .send({ title: 'Test', description: 'x' })
        .expect(403);
    });

    it('valide le contenu : lien https ou description obligatoire', async () => {
      const mentor = await createMentor(app);
      const empty = await mentor.agent.post(`${API}/resources`).send({ title: 'Vide' }).expect(422);
      expect(empty.body.code).toBe('RESOURCE_EMPTY');
      await mentor.agent
        .post(`${API}/resources`)
        .send({ title: 'Lien', url: 'http://non-securise.example' })
        .expect(422);
      await mentor.agent
        .post(`${API}/resources`)
        .send({ title: 'Lien', url: 'javascript:alert(1)' })
        .expect(422);
    });

    it('réserve la suppression à l’auteur ou à un administrateur', async () => {
      const author = await createMentor(app);
      const other = await createMentor(app);
      const r1 = await author.agent
        .post(`${API}/resources`)
        .send({ title: 'À supprimer', description: 'x' })
        .expect(201);
      const denied = await other.agent.delete(`${API}/resources/${r1.body.id}`).expect(403);
      expect(denied.body.code).toBe('NOT_RESOURCE_AUTHOR');
      await author.agent.delete(`${API}/resources/${r1.body.id}`).expect(200);

      const r2 = await author.agent
        .post(`${API}/resources`)
        .send({ title: 'À modérer', description: 'x' })
        .expect(201);
      const admin = await loginAs(app, demoEmail('admin'));
      await admin.delete(`${API}/resources/${r2.body.id}`).expect(200);
    });
  });

  describe('ressources d’un mentorat', () => {
    let mentor: TestUser;
    let mentee: TestUser;
    let intruder: TestUser;
    let mentorshipId: string;

    beforeAll(async () => {
      [mentor, mentee, intruder] = await Promise.all([
        createMentor(app),
        createMentee(app),
        createMentee(app),
      ]);
      mentorshipId = await createMentorship(mentee, mentor);
    });

    it('permet aux deux participants de partager, et notifie l’autre', async () => {
      await mentee.agent.post(`${API}/notifications/read-all`).expect(200);
      await mentor.agent
        .post(`${API}/mentorships/${mentorshipId}/resources`)
        .send({
          title: 'Checklist portfolio',
          url: 'https://developer.mozilla.org/fr/',
          kind: 'TOOL',
        })
        .expect(201);
      await mentee.agent
        .post(`${API}/mentorships/${mentorshipId}/resources`)
        .send({ title: 'Mon brouillon de CV', description: 'Lien vers mon brouillon à relire.' })
        .expect(201);
      const list = await mentor.agent
        .get(`${API}/mentorships/${mentorshipId}/resources`)
        .expect(200);
      expect(list.body).toHaveLength(2);
      const notifs = await mentee.agent.get(`${API}/notifications?unread=true`).expect(200);
      expect(notifs.body[0]).toMatchObject({
        type: 'RESOURCE_SHARED',
        link: `/mentorats/${mentorshipId}`,
      });
    });

    it('interdit tout accès à un tiers, y compris la suppression', async () => {
      await intruder.agent.get(`${API}/mentorships/${mentorshipId}/resources`).expect(403);
      await intruder.agent
        .post(`${API}/mentorships/${mentorshipId}/resources`)
        .send({ title: 'Intrusion', description: 'x' })
        .expect(403);
      const list = await mentor.agent
        .get(`${API}/mentorships/${mentorshipId}/resources`)
        .expect(200);
      await intruder.agent.delete(`${API}/resources/${list.body[0].id}`).expect(403);
    });

    it('partage un document joint, téléchargeable par les seuls participants', async () => {
      const pdf = Buffer.from('%PDF-1.7\nGuide de préparation\n%%EOF\n', 'utf8');
      const shared = await mentor.agent
        .post(`${API}/mentorships/${mentorshipId}/resources/upload`)
        .field('title', 'Guide d’entretien')
        .field('kind', 'TEMPLATE')
        .attach('file', pdf, { filename: 'Guide d’entretien.pdf', contentType: 'application/pdf' })
        .expect(201);
      expect(shared.body.file).toEqual({
        fileName: 'Guide d’entretien.pdf',
        mimeType: 'application/pdf',
        size: pdf.length,
      });
      expect(shared.body.url).toBeNull();

      const file = await mentee.agent
        .get(`${API}/resources/${shared.body.id}/file`)
        .buffer(true)
        .parse((res, done) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => done(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect(file.headers['content-type']).toContain('application/pdf');
      expect(file.headers['content-disposition']).toMatch(/^attachment;/);
      expect(file.headers['cache-control']).toBe('private, no-store');
      expect(Buffer.compare(file.body as Buffer, pdf)).toBe(0);

      // Un tiers ou un visiteur ne peut ni télécharger ni deviner l'existence du document.
      await intruder.agent.get(`${API}/resources/${shared.body.id}/file`).expect(404);
      await request(app.getHttpServer()).get(`${API}/resources/${shared.body.id}/file`).expect(404);
    });

    it('refuse un document au format interdit ou au contenu falsifié', async () => {
      const html = await mentor.agent
        .post(`${API}/mentorships/${mentorshipId}/resources/upload`)
        .field('title', 'Page piégée')
        .attach('file', Buffer.from('<script>alert(1)</script>'), 'page.html')
        .expect(422);
      expect(html.body.code).toBe('FILE_INVALID_TYPE');
      // Un exécutable renommé en .pdf est refusé : la signature ne correspond pas.
      await mentor.agent
        .post(`${API}/mentorships/${mentorshipId}/resources/upload`)
        .field('title', 'Faux PDF')
        .attach('file', Buffer.from('MZ\x90\x00binaire'), 'faux.pdf')
        .expect(422);
      // Au-delà de 10 Mo : 413.
      await mentor.agent
        .post(`${API}/mentorships/${mentorshipId}/resources/upload`)
        .field('title', 'Trop lourd')
        .attach(
          'file',
          Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(10 * 1024 * 1024)]),
          'gros.pdf',
        )
        .expect(413);
      // Sans document, sans lien ni description : refusé.
      const empty = await mentor.agent
        .post(`${API}/mentorships/${mentorshipId}/resources/upload`)
        .field('title', 'Vide')
        .expect(422);
      expect(empty.body.code).toBe('RESOURCE_EMPTY');
    });
  });

  describe('bibliothèque : document joint et validation par l’équipe', () => {
    const PDF = Buffer.from('%PDF-1.4\n%test');
    const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

    it('met le document d’un mentor en attente, puis le publie après validation', async () => {
      const mentor = await createMentor(app);
      const admin = await createMentee(app, { withProfile: false });
      await prismaOf(app).user.update({ where: { id: admin.id }, data: { role: 'ADMIN' } });
      const adminAgent = await loginAs(app, admin.email, TEST_PASSWORD);
      const server = app.getHttpServer();

      // Sans licence ni déclaration de droits : refusé.
      const noRights = await mentor.agent
        .post(`${API}/resources/upload`)
        .field('title', 'Mon livre sur le leadership')
        .attach('file', PDF, 'leadership.pdf')
        .expect(422);
      expect(noRights.body.code).toBe('RIGHTS_REQUIRED');

      const res = await mentor.agent
        .post(`${API}/resources/upload`)
        .field('title', 'Mon livre sur le leadership')
        .field('kind', 'BOOK')
        .field('license', 'AUTHOR')
        .field('rightsConfirmed', 'true')
        .field('language', 'Français')
        .attach('file', PDF, 'leadership.pdf')
        .attach('cover', JPEG, 'couverture.jpg')
        .expect(201);
      const id = res.body.id as string;
      expect(res.body).toMatchObject({ status: 'PENDING', kind: 'BOOK', license: 'AUTHOR' });
      expect(res.body.cover).not.toBeNull();

      // Invisible du public tant qu'il n'est pas validé ; visible de l'auteur et de l'équipe.
      const lib = await request(server).get(`${API}/resources?pageSize=50`).expect(200);
      expect(lib.body.items.map((r: { id: string }) => r.id)).not.toContain(id);
      await request(server).get(`${API}/resources/${id}/file`).expect(404);
      await request(server).get(`${API}/resources/${id}/cover`).expect(404);
      await mentor.agent.get(`${API}/resources/${id}/cover`).expect(200);
      const mine = await mentor.agent.get(`${API}/resources/mine`).expect(200);
      expect(mine.body[0]).toMatchObject({ id, status: 'PENDING' });

      // File de validation réservée à l'équipe.
      await mentor.agent.get(`${API}/admin/resources`).expect(403);
      const queue = await adminAgent.get(`${API}/admin/resources?pageSize=50`).expect(200);
      expect(queue.body.items.map((r: { id: string }) => r.id)).toContain(id);
      const overview = await adminAgent.get(`${API}/admin/overview`).expect(200);
      expect(overview.body.pendingResources).toBeGreaterThanOrEqual(1);

      await adminAgent.post(`${API}/admin/resources/${id}/approve`).expect(200);
      await adminAgent.post(`${API}/admin/resources/${id}/approve`).expect(409);

      const after = await request(server).get(`${API}/resources?pageSize=50`).expect(200);
      expect(after.body.items.map((r: { id: string }) => r.id)).toContain(id);
      const cover = await request(server).get(`${API}/resources/${id}/cover`).expect(200);
      expect(cover.headers['content-type']).toContain('image/jpeg');
      const download = await request(server).get(`${API}/resources/${id}/file`).expect(200);
      expect(download.headers['cache-control']).toBe('public, max-age=300');
      await request(server).get(`${API}/resources/${id}/file`).expect(200);
      const counted = await prismaOf(app).resource.findUniqueOrThrow({ where: { id } });
      expect(counted.downloadCount).toBe(2);

      const notes = await mentor.agent.get(`${API}/notifications`).expect(200);
      expect(JSON.stringify(notes.body)).toContain('est publiée');
    });

    it('refuse avec un motif ; l’équipe publie directement ; un lien reste immédiat', async () => {
      const mentor = await createMentor(app);
      const admin = await createMentee(app, { withProfile: false });
      await prismaOf(app).user.update({ where: { id: admin.id }, data: { role: 'ADMIN' } });
      const adminAgent = await loginAs(app, admin.email, TEST_PASSWORD);

      const pending = await mentor.agent
        .post(`${API}/resources/upload`)
        .field('title', 'Livre scanné')
        .field('license', 'PERMISSION')
        .field('rightsConfirmed', 'true')
        .attach('file', PDF, 'livre.pdf')
        .expect(201);
      await adminAgent
        .post(`${API}/admin/resources/${pending.body.id}/reject`)
        .send({ note: 'court' })
        .expect(422);
      const rejected = await adminAgent
        .post(`${API}/admin/resources/${pending.body.id}/reject`)
        .send({ note: 'Merci de joindre l’autorisation écrite de l’éditeur.' })
        .expect(200);
      expect(rejected.body.status).toBe('REJECTED');
      const mine = await mentor.agent.get(`${API}/resources/mine`).expect(200);
      expect(mine.body[0].reviewNote).toContain('autorisation');

      const byAdmin = await adminAgent
        .post(`${API}/resources/upload`)
        .field('title', 'Guide officiel de l’orientation')
        .field('kind', 'GUIDE')
        .field('license', 'PUBLIC_DOMAIN')
        .field('rightsConfirmed', 'true')
        .attach('file', PDF, 'guide.pdf')
        .expect(201);
      expect(byAdmin.body.status).toBe('PUBLISHED');

      const link = await mentor.agent
        .post(`${API}/resources`)
        .send({ title: 'Mon podcast', kind: 'PODCAST', url: 'https://example.com/podcast' })
        .expect(201);
      expect(link.body.status).toBe('PUBLISHED');

      const mentee = await createMentee(app);
      await mentee.agent
        .post(`${API}/resources/upload`)
        .field('title', 'Interdit aux mentorés')
        .attach('file', PDF, 'doc.pdf')
        .expect(403);
    });
  });

  describe('notifications', () => {
    it('suivent tout le parcours : demande, acceptation, réservation, confirmation, annulation, retour', async () => {
      const mentor = await createMentor(app);
      const mentee = await createMentee(app);
      const types = async (u: TestUser) =>
        ((await u.agent.get(`${API}/notifications`).expect(200)).body as { type: string }[]).map(
          (n) => n.type,
        );

      const req = await mentee.agent
        .post(`${API}/mentorship-requests`)
        .send({
          mentorId: mentor.id,
          goal: 'Préparer un entretien technique',
          message: 'Bonjour, j’aimerais être accompagné pour préparer mes entretiens techniques.',
        })
        .expect(201);
      expect(await types(mentor)).toContain('REQUEST_RECEIVED');

      const accepted = await mentor.agent
        .post(`${API}/mentorship-requests/${req.body.id}/accept`)
        .send({})
        .expect(200);
      const menteeNotifs = (await mentee.agent.get(`${API}/notifications`).expect(200)).body;
      expect(menteeNotifs[0]).toMatchObject({
        type: 'REQUEST_ACCEPTED',
        link: `/mentorats/${accepted.body.mentorship.id}`,
      });

      // Rejouer l'acceptation (idempotente) ne crée pas de doublon.
      await mentor.agent
        .post(`${API}/mentorship-requests/${req.body.id}/accept`)
        .send({})
        .expect(200);
      expect((await types(mentee)).filter((t) => t === 'REQUEST_ACCEPTED')).toHaveLength(1);

      const slotId = await createSlot(mentor, 12, 9);
      const session = await mentee.agent
        .post(`${API}/sessions`)
        .send({ slotId, topic: 'Simulation' })
        .expect(201);
      expect(await types(mentor)).toContain('SESSION_REQUESTED');
      await mentor.agent.post(`${API}/sessions/${session.body.id}/confirm`).send({}).expect(200);
      expect(await types(mentee)).toContain('SESSION_CONFIRMED');
      await mentee.agent.post(`${API}/sessions/${session.body.id}/cancel`).expect(200);
      expect(await types(mentor)).toContain('SESSION_CANCELLED');

      const goal = await mentee.agent
        .post(`${API}/mentorships/${accepted.body.mentorship.id}/goals`)
        .send({ title: 'Réussir trois entretiens blancs' })
        .expect(201);
      await mentor.agent
        .patch(`${API}/goals/${goal.body.id}`)
        .send({ mentorFeedback: 'Bon début.' })
        .expect(200);
      expect(await types(mentee)).toContain('GOAL_FEEDBACK');
    });

    it('notifie le refus avec la note du mentor', async () => {
      const mentor = await createMentor(app);
      const mentee = await createMentee(app);
      const req = await mentee.agent
        .post(`${API}/mentorship-requests`)
        .send({
          mentorId: mentor.id,
          goal: 'Lancer mon activité en ligne',
          message:
            'Bonjour, je souhaite être accompagné pour lancer mon activité de vente en ligne.',
        })
        .expect(201);
      await mentor.agent
        .post(`${API}/mentorship-requests/${req.body.id}/decline`)
        .send({ note: 'Je vous conseille un mentor en marketing digital.' })
        .expect(200);
      const [last] = (await mentee.agent.get(`${API}/notifications`).expect(200)).body;
      expect(last).toMatchObject({
        type: 'REQUEST_DECLINED',
        body: 'Je vous conseille un mentor en marketing digital.',
      });
    });

    it('gère le compteur de non-lus et la lecture', async () => {
      const mentor = await createMentor(app);
      const mentee = await createMentee(app);
      await createMentorship(mentee, mentor);
      const before = await mentor.agent.get(`${API}/notifications/unread-count`).expect(200);
      expect(before.body.count).toBe(1);
      const [n] = (await mentor.agent.get(`${API}/notifications?unread=true`).expect(200)).body;
      await mentor.agent.post(`${API}/notifications/${n.id}/read`).expect(200);
      expect(
        (await mentor.agent.get(`${API}/notifications/unread-count`).expect(200)).body.count,
      ).toBe(0);
    });

    it('cloisonne les notifications entre utilisateurs', async () => {
      const mentor = await createMentor(app);
      const mentee = await createMentee(app);
      await createMentorship(mentee, mentor);
      const [n] = (await mentor.agent.get(`${API}/notifications`).expect(200)).body;
      const res = await mentee.agent.post(`${API}/notifications/${n.id}/read`).expect(404);
      expect(res.body.code).toBe('NOTIFICATION_NOT_FOUND');
      await request(app.getHttpServer()).get(`${API}/notifications`).expect(401);
    });
  });
});
