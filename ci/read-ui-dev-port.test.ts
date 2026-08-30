import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseViteDevServerPort,
  readUiDevServerPort,
} from './read-ui-dev-port.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('parseViteDevServerPort', () => {
  test('extracts port from server block', () => {
    expect(
      parseViteDevServerPort(
        `export default defineConfig({ server: { port: 8000, proxy: {} }, })`,
      ),
    ).toBe(8000);
  });

  test('falls back when port is omitted', () => {
    expect(parseViteDevServerPort(`export default defineConfig({})`)).toBe(5173);
  });

  test('extracts DEFAULT_UI_DEV_PORT when port is computed', () => {
    expect(
      parseViteDevServerPort(
        `const DEFAULT_UI_DEV_PORT = 8000\nexport default defineConfig({ server: { port: resolveUiDevPort() } })`,
      ),
    ).toBe(8000);
  });
});

describe('readUiDevServerPort', () => {
  test('prefers UI_PORT env over vite.config.ts', () => {
    const prev = process.env.UI_PORT;
    process.env.UI_PORT = '9001';
    try {
      expect(readUiDevServerPort(path.join(ROOT, 'apps/ui/vite.config.ts'))).toBe(9001);
    } finally {
      if (prev === undefined) delete process.env.UI_PORT;
      else process.env.UI_PORT = prev;
    }
  });

  test('reads server.port from apps/ui/vite.config.ts', () => {
    const prev = process.env.UI_PORT;
    delete process.env.UI_PORT;
    try {
      const port = readUiDevServerPort(path.join(ROOT, 'apps/ui/vite.config.ts'));
      expect(port).toBe(8000);
    } finally {
      if (prev === undefined) delete process.env.UI_PORT;
      else process.env.UI_PORT = prev;
    }
  });

  test('reads server.port from a temporary vite config', () => {
    const prev = process.env.UI_PORT;
    delete process.env.UI_PORT;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vite-port-'));
    const configPath = path.join(dir, 'vite.config.ts');
    fs.writeFileSync(
      configPath,
      `import { defineConfig } from 'vite'\nexport default defineConfig({ server: { port: 4321 } })\n`,
    );

    try {
      expect(readUiDevServerPort(configPath)).toBe(4321);
    } finally {
      if (prev === undefined) delete process.env.UI_PORT;
      else process.env.UI_PORT = prev;
    }
  });

  test('falls back to Vite default 5173 when port is omitted', () => {
    const prev = process.env.UI_PORT;
    delete process.env.UI_PORT;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vite-port-'));
    const configPath = path.join(dir, 'vite.config.ts');
    fs.writeFileSync(
      configPath,
      `import { defineConfig } from 'vite'\nexport default defineConfig({})\n`,
    );

    try {
      expect(readUiDevServerPort(configPath)).toBe(5173);
    } finally {
      if (prev === undefined) delete process.env.UI_PORT;
      else process.env.UI_PORT = prev;
    }
  });
});
