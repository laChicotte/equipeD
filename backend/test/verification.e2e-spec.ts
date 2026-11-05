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
  TEST_PASSWORD,
  type Agent,
  type TestUser,
} from './helpers.js';

const PDF = Buffer.from('%PDF-1.7\nAttestation de travail\n%%EOF\n');

async function domainId(app: INestApplication, slug: string) {
  const d = await prismaOf(app).expertiseDomain.findFirstOrThrow({ where: { slug } });
  return d.id;
}

describe('Vérification des profils et candidatures de mentor', () => {
  let app: INestApplication;
  let admin: Agent;
  let adminUser: TestUser;

  beforeAll(async () => {
    app = await createApp();
    adminUser = await createMentee(app, { withProfile: false });
    await prismaOf(app).user.update({ where: { id: adminUser.id }, data: { role: 'ADMIN' } });
    admin = await loginAs(app, adminUser.email, TEST_PASSWORD);
  });
  afterAll(async () => {
    await app.close();
  });

  describe('vérification d’un profil mentor', () => {
    it('envoie une demande avec justificatif, que l’équipe valide (badge vérifié)', async () => {
      const mentor = await createMentor(app);
      const req = await mentor.agent
        .post(`${API}/verification/mentor`)
        .send({
          message: 'Développeur depuis 5 ans chez un opérateur télécom, attestation jointe.',
          profileUrl: 'https://www.linkedin.com/in/test-mentor',
        })
        .expect(201);
      expect(req.body).toMatchObject({ kind: 'MENTOR_VERIFICATION', status: 'PENDING' });

      // Une seule demande en attente à la fois.
      const twice = await mentor.agent
        .post(`${API}/verification/mentor`)
        .send({ message: 'Deuxième demande pendant que la première est en cours.' })
        .expect(409);
      expect(twice.body.code).toBe('VERIFICATION_ALREADY_PENDING');

      const doc = await mentor.agent
        .post(`${API}/verification/${req.body.id}/documents`)
        .attach('file', PDF, 'attestation.pdf')
        .expect(201);
      // Un document bureautique n'est pas un justificatif accepté.
      const word = await mentor.agent
        .post(`${API}/verification/${req.body.id}/documents`)
        .attach('file', Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]), 'cv.docx')
        .expect(422);
      expect(word.body.code).toBe('FILE_INVALID_TYPE');

      // Le justificatif est privé : la personne et l'équipe seulement.
      const other = await createMentor(app);
      await other.agent.get(`${API}/verification/documents/${doc.body.id}`).expect(404);
      await mentor.agent.get(`${API}/verification/documents/${doc.body.id}`).expect(200);
      await admin.get(`${API}/verification/documents/${doc.body.id}`).expect(200);

      const queue = await admin.get(`${API}/admin/verifications`).expect(200);
      const item = queue.body.find((r: { id: string }) => r.id === req.body.id);
      expect(item.documents).toHaveLength(1);
      expect(item.mentorProfile.verificationStatus).toBe('PENDING');

      await mentor.agent.get(`${API}/admin/verifications`).expect(403);
      await admin.post(`${API}/admin/verifications/${req.body.id}/approve`).send({}).expect(200);
      const card = await request(app.getHttpServer())
        .get(`${API}/mentors/${mentor.id}`)
        .expect(200);
      expect(card.body.verificationStatus).toBe('VERIFIED');

      const again = await admin
        .post(`${API}/admin/verifications/${req.body.id}/approve`)
        .send({})
        .expect(409);
      expect(again.body.code).toBe('VERIFICATION_CLOSED');
      const [notif] = (await mentor.agent.get(`${API}/notifications`).expect(200)).body;
      expect(notif.type).toBe('VERIFICATION_APPROVED');
      const audit = await admin.get(`${API}/admin/audit?action=VERIFICATION_APPROVED`).expect(200);
      expect(audit.body.items[0].targetId).toBe(mentor.id);
    });

    it('exige un motif pour refuser ; la personne peut retenter', async () => {
      const mentor = await createMentor(app);
      const req = await mentor.agent
        .post(`${API}/verification/mentor`)
        .send({ message: 'Formateur indépendant, références disponibles sur demande.' })
        .expect(201);
      const noNote = await admin
        .post(`${API}/admin/verifications/${req.body.id}/reject`)
        .send({})
        .expect(422);
      expect(noNote.body.code).toBe('DECISION_NOTE_REQUIRED');
      await admin
        .post(`${API}/admin/verifications/${req.body.id}/reject`)
        .send({ note: 'Merci de joindre une attestation de votre employeur.' })
        .expect(200);
      const mine = await mentor.agent.get(`${API}/verification/me`).expect(200);
      expect(mine.body.requests[0]).toMatchObject({
        status: 'REJECTED',
        decisionNote: 'Merci de joindre une attestation de votre employeur.',
      });
      expect(mine.body.mentorProfile.verificationStatus).toBe('REJECTED');
      await mentor.agent
        .post(`${API}/verification/mentor`)
        .send({ message: 'Nouvelle demande, avec l’attestation demandée cette fois.' })
        .expect(201);
    });
  });

  describe('un mentoré devient mentor', () => {
    const application = async (dId: string) => ({
      headline: 'Développeuse web junior, j’aide les débutants',
      bio: 'Accompagnée sur la plateforme pendant six mois, je travaille aujourd’hui comme développeuse et je souhaite transmettre à mon tour ce que j’ai appris.',
      yearsExperience: 2,
      expertise: ['HTML', 'CSS', 'React'],
      languages: ['Français'],
      modalities: ['REMOTE'],
      domainIds: [dId],
      sessionDurationMin: 60,
      message: 'J’ai été accompagnée, j’ai trouvé un emploi et je veux aider à mon tour.',
    });

    it('candidate, reste mentoré pendant l’examen, puis devient mentor une fois accepté', async () => {
      const mentee = await createMentee(app);
      const body = await application(await domainId(app, 'numerique-technologies'));

      // Un mentor ne peut pas « candidater » ; un mentoré ne peut pas demander une vérification.
      const mentor = await createMentor(app);
      await mentor.agent.post(`${API}/verification/mentor-application`).send(body).expect(403);
      await mentee.agent
        .post(`${API}/verification/mentor`)
        .send({ message: 'Je ne suis pas encore mentor, cette route ne me concerne pas.' })
        .expect(403);

      const req = await mentee.agent
        .post(`${API}/verification/mentor-application`)
        .send(body)
        .expect(201);
      expect(req.body.kind).toBe('MENTOR_APPLICATION');
      // Pas encore visible dans l'annuaire, toujours mentoré.
      await request(app.getHttpServer()).get(`${API}/mentors/${mentee.id}`).expect(404);
      expect((await mentee.agent.get(`${API}/auth/me`).expect(200)).body.role).toBe('MENTEE');

      await admin.post(`${API}/admin/verifications/${req.body.id}/approve`).send({}).expect(200);
      const me = await mentee.agent.get(`${API}/auth/me`).expect(200);
      expect(me.body.role).toBe('MENTOR');
      const card = await request(app.getHttpServer())
        .get(`${API}/mentors/${mentee.id}`)
        .expect(200);
      expect(card.body).toMatchObject({
        headline: 'Développeuse web junior, j’aide les débutants',
        verificationStatus: 'VERIFIED',
      });
      const audit = await admin
        .get(`${API}/admin/audit?action=MENTOR_APPLICATION_APPROVED`)
        .expect(200);
      expect(audit.body.items[0].targetId).toBe(mentee.id);
    });

    it('refuse la promotion tant qu’un mentorat est en cours en tant que mentoré', async () => {
      const mentee = await createMentee(app);
      const mentor = await createMentor(app);
      await createMentorship(mentee, mentor);
      const req = await mentee.agent
        .post(`${API}/verification/mentor-application`)
        .send(await application(await domainId(app, 'numerique-technologies')))
        .expect(201);
      const busy = await admin
        .post(`${API}/admin/verifications/${req.body.id}/approve`)
        .send({})
        .expect(409);
      expect(busy.body.code).toBe('USER_HAS_ACTIVE_MENTORING');

      // La personne peut retirer sa candidature ; son profil mentor reste invisible.
      await mentee.agent.delete(`${API}/verification/${req.body.id}`).expect(200);
      const mine = await mentee.agent.get(`${API}/verification/me`).expect(200);
      expect(mine.body.requests[0].status).toBe('WITHDRAWN');
      expect(mine.body.mentorProfile).toMatchObject({ isPublished: false });
    });
  });
});
