import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { vi } from 'vitest';
import webpush from 'web-push';
import { PushService } from '../src/modules/push/push.module.js';
import {
  API,
  createApp,
  createMentee,
  createMentor,
  createMentorship,
  type TestUser,
} from './helpers.js';

// Paire de clés VAPID réservée aux tests (sans valeur ailleurs), posée avant le chargement
// de la configuration (vi.hoisted s'exécute avant les imports).
const keys = vi.hoisted(() => {
  const k = {
    publicKey:
      'BCUYqBapzStIgdi5McZDpYW8PgttZMOnJ82WSITA_4cyHTZJ_S5aReZn32e4T0HUp9Z0lF-iq9IYnFccDbiX4e8',
    privateKey: '5QNJ6lgoAzYkupq_JGCDfchoNpyyyzEQKo_JugKJ6go',
  };
  process.env.VAPID_PUBLIC_KEY = k.publicKey;
  process.env.VAPID_PRIVATE_KEY = k.privateKey;
  return k;
});

const fakeSubscription = (n: string) => ({
  endpoint: `https://push.example.test/sub-${n}`,
  keys: {
    p256dh:
      'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
    auth: 'tBHItJI5svbpez7KI4CCXg',
  },
});

describe('Notifications push (Web Push)', () => {
  let app: INestApplication;
  let mentor: TestUser;
  let mentee: TestUser;
  let mentorshipId: string;
  let sent: { endpoint: string; payload: { title: string; body?: string; url: string } }[];

  beforeAll(async () => {
    app = await createApp();
    [mentor, mentee] = await Promise.all([createMentor(app), createMentee(app)]);
    mentorshipId = await createMentorship(mentee, mentor);
  });
  beforeEach(() => {
    sent = [];
    // Envoi réel activé (désactivé par défaut en test) et service push simulé.
    Object.defineProperty(app.get(PushService), 'enabled', { value: true, configurable: true });
    vi.spyOn(webpush, 'sendNotification').mockImplementation(async (sub, body) => {
      sent.push({ endpoint: sub.endpoint, payload: JSON.parse(String(body)) });
      return { statusCode: 201, body: '', headers: {} };
    });
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await app.close();
  });

  it('publie la clé publique et refuse un abonnement anonyme', async () => {
    const res = await request(app.getHttpServer()).get(`${API}/push/config`).expect(200);
    expect(res.body).toEqual({ enabled: true, publicKey: keys.publicKey });
    await request(app.getHttpServer())
      .post(`${API}/push/subscriptions`)
      .set('Origin', 'http://localhost:3000')
      .send(fakeSubscription('anonyme'))
      .expect(401);
  });

  it('prévient le destinataire d’un message, puis plus rien après sa déconnexion', async () => {
    const sub = fakeSubscription(mentor.id);
    await mentor.agent.post(`${API}/push/subscriptions`).send(sub).expect(200);
    await mentor.agent
      .post(`${API}/push/subscriptions`)
      .send({ endpoint: 'http://pas-https.test', keys: sub.keys })
      .expect(422);

    await mentee.agent
      .post(`${API}/mentorships/${mentorshipId}/messages`)
      .send({ content: 'Bonjour, je suis disponible jeudi.' })
      .expect(201);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].endpoint).toBe(sub.endpoint);
    expect(sent[0].payload).toMatchObject({
      body: 'Bonjour, je suis disponible jeudi.',
      url: `/messages?c=${mentorshipId}`,
    });

    // L'expéditeur ne reçoit rien pour son propre message.
    expect(sent.every((s) => s.endpoint === sub.endpoint)).toBe(true);

    // Déconnexion de l'appareil : la session est révoquée, les envois s'arrêtent.
    await mentor.agent.post(`${API}/auth/logout`).expect(200);
    sent = [];
    await mentee.agent
      .post(`${API}/mentorships/${mentorshipId}/messages`)
      .send({ content: 'Vous êtes là ?' })
      .expect(201);
    await new Promise((r) => setTimeout(r, 300));
    expect(sent).toHaveLength(0);
  });

  it('supprime un abonnement expiré (410) et envoie aussi les notifications in-app', async () => {
    const sub = fakeSubscription(mentee.id);
    await mentee.agent.post(`${API}/push/subscriptions`).send(sub).expect(200);
    vi.spyOn(webpush, 'sendNotification').mockRejectedValue(
      Object.assign(new Error('Gone'), { statusCode: 410 }),
    );
    const push = app.get(PushService);
    await push.sendToUser(mentee.id, { title: 'Test' });
    await mentee.agent.delete(`${API}/push/subscriptions`).send({ endpoint: sub.endpoint });
    const again = await mentee.agent.post(`${API}/push/subscriptions`).send(sub).expect(200);
    expect(again.body.ok).toBe(true);
  });
});
