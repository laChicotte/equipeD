import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Erreur métier structurée : un code stable (exploitable par le frontend)
 * et un message lisible en français.
 */
export class DomainError extends HttpException {
  constructor(
    status: HttpStatus,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super({ code, message, details }, status);
  }
}

export const conflict = (code: string, message: string) =>
  new DomainError(HttpStatus.CONFLICT, code, message);
export const forbidden = (code: string, message: string) =>
  new DomainError(HttpStatus.FORBIDDEN, code, message);
export const notFound = (code: string, message: string) =>
  new DomainError(HttpStatus.NOT_FOUND, code, message);
export const unprocessable = (code: string, message: string, details?: unknown) =>
  new DomainError(HttpStatus.UNPROCESSABLE_ENTITY, code, message, details);

/**
 * Détecte une violation de contrainte PostgreSQL nommée (unicité ou exclusion),
 * quelle que soit la forme exacte de l'erreur remontée par Prisma/l'adaptateur pg.
 */
export function isConstraintViolation(error: unknown, constraintName?: string): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; message?: string; meta?: Record<string, unknown> };
  const serialized = `${e.message ?? ''} ${safeJson(e.meta)}`;
  const isViolation =
    e.code === 'P2002' ||
    e.code === 'P2004' ||
    serialized.includes('23P01') ||
    serialized.includes('23505') ||
    /exclusion constraint|unique constraint|duplicate key/i.test(serialized);
  if (!isViolation) return false;
  return constraintName ? serialized.includes(constraintName) || e.code === 'P2002' : true;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return '';
  }
}
