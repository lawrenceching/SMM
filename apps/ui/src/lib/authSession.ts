import { clearAuthToken } from '@/lib/authToken';

function isApiRequestUrl(url: string): boolean {
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

let loginRequired = false;
const listeners = new Set<() => void>();

let suppress401Count = 0;

export function subscribeAuthLoginRequired(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function getAuthLoginRequired(): boolean {
  return loginRequired;
}

export function setAuthLoginRequired(required: boolean): void {
  if (loginRequired === required) {
    return;
  }
  loginRequired = required;
  for (const listener of listeners) {
    listener();
  }
}

export async function with401Suppressed<T>(fn: () => Promise<T>): Promise<T> {
  suppress401Count += 1;
  try {
    return await fn();
  } finally {
    suppress401Count -= 1;
  }
}

export function notifyUnauthorizedApiResponse(response: Response, url: string): void {
  if (suppress401Count > 0) {
    return;
  }
  if (response.status !== 401) {
    return;
  }
  if (!isApiRequestUrl(url)) {
    return;
  }
  clearAuthToken();
  setAuthLoginRequired(true);
}
