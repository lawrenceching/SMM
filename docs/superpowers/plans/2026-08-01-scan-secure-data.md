# Scan Secure Data in E2E Artifacts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `ci/scan_secure_data.ts` that fails when e2e artifact logs contain known secret env values, and run it in all e2e GitHub Actions workflows before uploading artifacts.

**Architecture:** Pure library (`ci/scan-secure-data-lib.ts`) collects non-empty env secrets (`TMDB_API_KEY`, `TVDB_API_KEY`, `SMM_AUTH_TOKEN`), walks a directory for text files, and reports redacted hits. Thin CLI wraps the lib with `--dir`. Three e2e workflows call the CLI with `if: always()` before `upload-artifact`.

**Tech Stack:** Bun, Node `fs`/`path`, bun:test, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-01-scan-secure-data-design.md`

## Global Constraints

- Secret env names (exact): `TMDB_API_KEY`, `TVDB_API_KEY`, `SMM_AUTH_TOKEN`.
- Match strategy: literal substring of trimmed env **values** (not regex heuristics).
- Min value length: `8` (skip shorter).
- Default scan dir: `artifacts/cicd`.
- Exit codes: `0` clean / nothing to scan / missing dir; `1` hits found; `2` usage or unexpected I/O error.
- Reports must not print full secret values (redact; e.g. first 2 + last 2 chars).
- CI: step before upload-artifact; `if: always() && steps.e2e.outcome != 'skipped'`.
- Workflows: `e2e-test.yml`, `e2e-docker.yml`, `e2e-http-proxy.yml`.
- Out of scope: cicd `onArtifactsReady`, gitleaks, expanding the env name list.

## File map

| File | Responsibility |
|------|----------------|
| `ci/scan-secure-data-lib.ts` | Collect secrets, walk files, find hits, redact |
| `ci/scan-secure-data-lib.test.ts` | Unit tests for lib |
| `ci/scan_secure_data.ts` | CLI (`--dir`) |
| `.github/workflows/e2e-test.yml` | Scan step before upload |
| `.github/workflows/e2e-docker.yml` | Scan step before upload |
| `.github/workflows/e2e-http-proxy.yml` | Scan step before upload |

---

### Task 1: Scan library + unit tests (TDD)

**Files:**
- Create: `ci/scan-secure-data-lib.ts`
- Create: `ci/scan-secure-data-lib.test.ts`

**Interfaces:**
- Consumes: none
- Produces (exact):
  - `export const SECURE_ENV_NAMES = ['TMDB_API_KEY', 'TVDB_API_KEY', 'SMM_AUTH_TOKEN'] as const`
  - `export const MIN_SECRET_LENGTH = 8`
  - `export type SecretHit = { envName: string; relativePath: string; lineNumber: number }`
  - `export function collectSecretsFromEnv(env: NodeJS.ProcessEnv): Array<{ name: string; value: string }>`
  - `export function redactSecret(value: string): string` — if `value.length <= 4` return `'****'`; else `${value.slice(0, 2)}…${value.slice(-2)}`
  - `export function scanDirectoryForSecrets(rootDir: string, secrets: Array<{ name: string; value: string }>): SecretHit[]`
  - `export function isProbablyBinary(buffer: Buffer): boolean` — true if buffer includes a `0x00` byte
  - `export const MAX_FILE_BYTES = 32 * 1024 * 1024`

- [ ] **Step 1: Write the failing tests**

Create `ci/scan-secure-data-lib.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test ci/scan-secure-data-lib.test.ts`

Expected: FAIL (module or exports missing)

- [ ] **Step 3: Implement `ci/scan-secure-data-lib.ts`**

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';

export const SECURE_ENV_NAMES = [
  'TMDB_API_KEY',
  'TVDB_API_KEY',
  'SMM_AUTH_TOKEN',
] as const;

export const MIN_SECRET_LENGTH = 8;
export const MAX_FILE_BYTES = 32 * 1024 * 1024;

export type SecretHit = {
  envName: string;
  relativePath: string;
  lineNumber: number;
};

export function collectSecretsFromEnv(
  env: NodeJS.ProcessEnv,
): Array<{ name: string; value: string }> {
  const out: Array<{ name: string; value: string }> = [];
  for (const name of SECURE_ENV_NAMES) {
    const value = (env[name] ?? '').trim();
    if (value.length < MIN_SECRET_LENGTH) continue;
    out.push({ name, value });
  }
  return out;
}

export function redactSecret(value: string): string {
  if (value.length <= 4) return '****';
  return `${value.slice(0, 2)}…${value.slice(-2)}`;
}

export function isProbablyBinary(buffer: Buffer): boolean {
  return buffer.includes(0);
}

function walkFiles(dir: string, files: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, files);
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
}

export function scanDirectoryForSecrets(
  rootDir: string,
  secrets: Array<{ name: string; value: string }>,
): SecretHit[] {
  if (secrets.length === 0) return [];
  const root = path.resolve(rootDir);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    return [];
  }
  const files: string[] = [];
  walkFiles(root, files);
  const hits: SecretHit[] = [];
  for (const file of files) {
    let st: fs.Stats;
    try {
      st = fs.statSync(file);
    } catch {
      continue;
    }
    if (!st.isFile() || st.size > MAX_FILE_BYTES) continue;
    let buf: Buffer;
    try {
      buf = fs.readFileSync(file);
    } catch {
      continue;
    }
    if (isProbablyBinary(buf)) continue;
    const text = buf.toString('utf8');
    const lines = text.split(/\r?\n/);
    const relativePath = path.relative(root, file);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      for (const secret of secrets) {
        if (line.includes(secret.value)) {
          hits.push({
            envName: secret.name,
            relativePath,
            lineNumber: i + 1,
          });
        }
      }
    }
  }
  return hits;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test ci/scan-secure-data-lib.test.ts`

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add ci/scan-secure-data-lib.ts ci/scan-secure-data-lib.test.ts
git commit -m "$(cat <<'EOF'
feat(ci): add secret-value scan library for e2e artifacts

