import type { INestApplication } from '@nestjs/common';
import {
  API,
  createApp,
  createMentee,
  createMentor,
  createMentorship,
  prismaOf,
  type TestUser,
} from './helpers.js';

describe('Groupes d’accompagnement', () => {
  let app: INestApplication;
  let owner: TestUser;
  let colleague: TestUser;
  let menteeA: TestUser;
  let menteeB: TestUser;
  let stranger: TestUser;

  beforeAll(async () => {
    app = await createApp();
    owner = await createMentor(app);
    colleague = await createMentor(app);
    menteeA = await createMentee(app);
    menteeB = await createMentee(app);
    stranger = await createMentee(app);
    await createMentorship(menteeA, owner);
    const second = await createMentorship(menteeB, owner);
    // Un ancien mentoré (mentorat clôturé) reste ajoutable.
    await menteeB.agent.post(`${API}/mentorships/${second}/complete`).send({}).expect(200);
  });
  afterAll(async () => {
    await app.close();
  });

  it('seul un mentor crée un groupe, avec ses mentorés et des mentors', async () => {
    await menteeA.agent.post(`${API}/groups`).send({ name: 'Groupe mentoré' }).expect(403);

    const candidates = await owner.agent.get(`${API}/groups/candidates`).expect(200);
    const ids = candidates.body.map((c: { id: string }) => c.id);
    expect(ids).toEqual(expect.arrayContaining([menteeA.id, menteeB.id, colleague.id]));
    expect(ids).not.toContain(stranger.id);
    expect(ids).not.toContain(owner.id);

    // Un mentoré qui n'est pas le sien est refusé.
    const refused = await owner.agent
      .post(`${API}/groups`)
      .send({ name: 'Promo web', memberIds: [menteeA.id, stranger.id] })
      .expect(422);
    expect(refused.body.code).toBe('GROUP_MEMBER_NOT_ELIGIBLE');
  });

  it('crée un groupe, notifie les membres et partage un fil commun', async () => {
    const created = await owner.agent
      .post(`${API}/groups`)
      .send({
        name: 'Promo développement web',
        description: 'Suivi collectif des projets web',
        memberIds: [menteeA.id, menteeB.id, colleague.id],
      })
      .expect(201);
    const groupId = created.body.id as string;
    expect(created.body.isOwner).toBe(true);
    expect(created.body.members).toHaveLength(4);
    expect(created.body.members[0]).toMatchObject({ id: owner.id, isOwner: true });

    const [notif] = (await menteeA.agent.get(`${API}/notifications`).expect(200)).body;
    expect(notif).toMatchObject({ type: 'GROUP_ADDED', link: `/messages?g=${groupId}` });

    // Fil commun : tout membre écrit, tous lisent.
    await owner.agent
      .post(`${API}/groups/${groupId}/messages`)
      .send({ content: 'Bienvenue à tous !' })
      .expect(201);
    await menteeB.agent
      .post(`${API}/groups/${groupId}/messages`)
      .send({ content: 'Merci, ravi d’être là.' })
      .expect(201);
    const thread = await colleague.agent.get(`${API}/groups/${groupId}/messages`).expect(200);
    expect(thread.body.map((m: { content: string }) => m.content)).toEqual([
      'Bienvenue à tous !',
      'Merci, ravi d’être là.',
    ]);
    expect(thread.body[0].sender).toMatchObject({ id: owner.id, firstName: 'Test' });

    // Non lus : comptés jusqu'à la lecture.
    const mine = (await menteeA.agent.get(`${API}/groups/me`).expect(200)).body;
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ id: groupId, unreadCount: 2, memberCount: 4, isOwner: false });
    expect((await menteeA.agent.get(`${API}/dashboard/me`).expect(200)).body.unreadMessages).toBe(
      2,
    );
    await menteeA.agent.post(`${API}/groups/${groupId}/read`).expect(200);
    expect((await menteeA.agent.get(`${API}/groups/me`).expect(200)).body[0].unreadCount).toBe(0);

    // Un tiers ne voit rien (404, l'existence du groupe n'est pas révélée).
    await stranger.agent.get(`${API}/groups/${groupId}`).expect(404);
    await stranger.agent.get(`${API}/groups/${groupId}/messages`).expect(404);
    await stranger.agent
      .post(`${API}/groups/${groupId}/messages`)
      .send({ content: 'Intrusion' })
      .expect(404);
  });

  it('réserve la gestion au responsable ; un membre peut partir', async () => {
    const created = await owner.agent
      .post(`${API}/groups`)
      .send({ name: 'Atelier portfolio', memberIds: [menteeA.id] })
      .expect(201);
    const groupId = created.body.id as string;

    // Un membre ne renomme pas, n'ajoute pas, ne retire personne, ne supprime pas.
    await menteeA.agent.patch(`${API}/groups/${groupId}`).send({ name: 'Piraté' }).expect(403);
    await menteeA.agent
      .post(`${API}/groups/${groupId}/members`)
      .send({ userIds: [menteeB.id] })
      .expect(403);
    await menteeA.agent.delete(`${API}/groups/${groupId}`).expect(403);

    // Le responsable ajoute, renomme, retire.
    const candidates = await owner.agent.get(`${API}/groups/${groupId}/candidates`).expect(200);
    expect(candidates.body.map((c: { id: string }) => c.id)).not.toContain(menteeA.id);
    await owner.agent
      .post(`${API}/groups/${groupId}/members`)
      .send({ userIds: [menteeB.id] })
      .expect(201);
    const renamed = await owner.agent
      .patch(`${API}/groups/${groupId}`)
      .send({ name: 'Atelier portfolio 2026', description: '' })
      .expect(200);
    expect(renamed.body).toMatchObject({ name: 'Atelier portfolio 2026', description: null });
    await owner.agent.delete(`${API}/groups/${groupId}/members/${menteeB.id}`).expect(204);
    await menteeB.agent.get(`${API}/groups/${groupId}/messages`).expect(404);

    // Départ volontaire ; le responsable ne peut pas partir.
    await menteeA.agent.delete(`${API}/groups/${groupId}/members/${menteeA.id}`).expect(204);
    await menteeA.agent.get(`${API}/groups/${groupId}`).expect(404);
    const leave = await owner.agent
      .delete(`${API}/groups/${groupId}/members/${owner.id}`)
      .expect(409);
    expect(leave.body.code).toBe('GROUP_OWNER_CANNOT_LEAVE');

    // Suppression : messages et membres disparaissent avec le groupe.
    await owner.agent.delete(`${API}/groups/${groupId}`).expect(204);
    expect(await prismaOf(app).groupMember.count({ where: { groupId } })).toBe(0);
  });

  it('montre la photo d’un membre aux autres membres du groupe', async () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    await menteeA.agent
      .put(`${API}/profile/me/avatar`)
      .set('Content-Type', 'image/jpeg')
      .send(jpeg)
      .expect(200);
    // colleague n'a aucun lien direct avec menteeA, sauf le groupe « Promo développement web ».
    await colleague.agent.get(`${API}/users/${menteeA.id}/avatar`).expect(200);
    await stranger.agent.get(`${API}/users/${menteeA.id}/avatar`).expect(404);
  });
});
