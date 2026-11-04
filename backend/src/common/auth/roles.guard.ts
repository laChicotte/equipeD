import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '../../generated/prisma/enums.js';
import { forbidden } from '../errors.js';
import { ROLES_KEY } from './decorators.js';
import type { AuthenticatedRequest } from './auth-user.js';

/** RBAC : vérifie le rôle déclaré par @Roles(). L'appartenance aux ressources est vérifiée dans les services. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user || !roles.includes(user.role)) {
      throw forbidden('ROLE_FORBIDDEN', "Votre rôle ne permet pas d'effectuer cette action.");
    }
    return true;
  }
}
