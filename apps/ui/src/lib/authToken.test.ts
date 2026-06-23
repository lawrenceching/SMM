import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  AUTH_TOKEN_STORAGE_KEY,
  buildAuthorizationHeader,
  getAuthToken,
  initAuthTokenFromUrl,
  installAuthenticatedFetch,
} from './authToken';

describe('authToken', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/');
    vi.restoreAllMocks();
  });

  it('persists URL token to localStorage', () => {
    window.history.replaceState({}, '', '/?token=from-query');
    initAuthTokenFromUrl();
    expect(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe('from-query');
    expect(getAuthToken()).toBe('from-query');
  });

  it('prefers URL token over localStorage', () => {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'stored');
    window.history.replaceState({}, '', '/?token=query-wins');
    expect(getAuthToken()).toBe('query-wins');
  });

  it('falls back to localStorage when URL has no token', () => {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'stored-only');
    expect(getAuthToken()).toBe('stored-only');
  });

  it('buildAuthorizationHeader formats Bearer token', () => {
    expect(buildAuthorizationHeader('abc')).toBe('Bearer abc');
  });
});

describe('installAuthenticatedFetch', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/?token=hook-token');
    initAuthTokenFromUrl();
    vi.restoreAllMocks();
  });

  it('adds Authorization for same-origin /api requests', async () => {
    const originalFetch = vi.fn(async () => new Response('ok'));
    vi.stubGlobal('fetch', originalFetch);
    installAuthenticatedFetch();

    await window.fetch('/api/hello', { method: 'POST' });

    expect(originalFetch).toHaveBeenCalledOnce();
    const [, init] = originalFetch.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer hook-token');
  });

  it('does not override existing Authorization header', async () => {
    const originalFetch = vi.fn(async () => new Response('ok'));
    vi.stubGlobal('fetch', originalFetch);
    installAuthenticatedFetch();

    await window.fetch('/api/hello', {
      headers: { Authorization: 'Bearer custom' },
    });

    const [, init] = originalFetch.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer custom');
  });
});
