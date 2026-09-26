import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { registerExecuteRoutes } from './execute';
import { readJson } from '../test/readJson';

vi.mock('../../tasks/GetSelectedMediaMetadataTask', () => ({
  executeGetSelectedMediaMetadataTask: vi.fn(async () => ({
    metadata: { id: 'movie-1' },
  })),
}));

function makeProxyManager(url: string | null) {
  return {
    url,
    start: async () => {},
    stop: async () => {},
  };
}

describe('/api/execute — orchestration route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes name="GetSelectedMediaMetadata" to its task handler', async () => {
    const app = new Hono();
    registerExecuteRoutes(app, makeProxyManager(null));
    const res = await app.request('/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'GetSelectedMediaMetadata' }),
    });
    expect(res.status).toBe(200);
    const body = await readJson<Record<string, unknown>>(res);
    expect(body).toEqual({ metadata: { id: 'movie-1' } });
  });

  it('returns 501 for unknown task names', async () => {
    const app = new Hono();
    registerExecuteRoutes(app, makeProxyManager(null));
    const res = await app.request('/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'system' }),
    });
    expect(res.status).toBe(501);
    const body = await readJson<Record<string, unknown>>(res);
    expect(body.error).toContain('"system" is not yet implemented');
  });

  it('returns 400 Zod error when name="hello" is sent (removed from enum)', async () => {
    const app = new Hono();
    registerExecuteRoutes(app, makeProxyManager(null));
    const res = await app.request('/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'hello' }),
    });
    expect(res.status).toBe(400);
    const body = await readJson<Record<string, unknown>>(res);
    expect(body.error).toBe('Validation failed');
    expect((body.details as Array<{ path: string; message: string }>)[0]!.path).toBe('name');
    expect((body.details as Array<{ path: string; message: string }>)[0]!.message).toContain('"system", "GetSelectedMediaMetadata"');
  });

  it('returns 400 Zod error when name is missing', async () => {
    const app = new Hono();
    registerExecuteRoutes(app, makeProxyManager(null));
    const res = await app.request('/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when request body is not valid JSON', async () => {
    const app = new Hono();
    registerExecuteRoutes(app, makeProxyManager(null));
    const res = await app.request('/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    expect(res.status).toBe(400);
    const body = await readJson<Record<string, unknown>>(res);
    expect(body.error).toBe('Invalid JSON body or parsing error');
  });

  it('does not register /api/hello (served by core-routes)', async () => {
    const app = new Hono();
    registerExecuteRoutes(app, makeProxyManager('http://127.0.0.1:30001'));
    const res = await app.request('/api/hello', { method: 'GET' });
    expect(res.status).toBe(404);
  });
});
