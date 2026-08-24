import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { registerExecuteRoutes } from './execute';
import { readJson } from '../test/readJson';

vi.mock('../cli/helloHttp', () => ({
  buildHelloHttpResponse: vi.fn(
    (reverseProxyUrl: string | null, coreRoutesPort: number) => ({
      uptime: 1.5,
      version: '1.2.3-test',
      platform: 'win32',
      userDataDir: '/tmp/userData',
      appDataDir: '/tmp/appData',
      logDir: '/tmp/logs',
      tmpDir: '/tmp',
      osLocale: 'en-US',
      reverseProxyUrl,
      coreRoutesPort,
    }),
  ),
}));

vi.mock('@/coreRoutesPort', () => ({
  resolveCoreRoutesPort: vi.fn(() => 3001),
}));

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

describe('/api/hello — bootstrap handshake', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the HelloHttpResponseBody with the current proxyManager.url', async () => {
    const app = new Hono();
    registerExecuteRoutes(app, makeProxyManager('http://127.0.0.1:30001'));
    const res = await app.request('/api/hello', { method: 'GET' });
    expect(res.status).toBe(200);
    const body = await readJson<Record<string, unknown>>(res);
    expect(body).toMatchObject({
      uptime: 1.5,
      version: '1.2.3-test',
      userDataDir: '/tmp/userData',
      appDataDir: '/tmp/appData',
      logDir: '/tmp/logs',
      tmpDir: '/tmp',
      reverseProxyUrl: 'http://127.0.0.1:30001',
      coreRoutesPort: 3001,
      osLocale: 'en-US',
    });
  });

  it('forwards null reverseProxyUrl when the proxy is not yet available', async () => {
    const app = new Hono();
    registerExecuteRoutes(app, makeProxyManager(null));
    const res = await app.request('/api/hello', { method: 'GET' });
    expect(res.status).toBe(200);
    const body = await readJson<Record<string, unknown>>(res);
    expect(body.reverseProxyUrl).toBeNull();
  });

  it('returns 404 for POST (method not allowed via notFound)', async () => {
    const app = new Hono();
    registerExecuteRoutes(app, makeProxyManager(null));
    const res = await app.request('/api/hello', { method: 'POST' });
    expect(res.status).toBe(404);
  });
});

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
});
