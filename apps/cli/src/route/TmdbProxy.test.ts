import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { handleTmdbProxy } from './TmdbProxy';

describe('TmdbProxy', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    handleTmdbProxy(app);
    vi.restoreAllMocks();
  });

  it('returns 504 when upstream request times out', async () => {
    const timeoutError = new Error('Request timed out');
    timeoutError.name = 'TimeoutError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeoutError));

    const res = await app.request('http://localhost/tmdb/search/tv?query=Komi', {
      method: 'GET',
      headers: {
        'X-TMDB-Host': 'https://api.themoviedb.org',
        'X-TMDB-API-Key': 'test-key',
      },
    });

    expect(res.status).toBe(504);
    await expect(res.json()).resolves.toEqual({ error: 'TMDB upstream timeout' });
  });

  it('returns 413 when upstream content-length exceeds limit', async () => {
    const smallBody = JSON.stringify({ ok: true });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(smallBody, {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'content-length': String(10 * 1024 * 1024 + 1),
          },
        }),
      ),
    );

    const res = await app.request('http://localhost/tmdb/search/tv?query=Komi', {
      method: 'GET',
      headers: {
        'X-TMDB-Host': 'https://api.themoviedb.org',
        'X-TMDB-API-Key': 'test-key',
      },
    });

    expect(res.status).toBe(413);
    await expect(res.json()).resolves.toEqual({ error: 'Upstream TMDB response too large' });
  });

  it('returns 413 when upstream body bytes exceed limit without content-length', async () => {
    const tooLargeBody = new Uint8Array(10 * 1024 * 1024 + 1);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(tooLargeBody, {
          status: 200,
          headers: {
            'content-type': 'application/octet-stream',
          },
        }),
      ),
    );

    const res = await app.request('http://localhost/tmdb/search/tv?query=Komi', {
      method: 'GET',
      headers: {
        'X-TMDB-Host': 'https://api.themoviedb.org',
        'X-TMDB-API-Key': 'test-key',
      },
    });

    expect(res.status).toBe(413);
    await expect(res.json()).resolves.toEqual({ error: 'Upstream TMDB response too large' });
  });
});
