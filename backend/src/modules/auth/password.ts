import argon2 from 'argon2';

/** Paramètres Argon2id (recommandations OWASP : m=19 MiB, t=2, p=1). */
const OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;
/** Hash factice pour égaliser le temps de réponse lorsqu'un email est inconnu. */
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword('timing-equalization-placeholder-0');
  return dummyHash;
}
