import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ThrottlerException } from '@nestjs/throttler';

/** Forme unique et prévisible de toutes les erreurs de l'API. */
export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  path: string;
  timestamp: string;
}

const DEFAULT_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  422: 'VALIDATION_FAILED',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_ERROR',
};

const DEFAULT_MESSAGES: Record<number, string> = {
  401: 'Authentification requise.',
  403: 'Accès refusé.',
  404: 'Ressource introuvable.',
  413: 'Le fichier envoyé est trop volumineux.',
  429: 'Trop de tentatives. Réessayez dans quelques instants.',
  500: 'Une erreur inattendue est survenue.',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = DEFAULT_CODES[500];
    let message = DEFAULT_MESSAGES[500];
    let details: unknown;

    if (exception instanceof ThrottlerException) {
      status = HttpStatus.TOO_MANY_REQUESTS;
      code = DEFAULT_CODES[429];
      message = DEFAULT_MESSAGES[429];
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = DEFAULT_CODES[status] ?? 'ERROR';
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const b = body as { code?: string; message?: unknown; details?: unknown };
        if (typeof b.code === 'string') code = b.code;
        if (typeof b.message === 'string') message = b.message;
        else if (Array.isArray(b.message)) message = b.message.join(' ');
        details = b.details;
      }
      if (
        !message ||
        /^(Unauthorized|Forbidden|Not Found|Forbidden resource|File too large|Payload Too Large)/i.test(
          message,
        )
      ) {
        message = DEFAULT_MESSAGES[status] ?? message;
      }
    } else {
      // Jamais de stack ni de contenu métier dans la réponse ; uniquement dans les logs serveur.
      const err = exception as Error;
      this.logger.error(
        `${req.method} ${req.path} → ${err?.name ?? 'Error'}: ${err?.message}`,
        err?.stack,
      );
    }

    const payload: ApiErrorBody = {
      statusCode: status,
      code,
      message,
      ...(details !== undefined ? { details } : {}),
      path: req.path,
      timestamp: new Date().toISOString(),
    };
    res.status(status).json(payload);
  }
}
