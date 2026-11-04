import type { ApiErrorBody } from './types';

/** Erreur structurée renvoyée par l'API NestJS (`{ statusCode, code, message, details? }`). */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: { field: string; messages: string[] }[];

  constructor(body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.statusCode = body.statusCode;
    this.code = body.code;
    this.details = body.details ?? [];
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

type Query = Record<string, string | number | boolean | null | undefined>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: Query): string {
  const url = `/api/v1${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

/** Appel typé vers l'API, via le rewrite Next.js (même origine, cookie HttpOnly géré par le navigateur). */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal } = options;
  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError({
      statusCode: 0,
      code: 'NETWORK_ERROR',
      message: 'Impossible de joindre le serveur. Vérifiez votre connexion puis réessayez.',
    });
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = undefined;
    }
  }

  if (!response.ok) {
    const body = data as Partial<ApiErrorBody> | undefined;
    throw new ApiError({
      statusCode: response.status,
      code: body?.code ?? 'UNKNOWN_ERROR',
      message:
        typeof body?.message === 'string'
          ? body.message
          : response.status >= 500
            ? 'Le serveur a rencontré une erreur. Réessayez dans un instant.'
            : 'La requête n’a pas pu aboutir.',
      details: body?.details,
    });
  }

  return data as T;
}

export function errorMessage(error: unknown): string {
  if (isApiError(error)) return error.message;
  return 'Une erreur inattendue est survenue.';
}
