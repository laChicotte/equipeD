import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service.js';
import { AppConfigService } from '../../config/app-config.service.js';
import { IS_PUBLIC_KEY } from './decorators.js';
import { hashSessionToken } from './session-token.js';
import type { AuthenticatedRequest } from './auth-user.js';

/** Fréquence maximale de mise à jour de lastUsedAt (évite une écriture par requête). */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Garde global : toute route est protégée par défaut, sauf @Public().
 * Sur une route publique, la session est tout de même résolue si elle existe
 * (utile pour personnaliser la réponse), sans être exigée.
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token: unknown = req.cookies?.[this.config.get('SESSION_COOKIE_NAME')];

    if (typeof token === 'string' && token.length > 0 && token.length <= 128) {
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
      const now = new Date();
      if (
        session &&
        !session.revokedAt &&
        session.expiresAt > now &&
        session.user.status === 'ACTIVE'
      ) {
        const { status: _status, ...user } = session.user;
        req.user = { ...user, sessionId: session.id };
        if (now.getTime() - session.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
          await this.prisma.authSession.update({
            where: { id: session.id },
            data: { lastUsedAt: now },
          });
        }
      }
    }

    if (isPublic) return true;
    if (!req.user) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Authentification requise.',
      });
    }
    return true;
  }
}
