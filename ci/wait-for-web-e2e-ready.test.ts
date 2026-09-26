import { describe, expect, test } from 'bun:test';
import { readUiDevServerPort } from './read-ui-dev-port.ts';
import { resolveWebReadyUrls } from './wait-for-web-e2e-ready.ts';

describe('resolveWebReadyUrls', () => {
  test('uses VITE_PORT and HTTP_PORT when set', () => {
    const prevVite = process.env.VITE_PORT;
    const prevHttp = process.env.HTTP_PORT;
    process.env.VITE_PORT = '8081';
    process.env.HTTP_PORT = '8082';
    try {
      expect(resolveWebReadyUrls()).toEqual({
        viteUrl: 'http://127.0.0.1:8081/',
        httpUrl: 'http://127.0.0.1:8082/api/hello',
      });
    } finally {
      if (prevVite === undefined) delete process.env.VITE_PORT;
      else process.env.VITE_PORT = prevVite;
      if (prevHttp === undefined) delete process.env.HTTP_PORT;
      else process.env.HTTP_PORT = prevHttp;
    }
  });

  test('defaults to the Vite dev port and HTTP 30000', () => {
    const prevVite = process.env.VITE_PORT;
    const prevHttp = process.env.HTTP_PORT;
    delete process.env.VITE_PORT;
    delete process.env.HTTP_PORT;
    try {
      expect(resolveWebReadyUrls()).toEqual({
        viteUrl: `http://127.0.0.1:${readUiDevServerPort()}/`,
        httpUrl: 'http://127.0.0.1:30000/api/hello',
      });
    } finally {
      if (prevVite === undefined) delete process.env.VITE_PORT;
      else process.env.VITE_PORT = prevVite;
      if (prevHttp === undefined) delete process.env.HTTP_PORT;
      else process.env.HTTP_PORT = prevHttp;
    }
  });
});
