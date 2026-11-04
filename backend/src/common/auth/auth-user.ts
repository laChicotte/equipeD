import type { Request } from 'express';
import type { Role } from '../../generated/prisma/enums.js';

/** Représentation minimale et non sensible de l'utilisateur authentifié. */
export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  sessionId: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}
