import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

const CLI = path.join(import.meta.dir, 'scan_secure_data.ts');

describe('scan_secure_data CLI', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-secure-cli-'));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  test('exits 1 when a secret appears in logs and does not echo full secret', () => {
    fs.writeFileSync(
      path.join(tmpRoot, 'leak.log'),
      'token=cli-secret-value-xyz\n',
      'utf8',
    );
    const result = spawnSync(
      'bun',
      [CLI, '--dir', tmpRoot],
      {
        env: { ...process.env, TMDB_API_KEY: 'cli-secret-value-xyz', TVDB_API_KEY: '', SMM_AUTH_TOKEN: '' },
        encoding: 'utf8',
      },
    );
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain('TMDB_API_KEY');
    expect(result.stdout + result.stderr).not.toContain('cli-secret-value-xyz');
  });

  test('exits 0 when directory missing', () => {
    const missing = path.join(tmpRoot, 'nope');
    const result = spawnSync('bun', [CLI, '--dir', missing], {
      env: { ...process.env, TMDB_API_KEY: 'cli-secret-value-xyz' },
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
  });

  test('exits 0 when no secrets configured', () => {
    fs.writeFileSync(path.join(tmpRoot, 'a.log'), 'x\n', 'utf8');
    const result = spawnSync('bun', [CLI, '--dir', tmpRoot], {
      env: {
        ...process.env,
        TMDB_API_KEY: '',
        TVDB_API_KEY: '',
        SMM_AUTH_TOKEN: '',
      },
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
  });
});
