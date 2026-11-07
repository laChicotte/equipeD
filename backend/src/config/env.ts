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
  /**
   * Proxys de confiance pour retrouver l'IP réelle (limites de débit) : `loopback` quand seul
   * Next.js est devant l'API, un nombre de sauts derrière un hébergeur (Render : 1).
   */
  TRUST_PROXY: string | number;
  /** Base des liens de visio générés à la confirmation (vide = désactivé). */
  MEETING_BASE_URL: string;
  /** Serveurs STUN pour les appels WebRTC (vide : candidats locaux seulement, suffisant sur un même réseau). */
  STUN_URLS: string[];
  /** Serveurs TURN (relais coturn) : indispensables derrière les NAT des réseaux mobiles. */
  TURN_URLS: string[];
  /** Secret partagé avec coturn (use-auth-secret) : identifiants TURN temporaires par utilisateur. */
  TURN_SECRET: string;
  /** Clé OpenAI (vide : l'assistance par IA est désactivée, tout le reste fonctionne). */
  OPENAI_API_KEY: string;
  OPENAI_MODEL: string;
  OPENAI_BASE_URL: string;
  /** Effort de raisonnement des modèles GPT-5 (ignoré par les autres modèles). */
  OPENAI_REASONING_EFFORT: string;
  /** Garde-fous de coût : nombre d'appels par personne et au total, par jour. */
  AI_USER_DAILY_LIMIT: number;
  AI_GLOBAL_DAILY_LIMIT: number;
  /** Questions à l'assistant par personne et par jour. */
  AI_ASSISTANT_DAILY_LIMIT: number;
  /**
   * Notifications push (Web Push) : clés VAPID du serveur. Vides : push désactivé, les
   * notifications restent visibles dans l'application.
   */
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  /** Contact du serveur pour les services push (mailto: ou https:). */
  VAPID_SUBJECT: string;
  /** Emails transactionnels (Resend). Vide : pas d'email, lien de réinitialisation remis par l'équipe. */
  RESEND_API_KEY: string;
  /** Expéditeur (domaine vérifié chez Resend). */
  MAIL_FROM: string;
  /**
   * Développement : URL de Mailpit (ex. http://127.0.0.1:8025). Les emails y sont capturés au
   * lieu de partir chez Resend. Ignorée en production.
   */
  MAILPIT_URL: string;
  /** Adresse publique du site, pour les liens des emails (défaut : première origine de WEB_ORIGINS). */
  PUBLIC_APP_URL: string;
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
  if (secret && secret.length < 32)
    errors.push('SESSION_SECRET doit contenir au moins 32 caractères');
  if (nodeEnv === 'production' && secret.startsWith('change-me')) {
    errors.push('SESSION_SECRET doit être remplacé en production');
  }

  const origins = str('WEB_ORIGINS', 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const meetingBase = (
    typeof raw.MEETING_BASE_URL === 'string' ? raw.MEETING_BASE_URL : 'https://meet.jit.si'
  )
    .trim()
    .replace(/\/+$/, '');
  if (meetingBase && !/^https:\/\/[^\s/]+/.test(meetingBase)) {
    errors.push('MEETING_BASE_URL doit être une URL https (ou vide pour désactiver)');
  }

  const list = (key: string) =>
    (typeof raw[key] === 'string' ? (raw[key] as string) : '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  const stunUrls = list('STUN_URLS');
  const turnUrls = list('TURN_URLS');
  for (const url of stunUrls) {
    if (!/^stuns?:/.test(url))
      errors.push(`STUN_URLS : « ${url} » doit commencer par stun: ou stuns:`);
  }
  for (const url of turnUrls) {
    if (!/^turns?:/.test(url))
      errors.push(`TURN_URLS : « ${url} » doit commencer par turn: ou turns:`);
  }
  const turnSecret = typeof raw.TURN_SECRET === 'string' ? raw.TURN_SECRET.trim() : '';
  if (turnUrls.length > 0 && turnSecret.length < 16) {
    errors.push('TURN_SECRET (16 caractères au moins) est obligatoire avec TURN_URLS');
  }

  const positive = (key: string, fallback: number) => {
    const value = Number(raw[key] ?? fallback);
    if (!Number.isInteger(value) || value <= 0) errors.push(`${key} doit être un entier positif`);
    return value;
  };
  const trustRaw = str('TRUST_PROXY', 'loopback');
  const trustProxy = /^\d+$/.test(trustRaw) ? Number(trustRaw) : trustRaw;

  const openAiBase = str('OPENAI_BASE_URL', 'https://api.openai.com/v1').replace(/\/+$/, '');
  if (!/^https?:\/\//.test(openAiBase)) errors.push('OPENAI_BASE_URL doit être une URL');

  const optional = (key: string) =>
    typeof raw[key] === 'string' ? (raw[key] as string).trim() : '';
  const vapidPublic = optional('VAPID_PUBLIC_KEY');
  const vapidPrivate = optional('VAPID_PRIVATE_KEY');
  if (!!vapidPublic !== !!vapidPrivate) {
    errors.push('VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY vont ensemble (ou aucune des deux)');
  }

  const mailpitUrl = nodeEnv === 'production' ? '' : optional('MAILPIT_URL').replace(/\/+$/, '');
  if (mailpitUrl && !/^https?:\/\//.test(mailpitUrl)) errors.push('MAILPIT_URL doit être une URL');

  const env: AppEnv = {
    NODE_ENV: nodeEnv as AppEnv['NODE_ENV'],
    PORT: port,
    DATABASE_URL: str('DATABASE_URL'),
    WEB_ORIGINS: origins,
    SESSION_COOKIE_NAME: str('SESSION_COOKIE_NAME', 'tc_session'),
    SESSION_TTL_HOURS: ttl,
    SESSION_SECRET: secret,
    SWAGGER_ENABLED: str('SWAGGER_ENABLED', nodeEnv === 'production' ? 'false' : 'true') === 'true',
    TRUST_PROXY: trustProxy,
    MEETING_BASE_URL: meetingBase,
    STUN_URLS: stunUrls,
    TURN_URLS: turnUrls,
    TURN_SECRET: turnSecret,
    OPENAI_API_KEY: typeof raw.OPENAI_API_KEY === 'string' ? raw.OPENAI_API_KEY.trim() : '',
    VAPID_PUBLIC_KEY: vapidPublic,
    VAPID_PRIVATE_KEY: vapidPrivate,
    VAPID_SUBJECT: str('VAPID_SUBJECT', 'mailto:contact@talentsconnect.test'),
    RESEND_API_KEY: optional('RESEND_API_KEY'),
    MAIL_FROM: str('MAIL_FROM', 'TalentsConnect <noreply@wistechnologie.com>'),
    MAILPIT_URL: mailpitUrl,
    PUBLIC_APP_URL: str('PUBLIC_APP_URL', origins[0] ?? 'http://localhost:3000').replace(
      /\/+$/,
      '',
    ),
    OPENAI_MODEL: str('OPENAI_MODEL', 'gpt-5.4-mini'),
    OPENAI_BASE_URL: openAiBase,
    OPENAI_REASONING_EFFORT: str('OPENAI_REASONING_EFFORT', 'low'),
    AI_USER_DAILY_LIMIT: positive('AI_USER_DAILY_LIMIT', 30),
    AI_GLOBAL_DAILY_LIMIT: positive('AI_GLOBAL_DAILY_LIMIT', 1000),
    AI_ASSISTANT_DAILY_LIMIT: positive('AI_ASSISTANT_DAILY_LIMIT', 60),
  };

  if (errors.length > 0) {
    throw new Error(`Configuration invalide :\n - ${errors.join('\n - ')}`);
  }
  return env;
}
