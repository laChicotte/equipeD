/**
 * Validation stricte des variables d'environnement au démarrage.
 * L'API refuse de démarrer si une variable obligatoire est absente ou invalide.
 */
export interface AppEnv {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  DATABASE_URL: string;
  WEB_ORIGINS: string[];
  SESSION_COOKIE_NAME: string;
  SESSION_TTL_HOURS: number;
  SESSION_SECRET: string;
  SWAGGER_ENABLED: boolean;
}

export function validateEnv(raw: Record<string, unknown>): AppEnv {
  const errors: string[] = [];
  const str = (key: string, fallback?: string): string => {
    const value = raw[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
    if (fallback !== undefined) return fallback;
    errors.push(`${key} est obligatoire`);
    return '';
  };

  const nodeEnv = str('NODE_ENV', 'development');
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    errors.push('NODE_ENV doit valoir development, test ou production');
  }

  const port = Number(str('PORT', '4000'));
  if (!Number.isInteger(port) || port <= 0) errors.push('PORT doit être un entier positif');

  const ttl = Number(str('SESSION_TTL_HOURS', '168'));
  if (!Number.isFinite(ttl) || ttl <= 0) errors.push('SESSION_TTL_HOURS doit être positif');

  const secret = str('SESSION_SECRET');
  if (secret && secret.length < 32) errors.push('SESSION_SECRET doit contenir au moins 32 caractères');
  if (nodeEnv === 'production' && secret.startsWith('change-me')) {
    errors.push('SESSION_SECRET doit être remplacé en production');
  }

  const origins = str('WEB_ORIGINS', 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const env: AppEnv = {
    NODE_ENV: nodeEnv as AppEnv['NODE_ENV'],
    PORT: port,
    DATABASE_URL: str('DATABASE_URL'),
    WEB_ORIGINS: origins,
    SESSION_COOKIE_NAME: str('SESSION_COOKIE_NAME', 'tc_session'),
    SESSION_TTL_HOURS: ttl,
    SESSION_SECRET: secret,
    SWAGGER_ENABLED: str('SWAGGER_ENABLED', nodeEnv === 'production' ? 'false' : 'true') === 'true',
  };

  if (errors.length > 0) {
    throw new Error(`Configuration invalide :\n - ${errors.join('\n - ')}`);
  }
  return env;
}