EOF
)"
```

---

### Task 2: CLI entry `scan_secure_data.ts`

**Files:**
- Create: `ci/scan_secure_data.ts`

**Interfaces:**
- Consumes: `collectSecretsFromEnv`, `scanDirectoryForSecrets`, `redactSecret` from `./scan-secure-data-lib`
- Produces: CLI exit codes 0 / 1 / 2; usage `bun ci/scan_secure_data.ts [--dir <path>]`

- [ ] **Step 1: Write a small CLI behavior test (optional file or extend lib test)**

Add to `ci/scan-secure-data-lib.test.ts` **or** create `ci/scan_secure_data.test.ts` that spawns the CLI:

```typescript
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
```

- [ ] **Step 2: Run CLI tests — expect FAIL (CLI missing)**

Run: `bun test ci/scan_secure_data.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement `ci/scan_secure_data.ts`**

```typescript
/**
 * Scan e2e cicd artifacts for leaked secret env values.
 *
 * Usage (repo root):
 *   bun ci/scan_secure_data.ts [--dir artifacts/cicd]
 *
 * Exit: 0 = clean / nothing to scan; 1 = leak found; 2 = usage/error
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  collectSecretsFromEnv,
  redactSecret,
  scanDirectoryForSecrets,
} from './scan-secure-data-lib';

function printUsage(): void {
  console.error('Usage: bun ci/scan_secure_data.ts [--dir <path>]');
}

function parseArgs(argv: string[]): { dir: string } | 'usage' {
  let dir = 'artifacts/cicd';
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--dir') {
      const next = argv[++i];
      if (!next) return 'usage';
      dir = next;
      continue;
    }
    if (a === '--help' || a === '-h') return 'usage';
    return 'usage';
  }
  return { dir };
}

function main(): number {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed === 'usage') {
    printUsage();
    return 2;
  }
  const root = path.resolve(process.cwd(), parsed.dir);
  const secrets = collectSecretsFromEnv(process.env);
  if (secrets.length === 0) {
    console.log('[scan_secure_data] no non-empty secure env values to scan; skip');
    return 0;
  }
  if (!fs.existsSync(root)) {
    console.log(`[scan_secure_data] directory missing: ${root}; skip`);
    return 0;
  }
  const hits = scanDirectoryForSecrets(root, secrets);
  if (hits.length === 0) {
    console.log(
      `[scan_secure_data] ok: scanned ${root} against ${secrets.length} secret(s); no leaks`,
    );
    return 0;
  }
  console.error(
    `[scan_secure_data] FAIL: ${hits.length} potential secret leak(s) in ${root}`,
  );
  for (const hit of hits) {
    const sample = secrets.find((s) => s.name === hit.envName)?.value ?? '';
    console.error(
      `  - ${hit.envName} (${redactSecret(sample)}) in ${hit.relativePath}:${hit.lineNumber}`,
    );
  }
  return 1;
}

process.exit(main());
```

