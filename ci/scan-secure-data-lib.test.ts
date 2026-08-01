import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  collectSecretsFromEnv,
  redactSecret,
  scanDirectoryForSecrets,
  MIN_SECRET_LENGTH,
  SECURE_ENV_NAMES,
} from './scan-secure-data-lib';

describe('collectSecretsFromEnv', () => {
  test('collects only the three secure names when non-empty and long enough', () => {
    const secrets = collectSecretsFromEnv({
      TMDB_API_KEY: '  abcdefghij  ',
      TVDB_API_KEY: 'short',
      SMM_AUTH_TOKEN: 'ChangeMe123',
      OTHER: 'should-ignore-this-value-xxxxxxxx',
    });
    expect(secrets.map((s) => s.name).sort()).toEqual(['SMM_AUTH_TOKEN', 'TMDB_API_KEY']);
    expect(secrets.find((s) => s.name === 'TMDB_API_KEY')!.value).toBe('abcdefghij');
    expect(secrets.find((s) => s.name === 'SMM_AUTH_TOKEN')!.value).toBe('ChangeMe123');
  });

  test('returns empty when all secure env values missing or too short', () => {
    expect(collectSecretsFromEnv({})).toEqual([]);
    expect(
      collectSecretsFromEnv({
        TMDB_API_KEY: 'x'.repeat(MIN_SECRET_LENGTH - 1),
      }),
    ).toEqual([]);
  });

  test('SECURE_ENV_NAMES is the fixed list', () => {
    expect([...SECURE_ENV_NAMES]).toEqual([
      'TMDB_API_KEY',
      'TVDB_API_KEY',
      'SMM_AUTH_TOKEN',
    ]);
  });
});

describe('redactSecret', () => {
  test('masks middle of longer values', () => {
    expect(redactSecret('abcdefghij')).toBe('ab…ij');
  });

  test('fully masks short values', () => {
    expect(redactSecret('abcd')).toBe('****');
  });
});

describe('scanDirectoryForSecrets', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-secure-'));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  test('finds secret substring with file path and line number', () => {
    const nested = path.join(tmpRoot, 'run1', 'Spec.e2e.ts');
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(
      path.join(nested, 'main.log'),
      'ok line\napiKey=super-secret-key-99\ntrail\n',
      'utf8',
    );
    const hits = scanDirectoryForSecrets(tmpRoot, [
      { name: 'TMDB_API_KEY', value: 'super-secret-key-99' },
    ]);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.envName).toBe('TMDB_API_KEY');
    expect(hits[0]!.lineNumber).toBe(2);
    expect(hits[0]!.relativePath.replace(/\\/g, '/')).toBe(
      'run1/Spec.e2e.ts/main.log',
    );
  });

  test('returns empty when logs are clean', () => {
    fs.writeFileSync(path.join(tmpRoot, 'clean.log'), 'hello world\n', 'utf8');
    const hits = scanDirectoryForSecrets(tmpRoot, [
      { name: 'TMDB_API_KEY', value: 'super-secret-key-99' },
    ]);
    expect(hits).toEqual([]);
  });

  test('skips binary files containing NUL', () => {
    fs.writeFileSync(path.join(tmpRoot, 'blob.bin'), Buffer.from([0x00, 0x01, 0x02]));
    fs.writeFileSync(
      path.join(tmpRoot, 'also.txt'),
      'no secrets here\n',
      'utf8',
    );
    const hits = scanDirectoryForSecrets(tmpRoot, [
      { name: 'TMDB_API_KEY', value: 'super-secret-key-99' },
    ]);
    expect(hits).toEqual([]);
  });
});
