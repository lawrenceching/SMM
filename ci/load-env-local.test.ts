import { describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findEnvLocalFiles, loadEnvLocal } from './load-env-local.ts';

describe('loadEnvLocal (ci)', () => {
  it('loads VITE_PORT and HTTP_PORT from repo .env.local', () => {
    const root = mkdtempSync(join(tmpdir(), 'smm-ci-env-'));
    writeFileSync(
      join(root, '.env.local'),
      '# --- Ports ---\nVITE_PORT=8081\nHTTP_PORT=8082\n',
    );

    const prevVite = process.env.VITE_PORT;
    const prevHttp = process.env.HTTP_PORT;
    delete process.env.VITE_PORT;
    delete process.env.HTTP_PORT;

    try {
      const merged = loadEnvLocal(root);
      expect(merged.VITE_PORT).toBe('8081');
      expect(merged.HTTP_PORT).toBe('8082');
      expect(process.env.VITE_PORT).toBe('8081');
      expect(process.env.HTTP_PORT).toBe('8082');
      expect(findEnvLocalFiles(root)).toEqual([join(root, '.env.local')]);
    } finally {
      rmSync(root, { recursive: true, force: true });
      if (prevVite === undefined) delete process.env.VITE_PORT;
      else process.env.VITE_PORT = prevVite;
      if (prevHttp === undefined) delete process.env.HTTP_PORT;
      else process.env.HTTP_PORT = prevHttp;
    }
  });
});
