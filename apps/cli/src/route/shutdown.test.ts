import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import {
  isLocalhostShutdownRequest,
  isLoopbackAddress,
  registerGracefulShutdown,
  resetGracefulShutdownStateForTests,
  runGracefulShutdown,
} from '../utils/gracefulShutdown';
import { handleShutdown } from './shutdown';

describe('gracefulShutdown helpers', () => {
  it('accepts loopback addresses', () => {
    expect(isLoopbackAddress('127.0.0.1')).toBe(true);
    expect(isLoopbackAddress('::1')).toBe(true);
    expect(isLoopbackAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isLoopbackAddress('192.168.1.1')).toBe(false);
  });

  it('allows localhost shutdown requests', () => {
    const req = new Request('http://127.0.0.1:30000/api/shutdown', {
      method: 'POST',
      headers: { host: '127.0.0.1:30000' },
    });

    expect(
      isLocalhostShutdownRequest(req, () => ({ address: '127.0.0.1' })),
    ).toBe(true);
  });

  it('rejects non-localhost host headers', () => {
    const req = new Request('http://example.com/api/shutdown', {
      method: 'POST',
      headers: { host: 'example.com' },
    });

    expect(isLocalhostShutdownRequest(req)).toBe(false);
  });

  it('rejects non-loopback client addresses', () => {
    const req = new Request('http://127.0.0.1:30000/api/shutdown', {
      method: 'POST',
      headers: { host: '127.0.0.1:30000' },
    });

    expect(
      isLocalhostShutdownRequest(req, () => ({ address: '10.0.0.5' })),
    ).toBe(false);
  });
});

describe('POST /api/shutdown', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetGracefulShutdownStateForTests();
    vi.clearAllMocks();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      // no-op
    }) as typeof process.exit);
  });

  afterEach(() => {
    exitSpy.mockRestore();
  });

  it('returns 403 for non-localhost requests', async () => {
    const app = new Hono();
    handleShutdown(app);

    const res = await app.request('http://evil.test/api/shutdown', {
      method: 'POST',
      headers: { host: 'evil.test' },
    });

    expect(res.status).toBe(403);
  });

  it('runs stopServer and returns ok for localhost requests', async () => {
    const stopServer = vi.fn(async () => undefined);
    registerGracefulShutdown({ stopServer });

    const app = new Hono();
    handleShutdown(app);

    const res = await app.request('http://127.0.0.1:30000/api/shutdown', {
      method: 'POST',
      headers: { host: '127.0.0.1:30000' },
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      alreadyShuttingDown: false,
    });
    expect(stopServer).toHaveBeenCalledTimes(1);

    await new Promise((resolve) => setImmediate(resolve));
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('is idempotent when shutdown is already in progress', async () => {
    const stopServer = vi.fn(async () => undefined);
    registerGracefulShutdown({ stopServer });

    await runGracefulShutdown();

    const app = new Hono();
    handleShutdown(app);

    const res = await app.request('http://127.0.0.1:30000/api/shutdown', {
      method: 'POST',
      headers: { host: '127.0.0.1:30000' },
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      alreadyShuttingDown: true,
    });
    expect(stopServer).toHaveBeenCalledTimes(1);

    await new Promise((resolve) => setImmediate(resolve));
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
