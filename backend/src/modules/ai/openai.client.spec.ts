import { vi } from 'vitest';
import type { AppConfigService } from '../../config/app-config.service.js';
import { OpenAiClient } from './openai.client.js';

const request = { system: 's', user: 'u', schemaName: 'test', schema: {}, maxTokens: 10 };

function clientWith(key: string) {
  const values: Record<string, string> = {
    OPENAI_API_KEY: key,
    OPENAI_MODEL: 'modele-test',
    OPENAI_BASE_URL: 'https://fournisseur.test/v1',
  };
  return new OpenAiClient({ get: (k: string) => values[k] } as unknown as AppConfigService);
}

describe('client OpenAI', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('n’appelle rien sans clé', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const client = clientWith('');
    expect(client.enabled).toBe(false);
    expect(await client.completeJson(request)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envoie une requête à sortie structurée et lit le JSON renvoyé', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] })),
      );
    vi.stubGlobal('fetch', fetchMock);
    expect(await clientWith('cle').completeJson(request)).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://fournisseur.test/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer cle');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({ model: 'modele-test', store: false, max_completion_tokens: 10 });
  });

  it('renvoie null en cas d’erreur du fournisseur, de réseau ou de réponse illisible', async () => {
    const client = clientWith('cle');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    expect(await client.completeJson(request)).toBeNull();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('réseau')));
    expect(await client.completeJson(request)).toBeNull();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ choices: [{ message: { content: 'pas du json' } }] })),
        ),
    );
    expect(await client.completeJson(request)).toBeNull();
  });
});
