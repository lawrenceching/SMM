import { notifyUnauthorizedApiResponse } from './authSession';

const AUTH_TOKEN_STORAGE_KEY = 'auth-token';

function readTokenFromUrl(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const fromQuery = new URLSearchParams(window.location.search).get('token')?.trim();
  return fromQuery ? fromQuery : null;
}

function readTokenFromStorage(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const stored = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)?.trim();
    return stored ? stored : null;
  } catch {
    return null;
  }
}

export function initAuthTokenFromUrl(): void {
  const fromQuery = readTokenFromUrl();
  if (!fromQuery) {
    return;
  }
  saveAuthToken(fromQuery);
}

export function saveAuthToken(token: string): void {
  const trimmed = token.trim();
  if (!trimmed) {
    return;
  }
  try {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, trimmed);
  } catch {
    // ignore quota / private mode
  }
}

export function clearAuthToken(): void {
  try {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function getAuthToken(): string | null {
  const fromQuery = readTokenFromUrl();
  if (fromQuery) {
    return fromQuery;
  }
  return readTokenFromStorage();
}

export function buildAuthorizationHeader(token: string): string {
  return `Bearer ${token}`;
}

function resolveRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

function shouldAttachAuth(url: string): boolean {
  if (url.startsWith('/api/')) {
    return true;
  }
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin && parsed.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

export function installAuthenticatedFetch(): void {
  if (typeof window === 'undefined') {
    return;
  }
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = resolveRequestUrl(input);
    if (!shouldAttachAuth(url)) {
      return originalFetch(input, init);
    }

    return (async () => {
      const token = getAuthToken();
      if (!token) {
        const response = await originalFetch(input, init);
        notifyUnauthorizedApiResponse(response, url);
        return response;
      }

      const headers = new Headers(init?.headers);
      if (!headers.has('Authorization')) {
        headers.set('Authorization', buildAuthorizationHeader(token));
      }
      const response = await originalFetch(input, { ...init, headers });
      notifyUnauthorizedApiResponse(response, url);
      return response;
    })();
  };
}

export { AUTH_TOKEN_STORAGE_KEY };
