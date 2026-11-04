import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { AppConfigService } from '../../config/app-config.service.js';
import { forbidden } from '../errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Protection CSRF pour une authentification par cookie (en complément de SameSite=Lax) :
 * toute requête modifiante émise par un navigateur doit provenir d'une origine autorisée.
 * Les clients non navigateurs (sans Origin ni Sec-Fetch-Site) ne portent pas le cookie
 * d'un tiers et ne sont donc pas concernés par le CSRF.
 */
@Injectable()
export class OriginCheckMiddleware implements NestMiddleware {
  private readonly allowed: Set<string>;

  constructor(config: AppConfigService) {
    this.allowed = new Set(config.get('WEB_ORIGINS'));
  }

  use(req: Request, _res: Response, next: NextFunction): void {
    if (SAFE_METHODS.has(req.method)) return next();

    const origin = req.headers.origin;
    if (origin) {
      if (!this.allowed.has(origin)) {
        throw forbidden('ORIGIN_NOT_ALLOWED', 'Origine de la requête non autorisée.');
      }
      return next();
    }
    const fetchSite = req.headers['sec-fetch-site'];
    if (fetchSite === 'cross-site') {
      throw forbidden('ORIGIN_NOT_ALLOWED', 'Origine de la requête non autorisée.');
    }
    next();
  }
}
