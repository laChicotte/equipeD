import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { API, createApp, demoEmail, loginAs } from './helpers.js';

describe('Annuaire, fiche mentor et suggestions', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
  });

  const list = (query: string) =>
    request(app.getHttpServer()).get(`${API}/mentors${query}`).expect(200);

  it('liste les 7 domaines des TDR avec le nombre réel de mentors', async () => {
    const res = await request(app.getHttpServer()).get(`${API}/domains`).expect(200);
    expect(res.body).toHaveLength(7);
    const campus = res.body.find((d: { slug: string }) => d.slug === 'campus-france');
    expect(campus.description).toMatch(/ne garantit ni l’admission ni l’obtention d’un visa/);
    expect(campus.mentorCount).toBeGreaterThanOrEqual(1);
  });

  it('trouve « Développement web » sans tenir compte des accents ni de la casse', async () => {
    const withAccents = await list('?q=D%C3%A9veloppement%20web');
    const without = await list('?q=developpement%20WEB');
    const names = (r: request.Response) =>
      r.body.items.map((m: { firstName: string }) => m.firstName);
    expect(names(withAccents)).toContain('Fatoumata');
    expect(names(without)).toEqual(names(withAccents));
  });

  it('filtre par domaine, modalité et langue', async () => {
    const domain = await list('?domain=campus-france&pageSize=50');
    for (const m of domain.body.items) {
      expect(m.domains.map((d: { slug: string }) => d.slug)).toContain('campus-france');
    }
    const inPerson = await list('?modality=IN_PERSON&pageSize=50');
    for (const m of inPerson.body.items) {
      expect(m.modalities.some((x: string) => x === 'IN_PERSON' || x === 'HYBRID')).toBe(true);
    }
    const english = await list('?language=anglais&pageSize=50');
    expect(english.body.items.length).toBeGreaterThan(0);
    for (const m of english.body.items) expect(m.languages).toContain('Anglais');
  });

  it('pagine les résultats', async () => {
    const page1 = await list('?pageSize=2&page=1');
    expect(page1.body.items).toHaveLength(2);
    expect(page1.body.totalPages).toBe(Math.ceil(page1.body.total / 2));
    const page2 = await list('?pageSize=2&page=2');
    expect(page2.body.items[0].id).not.toBe(page1.body.items[0].id);
  });

  it('renvoie 422 pour un filtre invalide', async () => {
    await request(app.getHttpServer()).get(`${API}/mentors?modality=TELEPATHIE`).expect(422);
    await request(app.getHttpServer()).get(`${API}/mentors?pageSize=500`).expect(422);
  });

  it('n’expose jamais l’email ni de donnée privée dans l’annuaire et la fiche', async () => {
    const res = await list('?pageSize=50');
    const detail = await request(app.getHttpServer())
      .get(`${API}/mentors/${res.body.items[0].id}`)
      .expect(200);
    for (const payload of [res.body, detail.body]) {
      const json = JSON.stringify(payload);
      expect(json).not.toMatch(/@demo\.talents-connectes\.test|passwordHash|searchText|email/);
    }
  });

  it('indique la relation entre le mentoré connecté et le mentor', async () => {
    const mohamed = await loginAs(app, demoEmail('mohamed'));
    const thierno = await list('?q=thierno');
    const detail = await mohamed.get(`${API}/mentors/${thierno.body.items[0].id}`).expect(200);
    expect(detail.body.relation.mentorshipId).toBeTruthy();
    const anonymous = await request(app.getHttpServer())
      .get(`${API}/mentors/${thierno.body.items[0].id}`)
      .expect(200);
    expect(anonymous.body.relation).toBeNull();
  });

  it('renvoie 404 pour une fiche inexistante', async () => {
    const res = await request(app.getHttpServer()).get(`${API}/mentors/inexistant`).expect(404);
    expect(res.body).toMatchObject({ statusCode: 404, code: 'MENTOR_NOT_FOUND' });
  });

  it('suggère des mentors pertinents avec des raisons explicables', async () => {
    const aminata = await loginAs(app, demoEmail('aminata'));
    const res = await aminata.get(`${API}/mentors/suggestions`).expect(200);
    expect(res.body.profileRequired).toBe(false);
    expect(res.body.items[0].mentor.firstName).toBe('Fatoumata');
    expect(res.body.items[0].reasons.join(' ')).toMatch(/Numérique et technologies/);
    const scores = res.body.items.map((s: { score: number }) => s.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('réserve les suggestions aux mentorés', async () => {
    const fatoumata = await loginAs(app, demoEmail('fatoumata'));
    await fatoumata.get(`${API}/mentors/suggestions`).expect(403);
    await request(app.getHttpServer()).get(`${API}/mentors/suggestions`).expect(401);
  });
});
