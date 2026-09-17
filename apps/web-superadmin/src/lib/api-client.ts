const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1'
).replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
  /** No adjunta Authorization ni intenta refrescar en un 401 (login, refresh, accept-invitation). */
  skipAuth?: boolean;
}

type TokenGetter = () => string | null;
type UnauthorizedHandler = () => Promise<string | null>;

let getAccessToken: TokenGetter = () => null;
let handleUnauthorized: UnauthorizedHandler = async () => null;

/** Lo llama AuthProvider una vez al montar, para inyectar el estado de sesion sin un import circular. */
export function configureApiClient(config: {
  getAccessToken: TokenGetter;
  onUnauthorized: UnauthorizedHandler;
}): void {
  getAccessToken = config.getAccessToken;
  handleUnauthorized = config.onUnauthorized;
}

function buildUrl(path: string, query?: Query): string {
  const url = new URL(API_BASE_URL + path);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

function extractMessage(status: number, data: unknown): string {
  if (data && typeof data === 'object' && 'message' in data) {
    const message = (data as { message: unknown }).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join(', ');
  }
  return `Error ${status}`;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
  allowRetry = true,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!options.skipAuth) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(buildUrl(path, options.query), {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401 && !options.skipAuth && allowRetry) {
    const newToken = await handleUnauthorized();
    if (newToken) return request<T>(path, options, false);
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const data: unknown = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    throw new ApiError(response.status, extractMessage(response.status, data), data);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>(path, { method: 'GET', query }),
  post: <T>(path: string, body?: unknown, options?: Partial<RequestOptions>) =>
    request<T>(path, { method: 'POST', body, ...options }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
};
