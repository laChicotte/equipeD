import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { WebSocket } from 'ws';
import {
  API,
  createApp,
  createMentee,
  createMentor,
  createMentorship,
  TEST_PASSWORD,
  type TestUser,
} from './helpers.js';

const ORIGIN = 'http://localhost:3000';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);

type Event = { type: string; [key: string]: unknown };

/** Client WebSocket de test : garde les événements reçus et permet d'en attendre un. */
class Socket {
  readonly events: Event[] = [];
  private waiters: { match: (e: Event) => boolean; resolve: (e: Event) => void }[] = [];
  constructor(readonly ws: WebSocket) {
    ws.on('message', (raw) => {
      const event = JSON.parse(raw.toString()) as Event;
      const waiter = this.waiters.find((w) => w.match(event));
      if (waiter) {
        this.waiters = this.waiters.filter((w) => w !== waiter);
        waiter.resolve(event);
      } else this.events.push(event);
    });
  }
  send(type: string, payload: object = {}) {
    this.ws.send(JSON.stringify({ type, ...payload }));
  }
  next(type: string, timeoutMs = 3000): Promise<Event> {
    const i = this.events.findIndex((e) => e.type === type);
    if (i >= 0) return Promise.resolve(this.events.splice(i, 1)[0]);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Événement ${type} non reçu`)), timeoutMs);
      this.waiters.push({
        match: (e) => e.type === type,
        resolve: (e) => {
          clearTimeout(timer);
          resolve(e);
        },
      });
    });
  }
  close() {
    this.ws.close();
  }
}

describe('Messagerie : pièces jointes et appels', () => {
  let app: INestApplication;
  let url: string;
  let mentor: TestUser;
  let mentee: TestUser;
  let intruder: TestUser;
  let mentorshipId: string;

  const cookieOf = async (user: TestUser) => {
    const res = await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ email: user.email, password: TEST_PASSWORD })
      .expect(200);
    const set = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    return set.map((c) => c.split(';')[0]).join('; ');
  };

  const connect = async (user: TestUser | null, origin = ORIGIN) => {
    const headers: Record<string, string> = { Origin: origin };
    if (user) headers.Cookie = await cookieOf(user);
    const ws = new WebSocket(url, { headers });
    return new Promise<Socket>((resolve, reject) => {
      ws.once('unexpected-response', (_req, res) => reject(new Error(String(res.statusCode))));
      ws.once('error', reject);
      const socket = new Socket(ws);
      void socket.next('ready').then(() => resolve(socket), reject);
    });
  };

  beforeAll(async () => {
    app = await createApp();
    const { port } = app.getHttpServer().address() as AddressInfo;
    url = `ws://127.0.0.1:${port}/api/v1/ws`;
    [mentor, mentee, intruder] = await Promise.all([
      createMentor(app),
      createMentee(app),
      createMentee(app),
    ]);
    mentorshipId = await createMentorship(mentee, mentor);
  });
  afterAll(async () => {
    await app.close();
  });

  describe('pièces jointes', () => {
    it('envoie un document dans une conversation privée, lisible des seuls participants', async () => {
      const sent = await mentee.agent
        .post(`${API}/mentorships/${mentorshipId}/messages/upload`)
        .field('content', 'Mon CV à relire')
        .attach('file', Buffer.from('%PDF-1.7\nCV\n%%EOF'), 'CV Aminata.pdf')
        .expect(201);
      expect(sent.body).toMatchObject({
        content: 'Mon CV à relire',
        file: { fileName: 'CV Aminata.pdf', mimeType: 'application/pdf' },
        call: null,
      });
      const list = await mentor.agent
        .get(`${API}/mentorships/${mentorshipId}/messages`)
        .expect(200);
      expect(list.body.at(-1).file.fileName).toBe('CV Aminata.pdf');

      const file = await mentor.agent.get(`${API}/messages/${sent.body.id}/file`).expect(200);
      expect(file.headers['content-disposition']).toMatch(/^attachment;/);
      await intruder.agent.get(`${API}/messages/${sent.body.id}/file`).expect(404);

      // Photo : légende facultative, affichable dans le fil (inline).
      const photo = await mentor.agent
        .post(`${API}/mentorships/${mentorshipId}/messages/upload`)
        .attach('file', PNG, 'tableau.png')
        .expect(201);
      expect(photo.body.content).toBe('');
      const inline = await mentee.agent
        .get(`${API}/messages/${photo.body.id}/file?inline=1`)
        .expect(200);
      expect(inline.headers['content-disposition']).toBe('inline');
      expect(inline.headers['content-type']).toBe('image/png');

      // Un tiers ne peut pas écrire ; un format interdit est refusé.
      await intruder.agent
        .post(`${API}/mentorships/${mentorshipId}/messages/upload`)
        .attach('file', PNG, 'x.png')
        .expect(403);
      const bad = await mentee.agent
        .post(`${API}/mentorships/${mentorshipId}/messages/upload`)
        .attach('file', Buffer.from('<svg onload=alert(1)>'), 'image.svg')
        .expect(422);
      expect(bad.body.code).toBe('FILE_INVALID_TYPE');
    });

    it('partage un fichier dans un groupe, réservé à ses membres', async () => {
      const group = await mentor.agent
        .post(`${API}/groups`)
        .send({ name: 'Groupe fichiers', memberIds: [mentee.id] })
        .expect(201);
      const sent = await mentee.agent
        .post(`${API}/groups/${group.body.id}/messages/upload`)
        .attach('file', Buffer.from('Nom;Score\nAminata;12\n'), 'notes.csv')
        .expect(201);
      expect(sent.body.file).toMatchObject({ fileName: 'notes.csv', mimeType: 'text/csv' });
      await mentor.agent.get(`${API}/groups/messages/${sent.body.id}/file`).expect(200);
      await intruder.agent.get(`${API}/groups/messages/${sent.body.id}/file`).expect(404);
    });
  });

  describe('canal temps réel', () => {
    it('refuse une connexion sans session ou depuis une origine inconnue', async () => {
      await expect(connect(null)).rejects.toThrow('401');
      await expect(connect(mentee, 'https://evil.example')).rejects.toThrow('403');
    });

    it('prévient en direct de l’arrivée d’un message', async () => {
      const socket = await connect(mentor);
      await mentee.agent
        .post(`${API}/mentorships/${mentorshipId}/messages`)
        .send({ content: 'Bonjour !' })
        .expect(201);
      expect(await socket.next('message:new')).toMatchObject({ mentorshipId });
      socket.close();
    });
  });

  describe('appels', () => {
    it('sonne, décroche, relaie la signalisation et inscrit l’appel dans la conversation', async () => {
      const caller = await connect(mentee);
      const callee = await connect(mentor);
      const spy = await connect(intruder);

      caller.send('call:invite', { mentorshipId, kind: 'VIDEO' });
      const ringing = await caller.next('call:ringing');
      const incoming = await callee.next('call:incoming');
      expect(incoming).toMatchObject({ callId: ringing.callId, kind: 'VIDEO', mentorshipId });
      expect((incoming.caller as { id: string }).id).toBe(mentee.id);

      // Pas de signalisation avant le décroché, ni par un tiers.
      caller.send('call:signal', { callId: ringing.callId, payload: { sdp: 'x' } });
      expect((await caller.next('error')).code).toBe('CALL_NOT_ANSWERED');
      spy.send('call:accept', { callId: ringing.callId });
      expect((await spy.next('error')).code).toBe('CALL_NOT_FOUND');

      callee.send('call:accept', { callId: ringing.callId });
      await caller.next('call:accepted');
      await callee.next('call:connected');

      const offer = { description: { type: 'offer', sdp: 'v=0' } };
      caller.send('call:signal', { callId: ringing.callId, payload: offer });
      expect((await callee.next('call:signal')).payload).toEqual(offer);
      callee.send('call:signal', { callId: ringing.callId, payload: { candidate: { c: 1 } } });
      expect((await caller.next('call:signal')).payload).toEqual({ candidate: { c: 1 } });

      // Un second appel pendant la communication est refusé.
      caller.send('call:invite', { mentorshipId, kind: 'AUDIO' });
      expect((await caller.next('error')).code).toBe('CALL_IN_PROGRESS');

      callee.send('call:hangup', { callId: ringing.callId });
      expect(await caller.next('call:ended')).toMatchObject({ reason: 'hangup' });
      await callee.next('call:ended');

      const list = await mentee.agent
        .get(`${API}/mentorships/${mentorshipId}/messages`)
        .expect(200);
      const last = list.body.at(-1);
      expect(last.content).toMatch(/^Appel vidéo · \d+ s$/);
      expect(last.call).toMatchObject({ kind: 'VIDEO', status: 'ENDED' });
      [caller, callee, spy].forEach((s) => s.close());
    });

    it('trace un appel refusé, et un appel manqué quand la personne n’est pas connectée', async () => {
      const caller = await connect(mentor);
      const callee = await connect(mentee);
      caller.send('call:invite', { mentorshipId, kind: 'AUDIO' });
      const { callId } = await callee.next('call:incoming');
      callee.send('call:decline', { callId });
      expect(await caller.next('call:ended')).toMatchObject({ callId, reason: 'declined' });
      callee.close();
      await new Promise((r) => setTimeout(r, 100));

      // La personne appelée n'est plus connectée : appel manqué, non lu de son côté.
      caller.send('call:invite', { mentorshipId, kind: 'AUDIO' });
      expect(await caller.next('call:ended')).toMatchObject({ reason: 'unavailable' });
      const list = await mentee.agent
        .get(`${API}/mentorships/${mentorshipId}/messages`)
        .expect(200);
      const [declined, missed] = list.body.slice(-2);
      expect(declined.content).toBe('Appel audio refusé');
      expect(missed).toMatchObject({ content: 'Appel audio manqué', readAt: null });
      const mine = (await mentee.agent.get(`${API}/mentorships/me`).expect(200)).body;
      expect(mine.find((m: { id: string }) => m.id === mentorshipId).unreadCount).toBeGreaterThan(
        0,
      );
      caller.close();
    });

    it('raccroche automatiquement si l’appelant se déconnecte pendant la sonnerie', async () => {
      const caller = await connect(mentee);
      const callee = await connect(mentor);
      caller.send('call:invite', { mentorshipId, kind: 'VIDEO' });
      const { callId } = await callee.next('call:incoming');
      caller.close();
      expect(await callee.next('call:ended')).toMatchObject({ callId, reason: 'disconnected' });
      callee.close();
    });

    it('fournit la configuration WebRTC aux personnes connectées', async () => {
      const res = await mentee.agent.get(`${API}/calls/config`).expect(200);
      expect(res.body).toMatchObject({ iceServers: expect.any(Array), ringTimeoutMs: 40_000 });
      await request(app.getHttpServer()).get(`${API}/calls/config`).expect(401);
    });
  });
});
