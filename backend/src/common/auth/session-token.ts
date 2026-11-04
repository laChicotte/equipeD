import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Jeton opaque de 256 bits, transmis uniquement dans un cookie HttpOnly. */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Seul ce hash (HMAC-SHA256 avec un secret serveur) est stocké en base. */
export function hashSessionToken(token: string, secret: string): string {
  return createHmac('sha256', secret).update(token).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
