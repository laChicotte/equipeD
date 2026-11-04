import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  API,
  TEST_PASSWORD,
  createApp,
  demoEmail,
  loginAs,
  prismaOf,
  uniqueEmail,
} from './helpers.js';

describe('Authentification et sessions', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('inscrit un utilisateur et pose un cookie de session HttpOnly SameSite=Lax', async () => {
    const res = await request(app.getHttpServer())
      .post(`${API}/auth/register`)
      .send({
        email: uniqueEmail('reg'),
        password: TEST_PASSWORD,
        firstName: 'Awa',
        lastName: 'Test',
        role: 'MENTEE',
      })
      .expect(201);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/tc_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(res.body).toEqual({ ok: true });
  });

  it('stocke un hash Argon2id et seulement le hash du jeton de session', async () => {
    const email = uniqueEmail('hash');
    const agent = request.agent(app.getHttpServer());
    const res = await agent
      .post(`${API}/auth/register`)
      .send({ email, password: TEST_PASSWORD, firstName: 'A', lastName: 'B', role: 'MENTOR' })
      .expect(201);
    const token = /tc_session=([^;]+)/.exec(String(res.headers['set-cookie']))![1];
    const user = await prismaOf(app).user.findUniqueOrThrow({
      where: { email },
      include: { sessions: true },
    });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.sessions).toHaveLength(1);
    expect(user.sessions[0].tokenHash).not.toContain(token);
    expect(user.sessions[0].tokenHash).toHaveLength(64);
  });

  it('refuse un email déjà utilisé (409 EMAIL_TAKEN), sans tenir compte de la casse', async () => {
    const email = uniqueEmail('dup');
    const body = { email, password: TEST_PASSWORD, firstName: 'A', lastName: 'B', role: 'MENTEE' };
    await request(app.getHttpServer()).post(`${API}/auth/register`).send(body).expect(201);
    const res = await request(app.getHttpServer())
      .post(`${API}/auth/register`)
      .send({ ...body, email: email.toUpperCase() })
      .expect(409);
    expect(res.body.code).toBe('EMAIL_TAKEN');
  });

  it('renvoie 422 avec le détail par champ pour un formulaire invalide', async () => {
    const res = await request(app.getHttpServer())
      .post(`${API}/auth/register`)
      .send({
        email: 'pas-un-email',
        password: 'court',
        firstName: '',
        lastName: 'B',
        role: 'MENTEE',
      })
      .expect(422);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    const fields = (res.body.details as { field: string }[]).map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['email', 'password', 'firstName']));
  });

  it("interdit de s'inscrire comme administrateur", async () => {
    const res = await request(app.getHttpServer())
      .post(`${API}/auth/register`)
      .send({
        email: uniqueEmail('adm'),
        password: TEST_PASSWORD,
        firstName: 'A',
        lastName: 'B',
        role: 'ADMIN',
      })
      .expect(422);
    expect(res.body.details[0].field).toBe('role');
  });

  it('rejette les champs non déclarés (whitelist stricte)', async () => {
    await request(app.getHttpServer())
      .post(`${API}/auth/register`)
      .send({
        email: uniqueEmail('x'),
        password: TEST_PASSWORD,
        firstName: 'A',
        lastName: 'B',
        role: 'MENTEE',
        status: 'ACTIVE',
      })
      .expect(422);
  });

  it('refuse un mauvais mot de passe avec un message générique (401)', async () => {
    const wrong = await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ email: demoEmail('aminata'), password: 'mauvais-mot-de-passe' })
      .expect(401);
    const unknown = await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ email: 'inconnu@example.test', password: 'mauvais-mot-de-passe' })
      .expect(401);
    expect(wrong.body.code).toBe('INVALID_CREDENTIALS');
    expect(unknown.body.message).toBe(wrong.body.message);
  });

  it('expose /auth/me sans aucun champ sensible', async () => {
    const agent = await loginAs(app, demoEmail('aminata'));
    const res = await agent.get(`${API}/auth/me`).expect(200);
    expect(res.body).toMatchObject({
      email: demoEmail('aminata'),
      role: 'MENTEE',
      hasProfile: true,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/password|tokenHash/i);
  });

  it('révoque la session côté serveur à la déconnexion', async () => {
    const agent = await loginAs(app, demoEmail('fatoumata'));
    await agent.post(`${API}/auth/logout`).expect(200);
    const res = await agent.get(`${API}/auth/me`).expect(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('rejette un cookie forgé', async () => {
    await request(app.getHttpServer())
      .get(`${API}/auth/me`)
      .set('Cookie', 'tc_session=forged-token')
      .expect(401);
  });

  it('bloque un compte suspendu, y compris ses sessions existantes', async () => {
    const email = uniqueEmail('susp');
    const agent = request.agent(app.getHttpServer());
    await agent
      .post(`${API}/auth/register`)
      .send({ email, password: TEST_PASSWORD, firstName: 'A', lastName: 'B', role: 'MENTEE' })
      .expect(201);
    const me = await agent.get(`${API}/auth/me`).expect(200);
    const admin = await loginAs(app, demoEmail('admin'));
    await admin
      .patch(`${API}/admin/users/${me.body.id}/status`)
      .send({ status: 'SUSPENDED' })
      .expect(200);
    await agent.get(`${API}/auth/me`).expect(401);
    const login = await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ email, password: TEST_PASSWORD })
      .expect(401);
    expect(login.body.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('refuse les routes admin aux non-administrateurs (403)', async () => {
    const agent = await loginAs(app, demoEmail('aminata'));
    const res = await agent.get(`${API}/admin/overview`).expect(403);
    expect(res.body.code).toBe('ROLE_FORBIDDEN');
  });

  it('bloque une requête modifiante venant d’une origine non autorisée (CSRF)', async () => {
    const res = await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .set('Origin', 'https://site-malveillant.example')
      .send({ email: demoEmail('aminata'), password: 'Mentorat2026!' })
      .expect(403);
    expect(res.body.code).toBe('ORIGIN_NOT_ALLOWED');
    await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .set('Origin', 'http://localhost:3000')
      .send({ email: demoEmail('aminata'), password: 'Mentorat2026!' })
      .expect(200);
  });

  it('répond au healthcheck', async () => {
    const res = await request(app.getHttpServer()).get(`${API}/health`).expect(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'up' });
  });
});
