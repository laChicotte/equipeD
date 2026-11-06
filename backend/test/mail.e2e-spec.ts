import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { vi } from 'vitest';
import { MailService, renderMail, type MailMessage } from '../src/modules/mail/mail.module.js';
import {
  API,
  createApp,
  createMentee,
  createMentor,
  TEST_PASSWORD,
  uniqueEmail,
  type TestUser,
} from './helpers.js';

const tokenOf = (m: MailMessage) => new URL(m.action!.url).searchParams.get('jeton')!;

describe('Emails : confirmation de l’adresse et mot de passe oublié (envoi simulé)', () => {
  let app: INestApplication;
  let sent: MailMessage[];

  beforeAll(async () => {
    app = await createApp();
  });
  beforeEach(() => {
    sent = [];
    const mail = app.get(MailService);
    vi.spyOn(mail, 'enabled', 'get').mockReturnValue(true);
    vi.spyOn(mail, 'send').mockImplementation(async (m) => {
      sent.push(m);
      return true;
    });
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await app.close();
  });

  it('envoie un lien à l’inscription et exige l’adresse confirmée pour une demande', async () => {
    const mentor: TestUser = await createMentor(app);
    const mentee = await createMentee(app);
    await vi.waitFor(() => expect(sent.some((m) => m.to === mentee.email)).toBe(true));
    const mail = sent.find((m) => m.to === mentee.email)!;
    expect(mail.subject).toContain('Confirmez');
    expect(mail.action!.url).toContain('/verifier-email?jeton=');

    const me = await mentee.agent.get(`${API}/auth/me`).expect(200);
    expect(me.body).toMatchObject({ emailVerified: false, emailVerificationRequired: true });

    const blocked = await mentee.agent
      .post(`${API}/mentorship-requests`)
      .send({
        mentorId: mentor.id,
        goal: 'Construire mon premier portfolio',
        message: 'Bonjour, je souhaite être accompagnée pour construire un portfolio solide.',
      })
      .expect(403);
    expect(blocked.body.code).toBe('EMAIL_NOT_VERIFIED');

    // Renvoi : l'ancien lien n'est plus valable.
    await mentee.agent.post(`${API}/auth/email/resend`).expect(200);
    const fresh = sent.filter((m) => m.to === mentee.email).at(-1)!;
    const server = app.getHttpServer();
    await request(server)
      .post(`${API}/auth/email/verify`)
      .set('Origin', 'http://localhost:3000')
      .send({ token: tokenOf(mail) })
      .expect(404);
    const ok = await request(server)
      .post(`${API}/auth/email/verify`)
      .set('Origin', 'http://localhost:3000')
      .send({ token: tokenOf(fresh) })
      .expect(200);
    expect(ok.body).toEqual({ verified: true, email: mentee.email });
    // Deuxième clic sur le même lien : pas d'erreur.
    await request(server)
      .post(`${API}/auth/email/verify`)
      .set('Origin', 'http://localhost:3000')
      .send({ token: tokenOf(fresh) })
      .expect(200);

    const after = await mentee.agent.get(`${API}/auth/me`).expect(200);
    expect(after.body).toMatchObject({ emailVerified: true, emailVerificationRequired: false });
    await mentee.agent
      .post(`${API}/mentorship-requests`)
      .send({
        mentorId: mentor.id,
        goal: 'Construire mon premier portfolio',
        message: 'Bonjour, je souhaite être accompagnée pour construire un portfolio solide.',
      })
      .expect(201);
  });

  it('mot de passe oublié : même réponse pour toute adresse, lien valable une fois', async () => {
    const user = await createMentee(app, { withProfile: false });
    const server = app.getHttpServer();
    const ask = (email: string) =>
      request(server)
        .post(`${API}/auth/password-reset/request`)
        .set('Origin', 'http://localhost:3000')
        .send({ email });

    sent = [];
    const unknown = await ask(uniqueEmail('inconnu')).expect(200);
    expect(unknown.body).toEqual({ ok: true, emailEnabled: true });
    expect(sent).toHaveLength(0);

    const known = await ask(user.email.toUpperCase()).expect(200);
    expect(known.body).toEqual(unknown.body);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].action!.url).toContain('/reinitialiser-mot-de-passe?jeton=');

    const token = tokenOf(sent[0]);
    await request(server)
      .post(`${API}/auth/password-reset`)
      .set('Origin', 'http://localhost:3000')
      .send({ token, newPassword: 'NouveauMotDePasse2026' })
      .expect(200);
    await vi.waitFor(() => expect(sent.some((m) => m.subject.includes('modifié'))).toBe(true));
    await request(server)
      .post(`${API}/auth/password-reset`)
      .set('Origin', 'http://localhost:3000')
      .send({ token, newPassword: 'EncoreUnAutre2026' })
      .expect(404);
    await request(server)
      .post(`${API}/auth/login`)
      .set('Origin', 'http://localhost:3000')
      .send({ email: user.email, password: TEST_PASSWORD })
      .expect(401);
    await request(server)
      .post(`${API}/auth/login`)
      .set('Origin', 'http://localhost:3000')
      .send({ email: user.email, password: 'NouveauMotDePasse2026' })
      .expect(200);
  });

  it('sans service d’email : le mot de passe oublié renvoie vers l’équipe', async () => {
    vi.spyOn(app.get(MailService), 'enabled', 'get').mockReturnValue(false);
    const res = await request(app.getHttpServer())
      .post(`${API}/auth/password-reset/request`)
      .set('Origin', 'http://localhost:3000')
      .send({ email: uniqueEmail('x') })
      .expect(200);
    expect(res.body).toEqual({ ok: true, emailEnabled: false });
  });

  it('échappe le contenu des emails', () => {
    const { html, text } = renderMail({
      to: 'a@b.test',
      subject: 'Test',
      heading: 'Bonjour <script>',
      paragraphs: ['Lien "x" & <b>'],
      action: { label: 'Ouvrir', url: 'https://exemple.test/?a=1&b=2' },
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('a=1&amp;b=2');
    expect(text).toContain('Ouvrir : https://exemple.test/?a=1&b=2');
  });
});
