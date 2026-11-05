import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service.js';

const TIMEOUT_MS = 30_000;

export interface JsonCompletion {
  /** Consignes du système (jamais de donnée utilisateur). */
  system: string;
  /** Données à traiter, sérialisées : le modèle doit les traiter comme des données. */
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  /** Longueur maximale de la réponse visible (le raisonnement éventuel s'y ajoute). */
  maxTokens: number;
}

export interface CompletionResult {
  data: unknown;
  ms: number;
  status: number | 'network' | 'disabled';
  usage?: { input: number; output: number; reasoning: number };
}

/** Les modèles qui raisonnent (GPT-5, o-series) consomment des jetons avant de répondre. */
const isReasoningModel = (model: string) => /^(gpt-5|gpt-6|o\d)/.test(model);

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
    return (await this.complete(request)).data;
  }

  /** Même appel, avec la durée et la consommation (banc d'évaluation, journaux). */
  async complete(request: JsonCompletion): Promise<CompletionResult> {
    const first = await this.attempt(request);
    // Limite de débit du compte (beaucoup d'utilisateurs en même temps) : une seconde chance.
    if (first.status !== 429) return first;
    await new Promise((r) => setTimeout(r, 1_500));
    return this.attempt(request);
  }

  private async attempt(request: JsonCompletion): Promise<CompletionResult> {
    const started = Date.now();
    const done = (rest: Omit<CompletionResult, 'ms'>): CompletionResult => ({
      ...rest,
      ms: Date.now() - started,
    });
    if (!this.enabled) return done({ data: null, status: 'disabled' });

    const model = this.config.get('OPENAI_MODEL');
    const reasoning = isReasoningModel(model);
    try {
      const response = await fetch(`${this.config.get('OPENAI_BASE_URL')}/chat/completions`, {
        method: 'POST',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.get('OPENAI_API_KEY')}`,
        },
        body: JSON.stringify({
          model,
          // Pas de conservation côté fournisseur pour réutilisation dans son tableau de bord.
          store: false,
          ...(reasoning
            ? {
                reasoning_effort: this.config.get('OPENAI_REASONING_EFFORT'),
                max_completion_tokens: request.maxTokens + 4_000,
              }
            : { max_completion_tokens: request.maxTokens, temperature: 0.3 }),
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
        return done({ data: null, status: response.status });
      }
      const body = (await response.json()) as {
        choices?: { message?: { content?: string | null } }[];
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          completion_tokens_details?: { reasoning_tokens?: number };
        };
      };
      const content = body.choices?.[0]?.message?.content;
      const usage = {
        input: body.usage?.prompt_tokens ?? 0,
        output: body.usage?.completion_tokens ?? 0,
        reasoning: body.usage?.completion_tokens_details?.reasoning_tokens ?? 0,
      };
      let data: unknown = null;
      try {
        data = content ? (JSON.parse(content) as unknown) : null;
      } catch {
        this.logger.warn(`Réponse illisible (${request.schemaName})`);
      }
      return done({ data, status: response.status, usage });
    } catch (error) {
      const cause = (error as Error & { cause?: { code?: string } }).cause?.code;
      this.logger.warn(
        `Appel impossible (${request.schemaName}) : ${(error as Error).name}${cause ? ` (${cause})` : ''}`,
      );
      return done({ data: null, status: 'network' });
    }
  }
}
