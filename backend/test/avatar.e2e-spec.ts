import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  API,
  createApp,
  createMentee,
  createMentor,
  createMentorship,
  prismaOf,
} from './helpers.js';

/** En-tête JPEG minimal suivi d'octets quelconques : seule la signature est contrôlée. */
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2048, 7)]);
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(512, 1),
]);

describe('Photo de profil', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('enregistre, sert, remplace puis retire la photo', async () => {
    const mentee = await createMentee(app);
    const up = await mentee.agent
      .put(`${API}/profile/me/avatar`)
      .set('Content-Type', 'image/jpeg')
      .send(JPEG)
      .expect(200);
    expect(up.body.avatarUpdatedAt).toEqual(expect.any(String));

    const me = await mentee.agent.get(`${API}/auth/me`).expect(200);
    expect(me.body.avatarUpdatedAt).toBe(up.body.avatarUpdatedAt);

    const img = await mentee.agent.get(`${API}/users/${mentee.id}/avatar`).expect(200);
    expect(img.headers['content-type']).toMatch(/^image\/jpeg/);
    expect(img.headers['cache-control']).toContain('private');
    expect(Buffer.compare(img.body as Buffer, JPEG)).toBe(0);

    // Remplacement : le type réel est déduit des octets, pas de l'en-tête annoncé.
    await mentee.agent
      .put(`${API}/profile/me/avatar`)
      .set('Content-Type', 'image/jpeg')
      .send(PNG)
      .expect(200);
    const png = await mentee.agent.get(`${API}/users/${mentee.id}/avatar`).expect(200);
    expect(png.headers['content-type']).toMatch(/^image\/png/);

    await mentee.agent.delete(`${API}/profile/me/avatar`).expect(204);
    await mentee.agent.get(`${API}/users/${mentee.id}/avatar`).expect(404);
    const after = await mentee.agent.get(`${API}/auth/me`).expect(200);
    expect(after.body.avatarUpdatedAt).toBeNull();
  });

  it('refuse un fichier qui n’est pas une image ou qui dépasse 1 Mo', async () => {
    const mentee = await createMentee(app);
    const bad = await mentee.agent
      .put(`${API}/profile/me/avatar`)
      .set('Content-Type', 'image/png')
      .send(Buffer.from('<svg onload="alert(1)"></svg>'))
      .expect(422);
    expect(bad.body.code).toBe('AVATAR_INVALID_TYPE');

    const big = Buffer.concat([JPEG, Buffer.alloc(1024 * 1024, 1)]);
    const tooBig = await mentee.agent
      .put(`${API}/profile/me/avatar`)
      .set('Content-Type', 'image/jpeg')
      .send(big)
      .expect(413);
    expect(tooBig.body.code).toBe('AVATAR_TOO_LARGE');

    await request(app.getHttpServer())
      .put(`${API}/profile/me/avatar`)
      .set('Content-Type', 'image/jpeg')
      .send(JPEG)
      .expect(401);
  });

  it('publique pour un mentor de l’annuaire, privée pour un mentoré sans lien', async () => {
    const mentor = await createMentor(app);
    const mentee = await createMentee(app);
    const stranger = await createMentee(app);
    for (const u of [mentor, mentee]) {
      await u.agent
        .put(`${API}/profile/me/avatar`)
        .set('Content-Type', 'image/jpeg')
        .send(JPEG)
        .expect(200);
    }

    // Mentor publié : visible sans session, en cache public.
    const pub = await request(app.getHttpServer())
      .get(`${API}/users/${mentor.id}/avatar`)
      .expect(200);
    expect(pub.headers['cache-control']).toContain('public');
    const card = await request(app.getHttpServer()).get(`${API}/mentors/${mentor.id}`).expect(200);
    expect(card.body.avatarUpdatedAt).toEqual(expect.any(String));

    // Mentoré : invisible sans session et pour un inconnu (404, rien n'est révélé).
    await request(app.getHttpServer()).get(`${API}/users/${mentee.id}/avatar`).expect(404);
    await stranger.agent.get(`${API}/users/${mentee.id}/avatar`).expect(404);

    // Une fois liés par un mentorat, le mentor voit la photo de son mentoré.
    await createMentorship(mentee, mentor);
    await mentor.agent.get(`${API}/users/${mentee.id}/avatar`).expect(200);
  });

  it('efface la photo avec le compte', async () => {
    const mentee = await createMentee(app);
    await mentee.agent
      .put(`${API}/profile/me/avatar`)
      .set('Content-Type', 'image/jpeg')
      .send(JPEG)
      .expect(200);
    await mentee.agent
      .delete(`${API}/profile/me`)
      .send({ password: 'Motdepasse2026', confirmation: 'SUPPRIMER' })
      .expect(200);
    const row = await prismaOf(app).userAvatar.findUnique({ where: { userId: mentee.id } });
    expect(row).toBeNull();
  });
});
