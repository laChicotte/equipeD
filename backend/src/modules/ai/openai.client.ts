import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service.js';

const TIMEOUT_MS = 25_000;

export interface JsonCompletion {
  /** Consignes du système (jamais de donnée utilisateur). */
  system: string;
  /** Données à traiter, sérialisées : le modèle doit les traiter comme des données. */
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  maxTokens: number;
}

/** Appel sortant vers OpenAI : la clé reste côté serveur, le navigateur ne parle qu'à l'API. */
@Injectable()
export class OpenAiClient {
  private readonly logger = new Logger('OpenAI');

  constructor(private readonly config: AppConfigService) {}

  get enabled(): boolean {
    return this.config.get('OPENAI_API_KEY').length > 0;
  }

  /** Renvoie le JSON produit par le modèle, ou null en cas d'échec (l'appelant a une solution de repli). */
  async completeJson(request: JsonCompletion): Promise<unknown> {
    if (!this.enabled) return null;
    try {
      const response = await fetch(`${this.config.get('OPENAI_BASE_URL')}/chat/completions`, {
        method: 'POST',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.get('OPENAI_API_KEY')}`,
        },
        body: JSON.stringify({
          model: this.config.get('OPENAI_MODEL'),
          // Pas de conservation côté fournisseur pour réutilisation dans son tableau de bord.
          store: false,
          max_completion_tokens: request.maxTokens,
          messages: [
            { role: 'system', content: request.system },
            { role: 'user', content: request.user },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: { name: request.schemaName, strict: true, schema: request.schema },
          },
        }),
      });
      if (!response.ok) {
        // Jamais le contenu de la requête ni la clé dans les journaux.
        this.logger.warn(`Réponse ${response.status} du fournisseur (${request.schemaName})`);
        return null;
      }
      const body = (await response.json()) as {
        choices?: { message?: { content?: string | null } }[];
      };
      const content = body.choices?.[0]?.message?.content;
      return content ? (JSON.parse(content) as unknown) : null;
    } catch (error) {
      this.logger.warn(`Appel impossible (${request.schemaName}) : ${(error as Error).name}`);
      return null;
    }
  }
}
