import type { AuthUser } from './auth/auth-user.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { Role } from '../generated/prisma/enums.js';

/** Membre de l'équipe de la plateforme : administrateur ou super-administrateur. */
export function isStaff(role: Role | undefined | null): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export type AuditAction =
  | 'USER_SUSPENDED'
  | 'USER_REACTIVATED'
  | 'ROLE_CHANGED'
  | 'MENTOR_MODERATED'
  | 'DOMAIN_CREATED'
  | 'DOMAIN_UPDATED'
  | 'CERTIFICATE_REVOKED'
  | 'RESOURCE_REMOVED'
  | 'OPPORTUNITY_ARCHIVED';

type AuditClient = Pick<Prisma.TransactionClient, 'auditLog'>;

/**
 * Trace une action de l'équipe. Le résumé décrit l'action, jamais un contenu privé
 * (aucun message de conversation, aucun mot de passe).
 */
export async function recordAudit(
  client: AuditClient,
  actor: Pick<AuthUser, 'id' | 'firstName' | 'lastName'>,
  entry: { action: AuditAction; targetType: string; targetId?: string | null; summary: string },
): Promise<void> {
  await client.auditLog.create({
    data: {
      actorId: actor.id,
      actorName: `${actor.firstName} ${actor.lastName}`.slice(0, 170),
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId ?? null,
      summary: entry.summary.slice(0, 300),
    },
  });
}