- [ ] **Step 4: Run CLI tests — expect PASS**

Run: `bun test ci/scan_secure_data.test.ts ci/scan-secure-data-lib.test.ts`

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add ci/scan_secure_data.ts ci/scan_secure_data.test.ts
git commit -m "$(cat <<'EOF'
feat(ci): add scan_secure_data CLI for e2e artifact leaks

EOF
)"
```

---

### Task 3: Wire scan into e2e GitHub Actions workflows

**Files:**
- Modify: `.github/workflows/e2e-test.yml`
- Modify: `.github/workflows/e2e-docker.yml`
- Modify: `.github/workflows/e2e-http-proxy.yml`

**Interfaces:**
- Consumes: CLI from Task 2
- Produces: identical step before each e2e upload:

```yaml
      - name: Scan e2e logs for secret leaks
        if: always() && steps.e2e.outcome != 'skipped'
        run: bun ci/scan_secure_data.ts --dir artifacts/cicd
```

- [ ] **Step 1: Insert the step in `e2e-test.yml`**

Place **immediately before** the existing step named `Upload E2E logs and reports` (the one with `steps.e2e` and `path: artifacts/cicd/`). Do not change the upload step itself.

- [ ] **Step 2: Insert the same step in `e2e-docker.yml`**

Immediately before `Upload E2E logs and reports` in the `e2e` job (not the image upload job).

- [ ] **Step 3: Insert the same step in `e2e-http-proxy.yml`**

Immediately before `Upload logs`. Confirm the e2e run step still has `id: e2e` so `steps.e2e.outcome` works.

- [ ] **Step 4: Sanity-check YAML**

Run (if PyYAML available):

```bash
python -c "import yaml; yaml.safe_load(open('.github/workflows/e2e-test.yml')); yaml.safe_load(open('.github/workflows/e2e-docker.yml')); yaml.safe_load(open('.github/workflows/e2e-http-proxy.yml')); print('ok')"
```

Expected: `ok`

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/e2e-test.yml .github/workflows/e2e-docker.yml .github/workflows/e2e-http-proxy.yml
git commit -m "$(cat <<'EOF'
ci(e2e): scan artifacts for secret env leaks before upload

EOF
)"
```

---

## Spec coverage (self-review)

| Spec item | Task |
|-----------|------|
| Lib: collect three env names, min length 8 | Task 1 |
| Walk dir, skip binary / large files | Task 1 |
| Redacted hits | Task 1 + 2 |
| Exit 0/1/2 | Task 2 |
| CLI `--dir` | Task 2 |
| Missing dir / no secrets → 0 | Task 2 |
| GHA step before upload on three workflows | Task 3 |

## Placeholder scan

No TBD/TODO steps; code and YAML snippets are complete.
