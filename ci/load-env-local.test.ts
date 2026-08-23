import { describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findEnvLocalFiles, loadEnvLocal } from './load-env-local.ts';

describe('loadEnvLocal (ci)', () => {
  it('loads UI_PORT and CLI_PORT from repo .env.local', () => {
    const root = mkdtempSync(join(tmpdir(), 'smm-ci-env-'));
    writeFileSync(
      join(root, '.env.local'),
      '# --- Ports ---\nUI_PORT=8081\nCLI_PORT=8082\n',
    );

    const prevUi = process.env.UI_PORT;
    const prevCli = process.env.CLI_PORT;
    delete process.env.UI_PORT;
    delete process.env.CLI_PORT;

    try {
      const merged = loadEnvLocal(root);
      expect(merged.UI_PORT).toBe('8081');
      expect(merged.CLI_PORT).toBe('8082');
      expect(process.env.UI_PORT).toBe('8081');
      expect(process.env.CLI_PORT).toBe('8082');
      expect(findEnvLocalFiles(root)).toEqual([join(root, '.env.local')]);
    } finally {
      rmSync(root, { recursive: true, force: true });
      if (prevUi === undefined) delete process.env.UI_PORT;
      else process.env.UI_PORT = prevUi;
      if (prevCli === undefined) delete process.env.CLI_PORT;
      else process.env.CLI_PORT = prevCli;
    }
  });
});
