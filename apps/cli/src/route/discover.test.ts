import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { handleDiscover, fetchDiscoveredMediaDatabases } from './discover';

function jsonResponse(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

describe('handleDiscover', () => {
  let mockFetch: ReturnType<typeof vi.spyOn>;
  let app: Hono;

  beforeEach(() => {
    mockFetch = vi.spyOn(globalThis, 'fetch');
    app = new Hono();
    handleDiscover(app);
  });

  afterEach(() => {
    mockFetch.mockRestore();
  });

  it('returns normalized mediaDatabases on success', async () => {
    mockFetch.mockImplementationOnce(() =>
      jsonResponse({
        mediaDatabases: [
          { type: 'tmdb', baseUrl: 'https://example.com/api/tmdb' },
          { type: 'tmdb', url: 'https://other.com/api/tmdb', authorizationMethod: 'date-token' },
          { type: 'tvdb', baseUrl: 'https://example.com/api/tvdb' },
        ],
      })
    );

    const res = await app.request('/api/discover');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.mediaDatabases).toEqual([
      { type: 'tmdb', url: 'https://example.com/api/tmdb', authorizationMethod: 'none' },
      { type: 'tmdb', url: 'https://other.com/api/tmdb', authorizationMethod: 'date-token' },
      { type: 'tvdb', url: 'https://example.com/api/tvdb', authorizationMethod: 'none' },
    ]);
  });

  it('returns empty array when remote fetch fails (non-OK)', async () => {
    mockFetch.mockImplementationOnce(() => jsonResponse('not found', 404));

    const res = await app.request('/api/discover');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.mediaDatabases).toEqual([]);
  });

  it('returns empty array when remote fetch throws', async () => {
    mockFetch.mockImplementationOnce(() => Promise.reject(new Error('network')));

    const res = await app.request('/api/discover');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.mediaDatabases).toEqual([]);
  });

  it('returns empty array when body is missing mediaDatabases', async () => {
    mockFetch.mockImplementationOnce(() => jsonResponse({ unrelated: true }));

    const res = await app.request('/api/discover');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.mediaDatabases).toEqual([]);
  });

  it('skips entries with missing or unknown type', async () => {
    mockFetch.mockImplementationOnce(() =>
      jsonResponse({
        mediaDatabases: [
          { type: 'unknown', url: 'https://x.com' },
          { type: 'tmdb' }, // no baseUrl/url
          { url: 'https://no-type.com' },
        ],
      })
    );

    const res = await app.request('/api/discover');
    const body = await res.json();
    expect(body.data.mediaDatabases).toEqual([]);
  });

  it('treats missing authorizationMethod as none', async () => {
    mockFetch.mockImplementationOnce(() =>
      jsonResponse({
        mediaDatabases: [{ type: 'tmdb', baseUrl: 'https://x.com/api' }],
      })
    );

    const res = await app.request('/api/discover');
    const body = await res.json();
    expect(body.data.mediaDatabases[0].authorizationMethod).toBe('none');
  });

  it('treats unknown authorizationMethod as none', async () => {
    mockFetch.mockImplementationOnce(() =>
      jsonResponse({
        mediaDatabases: [{ type: 'tmdb', baseUrl: 'https://x.com/api', authorizationMethod: 'gibberish' }],
      })
    );

    const res = await app.request('/api/discover');
    const body = await res.json();
    expect(body.data.mediaDatabases[0].authorizationMethod).toBe('none');
  });
});

describe('fetchDiscoveredMediaDatabases', () => {
  let mockFetch: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockFetch = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    mockFetch.mockRestore();
  });

  it('returns empty array on any error (does not throw)', async () => {
    mockFetch.mockImplementationOnce(() => Promise.reject(new Error('boom')));
    const result = await fetchDiscoveredMediaDatabases();
    expect(result).toEqual([]);
  });

  it('returns empty array when fetch rejects via signal abort', async () => {
    // The function has a 10s timeout, so we pass a matching test timeout
    // to make the abort fire before the test itself times out.
    mockFetch.mockImplementationOnce((_url, init) =>
      new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })
    );
    const result = await fetchDiscoveredMediaDatabases();
    expect(result).toEqual([]);
  }, 15_000);
});
