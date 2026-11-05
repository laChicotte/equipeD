import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { WebSocket, WebSocketServer } from 'ws';
import { PrismaService } from '../../database/prisma.service.js';
import { AppConfigService } from '../../config/app-config.service.js';
import { hashSessionToken } from '../../common/auth/session-token.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { DomainError } from '../../common/errors.js';

/** Chemin du canal temps réel (relayé par le rewrite Next.js /api/v1/*). */
export const REALTIME_PATH = '/api/v1/ws';
/** Taille maximale d'un message entrant : la signalisation WebRTC (SDP) tient en quelques Ko. */
const MAX_PAYLOAD = 64 * 1024;
const HEARTBEAT_MS = 25_000;

export interface RealtimeClient {
  id: string;
  user: AuthUser;
  socket: WebSocket;
  alive: boolean;
}

export type RealtimeHandler = (client: RealtimeClient, data: unknown) => Promise<void> | void;

/** Analyse minimale de l'en-tête Cookie (seul le cookie de session nous intéresse). */
function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

/**
 * Canal temps réel (WebSocket) : signalisation des appels et nouveaux messages.
 *
 * Sécurité :
 *  - authentification par le cookie de session HttpOnly (même vérification que l'API REST) ;
 *  - en-tête Origin obligatoire et autorisé (WEB_ORIGINS) : pas de détournement inter-sites ;
 *  - messages JSON de 64 Ko au plus ; connexions fermées à la déconnexion de la session.
 *
 * L'état est en mémoire : une seule instance de l'API (suffisant pour le pilote).
 */
@Injectable()
export class RealtimeService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('Realtime');
  private readonly wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD });
  private readonly clients = new Map<string, Set<RealtimeClient>>();
  private readonly handlers = new Map<string, RealtimeHandler>();
  private readonly disconnectHandlers: ((client: RealtimeClient) => void)[] = [];
  private heartbeat?: NodeJS.Timeout;
  private server?: Server;
  private readonly onUpgrade = (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    void this.handleUpgrade(req, socket, head);
  };

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  onApplicationBootstrap() {
    this.server = this.adapterHost.httpAdapter.getHttpServer() as Server;
    this.server.on('upgrade', this.onUpgrade);
    this.heartbeat = setInterval(() => this.ping(), HEARTBEAT_MS);
    this.heartbeat.unref();
  }

  onModuleDestroy() {
    clearInterval(this.heartbeat);
    this.server?.off('upgrade', this.onUpgrade);
    for (const set of this.clients.values()) for (const c of set) c.socket.terminate();
    this.wss.close();
  }

  // ─── API pour les autres modules ─────────────────────────────────────────

  on(type: string, handler: RealtimeHandler) {
    this.handlers.set(type, handler);
  }

  onDisconnect(handler: (client: RealtimeClient) => void) {
    this.disconnectHandlers.push(handler);
  }

  isOnline(userId: string) {
    return (this.clients.get(userId)?.size ?? 0) > 0;
  }

  send(client: RealtimeClient, type: string, payload: object = {}) {
    if (client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(JSON.stringify({ type, ...payload }));
    }
  }

  emitToUser(userId: string, type: string, payload: object = {}, exceptClientId?: string) {
    for (const client of this.clients.get(userId) ?? []) {
      if (client.id !== exceptClientId) this.send(client, type, payload);
    }
  }

  emitToUsers(userIds: Iterable<string>, type: string, payload: object = {}) {
    for (const id of new Set(userIds)) this.emitToUser(id, type, payload);
  }

  findClient(userId: string, clientId: string | undefined) {
    if (!clientId) return undefined;
    for (const c of this.clients.get(userId) ?? []) if (c.id === clientId) return c;
    return undefined;
  }

  /** Ferme les connexions dont la session vient d'être révoquée (déconnexion, mot de passe changé). */
  disconnectWhere(predicate: (user: AuthUser) => boolean) {
    for (const set of this.clients.values()) {
      for (const c of set) if (predicate(c.user)) c.socket.close(4001, 'session-revoked');
    }
  }

  // ─── Connexion ───────────────────────────────────────────────────────────

  private reject(socket: Duplex, status: number, text: string) {
    socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    socket.destroy();
  }

  private async handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
    const path = (req.url ?? '').split('?')[0];
    if (path !== REALTIME_PATH) return; // autre chemin : laissé aux autres gestionnaires
    socket.on('error', () => socket.destroy());

    const origin = req.headers.origin;
    if (!origin || !this.config.get('WEB_ORIGINS').includes(origin)) {
      return this.reject(socket, 403, 'Forbidden');
    }
    const user = await this.authenticate(req).catch(() => null);
    if (!user) return this.reject(socket, 401, 'Unauthorized');

    this.wss.handleUpgrade(req, socket, head, (ws) => this.register(ws, user));
  }

  private async authenticate(req: IncomingMessage): Promise<AuthUser | null> {
    const token = readCookie(req.headers.cookie, this.config.get('SESSION_COOKIE_NAME'));
    if (!token || token.length > 128) return null;
    const session = await this.prisma.authSession.findUnique({
      where: { tokenHash: hashSessionToken(token, this.config.get('SESSION_SECRET')) },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            firstName: true,
            lastName: true,
            status: true,
          },
        },
      },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) return null;
    if (session.user.status !== 'ACTIVE') return null;
    const { status: _status, ...user } = session.user;
    return { ...user, sessionId: session.id };
  }

  private register(socket: WebSocket, user: AuthUser) {
    const client: RealtimeClient = { id: randomUUID(), user, socket, alive: true };
    const set = this.clients.get(user.id) ?? new Set();
    set.add(client);
    this.clients.set(user.id, set);

    socket.on('pong', () => {
      client.alive = true;
    });
    socket.on('message', (raw, isBinary) => {
      if (isBinary) return;
      void this.dispatch(client, raw.toString());
    });
    socket.on('close', () => {
      set.delete(client);
      if (set.size === 0) this.clients.delete(user.id);
      for (const handler of this.disconnectHandlers) handler(client);
    });
    socket.on('error', () => socket.terminate());
    this.send(client, 'ready', { clientId: client.id });
  }

  private async dispatch(client: RealtimeClient, raw: string) {
    let message: { type?: unknown; requestId?: unknown };
    try {
      message = JSON.parse(raw) as typeof message;
    } catch {
      return this.send(client, 'error', { code: 'INVALID_MESSAGE', message: 'Message illisible.' });
    }
    const handler = typeof message.type === 'string' ? this.handlers.get(message.type) : undefined;
    if (!handler) {
      return this.send(client, 'error', { code: 'UNKNOWN_EVENT', message: 'Événement inconnu.' });
    }
    try {
      await handler(client, message);
    } catch (error) {
      if (error instanceof DomainError) {
        const body = error.getResponse() as { code: string; message: string };
        this.send(client, 'error', { code: body.code, message: body.message, event: message.type });
      } else {
        this.logger.error(`Événement ${String(message.type)} : ${(error as Error).message}`);
        this.send(client, 'error', {
          code: 'INTERNAL_ERROR',
          message: 'Une erreur inattendue est survenue.',
          event: message.type,
        });
      }
    }
  }

  private ping() {
    for (const set of this.clients.values()) {
      for (const client of set) {
        if (!client.alive) {
          client.socket.terminate();
          continue;
        }
        client.alive = false;
        client.socket.ping();
      }
    }
  }
}
