import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service.js';

export interface MailMessage {
  to: string;
  subject: string;
  /** Titre affiché en haut de l'email. */
  heading: string;
  /** Paragraphes (texte brut, échappé à l'envoi). */
  paragraphs: string[];
  action?: { label: string; url: string };
  /** Petite mention en bas (« vous n'êtes pas à l'origine de cette demande ? »). */
  footnote?: string;
}

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

/** Email simple et lisible sur téléphone : tableaux et styles en ligne (clients mail). */
export function renderMail(m: MailMessage): { html: string; text: string } {
  const p = m.paragraphs
    .map(
      (t) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1f2a24">${escapeHtml(t)}</p>`,
    )
    .join('');
  const button = m.action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 18px"><tr><td style="border-radius:999px;background:#c0502a"><a href="${escapeHtml(m.action.url)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px">${escapeHtml(m.action.label)}</a></td></tr></table>
<p style="margin:0 0 14px;font-size:12px;line-height:1.5;color:#6b756f">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br><a href="${escapeHtml(m.action.url)}" style="color:#a8401d;word-break:break-all">${escapeHtml(m.action.url)}</a></p>`
    : '';
  const foot = m.footnote
    ? `<p style="margin:18px 0 0;padding-top:14px;border-top:1px solid #ece6dc;font-size:12px;line-height:1.5;color:#6b756f">${escapeHtml(m.footnote)}</p>`
    : '';
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(m.subject)}</title></head>
<body style="margin:0;padding:0;background:#f7f3ec;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3ec;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
<tr><td style="padding:4px 4px 16px;font-size:20px;font-weight:700;color:#12342a;letter-spacing:-0.02em">Talents<span style="color:#c0502a">Connect</span></td></tr>
<tr><td style="background:#ffffff;border-radius:14px;padding:28px 26px;border:1px solid #ece6dc">
<h1 style="margin:0 0 16px;font-size:21px;line-height:1.3;color:#12342a">${escapeHtml(m.heading)}</h1>
${p}${button}${foot}
</td></tr>
<tr><td style="padding:16px 4px;font-size:12px;line-height:1.5;color:#8a948e">TalentsConnect · plateforme de mentorat · Conakry. Cet email vous est envoyé parce qu’une action a été faite sur votre compte.</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    m.heading,
    '',
    ...m.paragraphs,
    ...(m.action ? ['', `${m.action.label} : ${m.action.url}`] : []),
    ...(m.footnote ? ['', m.footnote] : []),
    '',
    '— TalentsConnect',
  ].join('\n');
  return { html, text };
}

/**
 * Envoi d'emails transactionnels (Resend). Sans clé : désactivé, la plateforme garde son
 * fonctionnement sans email (lien de réinitialisation remis par l'équipe). Ne lève jamais
 * d'exception : un échec d'envoi n'annule pas l'action principale.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger('Mail');

  constructor(private readonly config: AppConfigService) {}

  get enabled(): boolean {
    // Jamais d'envoi réel pendant les tests automatisés (ils simulent ce service).
    return this.config.get('RESEND_API_KEY').length > 0 && this.config.get('NODE_ENV') !== 'test';
  }

  /** Adresse publique du site, pour les liens des emails. */
  link(path: string): string {
    return `${this.config.get('PUBLIC_APP_URL')}${path}`;
  }

  async send(message: MailMessage): Promise<boolean> {
    if (!this.enabled) return false;
    const { html, text } = renderMail(message);
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        signal: AbortSignal.timeout(10_000),
        headers: {
          Authorization: `Bearer ${this.config.get('RESEND_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.config.get('MAIL_FROM'),
          to: [message.to],
          subject: message.subject,
          html,
          text,
        }),
      });
      if (!res.ok) {
        // Jamais l'adresse ni le contenu dans les journaux.
        this.logger.warn(`Email non envoyé (HTTP ${res.status})`);
        return false;
      }
      return true;
    } catch (error) {
      this.logger.warn(`Email non envoyé : ${(error as Error).name}`);
      return false;
    }
  }
}

@Global()
@Module({ providers: [MailService], exports: [MailService] })
export class MailModule {}
