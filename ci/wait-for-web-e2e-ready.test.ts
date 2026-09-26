import { describe, expect, test } from 'bun:test';
import { resolveWebReadyUrls } from './wait-for-web-e2e-ready.ts';

describe('resolveWebReadyUrls', () => {
  test('uses HTTP_PORT when set (web platform has no Vite)', () => {
    const prevVite = process.env.VITE_PORT;
    const prevHttp = process.env.HTTP_PORT;
    process.env.VITE_PORT = '8081';
    process.env.HTTP_PORT = '8082';
    try {
      expect(resolveWebReadyUrls()).toEqual({
        pageUrl: 'http://127.0.0.1:8082/',
        httpUrl: 'http://127.0.0.1:8082/api/hello',
      });
    } finally {
      if (prevVite === undefined) delete process.env.VITE_PORT;
      else process.env.VITE_PORT = prevVite;
      if (prevHttp === undefined) delete process.env.HTTP_PORT;
      else process.env.HTTP_PORT = prevHttp;
    }
  });

  test('defaults to HTTP 30000 for page and API', () => {
    const prevVite = process.env.VITE_PORT;
    const prevHttp = process.env.HTTP_PORT;
    delete process.env.VITE_PORT;
    delete process.env.HTTP_PORT;
    try {
      expect(resolveWebReadyUrls()).toEqual({
        pageUrl: 'http://127.0.0.1:30000/',
        httpUrl: 'http://127.0.0.1:30000/api/hello',
      });
    } finally {
      if (prevVite === undefined) delete process.env.VITE_PORT;
      else process.env.VITE_PORT = prevVite;
      if (prevHttp === undefined) delete process.env.HTTP_PORT;
      else process.env.HTTP_PORT = prevHttp;
    }
  });

  test('ignores VITE_PORT when resolving web ready URLs', () => {
    expect(
      resolveWebReadyUrls({ VITE_PORT: '8000', HTTP_PORT: '30000' }),
    ).toEqual({
      pageUrl: 'http://127.0.0.1:30000/',
      httpUrl: 'http://127.0.0.1:30000/api/hello',
    });
  });
});
