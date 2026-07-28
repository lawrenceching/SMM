# Docker E2E Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `--platform docker` to `ci/run-e2e-test.ts` so common e2e specs run against a managed `smm:latest` container on `:30000`, with BiDi browser console in `main.log` and per-task `container.log` from cicd background log slicing.

**Architecture:** Full container lifecycle via a cicd background named `container` (`ci/e2e-docker-container.ts` → `docker run` + `docker logs -f`). Dedicated `apps/e2e/docker/wdio.conf.ts` + `pnpm wdio:docker`. UI URL comes from `E2E_PLATFORM=docker` → `http://localhost:30000`. Spec requires explicit `--spec` (no default suite). Design: `docs/superpowers/specs/2026-07-29-docker-e2e-platform-design.md`.

**Tech Stack:** Bun, Docker CLI, WebdriverIO 9 (Chrome + BiDi), existing `apps/cicd` timeline slicer, TypeScript.

## Global Constraints

- Do **not** build `smm:latest` (assume image exists).
- Container name: `smm`; ports: `30000:30000`, `30002:30002`; media volume: `path.join(os.tmpdir(), 'smm'):/media`.
- Default auth token: `ChangeMe123` (override via `SMM_AUTH_TOKEN`).
- Browser console: BiDi `BROWSER_LOG_ENABLED` only — do **not** `docker cp` in-container `browser.log`.
- Server logs: cicd background name **`container`** → `{task}/container.log` (not `cli.log`).
- `--platform docker` requires ≥1 `--spec`; reject `ohos/` and `electron/` exclusive specs.
- Do not commit unless the user asks (except when a plan step says to commit and the user already authorized plan execution that includes commits).

---

## File Map

**Create:**
- `ci/e2e-docker-container.ts` — start/stop container + `docker logs -f` (cicd background)
- `ci/e2e-docker-container.test.ts` — unit tests for media dir + `docker run` argv builder
- `ci/wait-for-docker-e2e-ready.ts` — poll `POST http://localhost:30000/api/hello` with Bearer token
- `apps/e2e/docker/wdio.conf.ts` — Chrome WDIO config for docker UI
- `ci/run-e2e-test.test.ts` — argv / platform / docker `--spec` required / config shape tests

**Modify:**
- `apps/e2e/test/lib/ui-page-url.ts` — `DOCKER_UI_ORIGIN`; when `E2E_PLATFORM=docker` and `os === 'general'`, use `:30000`
- `apps/e2e/test/lib/ui-page-url.test.ts` — docker URL cases
- `ci/run-e2e-test.ts` — platform `docker`, `buildDockerConfig`, require `--spec`
- `apps/e2e/package.json` — `"wdio:docker"`
- `apps/e2e/common/README.md` — document how to run docker platform (one short section)
- `apps/e2e/lib/wdioCacheDir.ts` — comment update only if needed (shared cache already covers browser)

**Reference (read-only):**
- `docs/superpowers/specs/2026-07-29-docker-e2e-platform-design.md`
- `ci/wait-for-e2e-ready.ts`
- `apps/e2e/wdio.conf.ts` (BiDi `before` hook, network log, Chrome caps, html reporter)
- `apps/e2e/electron/wdio.conf.ts` / `apps/e2e/ohos/wdio.conf.ts` (isolated config layout)
- `apps/cicd/README.md` (background → `{task}/<name>.log` slicing)

---

### Task 1: Docker UI origin in `resolveUiPageUrl`

**Files:**
- Modify: `apps/e2e/test/lib/ui-page-url.ts`
- Modify: `apps/e2e/test/lib/ui-page-url.test.ts`

**Interfaces:**
- Consumes: `process.env.E2E_PLATFORM`, existing `resolveUiPageUrl(url?, os?)`
- Produces:
  - `export const DOCKER_UI_ORIGIN = 'http://localhost:30000/'`
  - When `os === 'general'` (default) and `process.env.E2E_PLATFORM === 'docker'`, base URL is `DOCKER_UI_ORIGIN`
  - HarmonyOS path unchanged; explicit `url` still wins

- [ ] **Step 1: Write the failing tests**

Add to `apps/e2e/test/lib/ui-page-url.test.ts`:

```ts
import { DOCKER_UI_ORIGIN, resolveUiPageUrl } from './ui-page-url.ts';

test('docker platform uses localhost:30000 when os is general', () => {
  const prevPlatform = process.env.E2E_PLATFORM;
  const prevToken = process.env.SMM_AUTH_TOKEN;
  process.env.E2E_PLATFORM = 'docker';
  delete process.env.SMM_AUTH_TOKEN;

  try {
    expect(resolveUiPageUrl()).toBe(DOCKER_UI_ORIGIN);
    expect(resolveUiPageUrl(undefined, 'general')).toBe(DOCKER_UI_ORIGIN);
  } finally {
    if (prevPlatform === undefined) delete process.env.E2E_PLATFORM;
    else process.env.E2E_PLATFORM = prevPlatform;
    if (prevToken === undefined) delete process.env.SMM_AUTH_TOKEN;
    else process.env.SMM_AUTH_TOKEN = prevToken;
  }
});

test('docker platform appends token', () => {
  const prevPlatform = process.env.E2E_PLATFORM;
  const prevToken = process.env.SMM_AUTH_TOKEN;
  process.env.E2E_PLATFORM = 'docker';
  process.env.SMM_AUTH_TOKEN = 'ChangeMe123';

  try {
    expect(resolveUiPageUrl()).toBe(`${DOCKER_UI_ORIGIN}?token=ChangeMe123`);
  } finally {
    if (prevPlatform === undefined) delete process.env.E2E_PLATFORM;
    else process.env.E2E_PLATFORM = prevPlatform;
    if (prevToken === undefined) delete process.env.SMM_AUTH_TOKEN;
    else process.env.SMM_AUTH_TOKEN = prevToken;
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/e2e && bun test ./test/lib/ui-page-url.test.ts`
Expected: FAIL — `DOCKER_UI_ORIGIN` not exported and/or URL still Vite port

- [ ] **Step 3: Implement**

In `ui-page-url.ts`:

```ts
export const DOCKER_UI_ORIGIN = 'http://localhost:30000/'

function defaultBaseUrlForOs(os: TestbedOs): string {
  if (os === 'HarmonyOS') {
    return HARMONYOS_UI_ORIGIN
  }
  if (process.env.E2E_PLATFORM === 'docker') {
    return DOCKER_UI_ORIGIN
  }
  return `http://localhost:${readUiDevServerPort()}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/e2e && bun test ./test/lib/ui-page-url.test.ts`
Expected: PASS (existing Vite tests still pass when `E2E_PLATFORM` is unset)

- [ ] **Step 5: Commit**

```bash
git add apps/e2e/test/lib/ui-page-url.ts apps/e2e/test/lib/ui-page-url.test.ts
git commit -m "$(cat <<'EOF'
feat(e2e): resolve docker UI origin to localhost:30000

EOF
)"
```

---

### Task 2: Container lifecycle helpers + background script

**Files:**
- Create: `ci/e2e-docker-container.ts`
- Create: `ci/e2e-docker-container.test.ts`

**Interfaces:**
- Consumes: Docker CLI on PATH; `process.env.SMM_AUTH_TOKEN`
- Produces (exported for tests):
  - `export const DOCKER_CONTAINER_NAME = 'smm'`
  - `export const DOCKER_IMAGE = 'smm:latest'`
  - `export function resolveDockerMediaHostDir(): string` → `path.join(os.tmpdir(), 'smm')`
  - `export function buildDockerRunArgs(options: { authToken: string; mediaHostDir: string }): string[]`
  - CLI main: ensure media dir → `docker stop` (ignore errors) → `docker run -d ...` → `docker logs -f` until signal → `docker stop`

- [ ] **Step 1: Write the failing unit tests**

`ci/e2e-docker-container.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  DOCKER_CONTAINER_NAME,
  DOCKER_IMAGE,
  buildDockerRunArgs,
  resolveDockerMediaHostDir,
} from './e2e-docker-container.ts';

describe('e2e-docker-container helpers', () => {
  test('resolveDockerMediaHostDir is os.tmpdir()/smm', () => {
    expect(resolveDockerMediaHostDir()).toBe(path.join(os.tmpdir(), 'smm'));
  });

  test('buildDockerRunArgs matches required docker run shape', () => {
    const media = path.join(os.tmpdir(), 'smm');
    const args = buildDockerRunArgs({
      authToken: 'ChangeMe123',
      mediaHostDir: media,
    });
    expect(args).toEqual([
      'run',
      '-d',
      '--rm',
      '--name',
      DOCKER_CONTAINER_NAME,
      '-p',
      '30000:30000',
      '-p',
      '30002:30002',
      '-e',
      'SMM_AUTH_TOKEN=ChangeMe123',
      '-v',
      `${media}:/media`,
      DOCKER_IMAGE,
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test ci/e2e-docker-container.test.ts`
Expected: FAIL — module / exports missing

- [ ] **Step 3: Implement helpers + main**

`ci/e2e-docker-container.ts` (structure):

```ts
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export const DOCKER_CONTAINER_NAME = 'smm';
export const DOCKER_IMAGE = 'smm:latest';

export function resolveDockerMediaHostDir(): string {
  return path.join(os.tmpdir(), 'smm');
}

export function buildDockerRunArgs(options: {
  authToken: string;
  mediaHostDir: string;
}): string[] {
  return [
    'run',
    '-d',
    '--rm',
    '--name',
    DOCKER_CONTAINER_NAME,
    '-p',
    '30000:30000',
    '-p',
    '30002:30002',
    '-e',
    `SMM_AUTH_TOKEN=${options.authToken}`,
    '-v',
    `${options.mediaHostDir}:/media`,
    DOCKER_IMAGE,
  ];
}

function runDocker(args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { stdio: 'inherit', shell: false });
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}

async function stopContainerQuietly(): Promise<void> {
  await runDocker(['stop', DOCKER_CONTAINER_NAME]).catch(() => undefined);
}

async function main(): Promise<void> {
  const authToken = process.env.SMM_AUTH_TOKEN ?? 'ChangeMe123';
  const mediaHostDir = resolveDockerMediaHostDir();
  fs.mkdirSync(mediaHostDir, { recursive: true });

  await stopContainerQuietly();
  const runCode = await runDocker(buildDockerRunArgs({ authToken, mediaHostDir }));
  if (runCode !== 0) {
    throw new Error(`docker run failed with exit ${runCode}`);
  }

  const follow = spawn('docker', ['logs', '-f', DOCKER_CONTAINER_NAME], {
    stdio: 'inherit',
    shell: false,
  });

  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    follow.kill('SIGTERM');
    await stopContainerQuietly();
  };

  process.on('SIGTERM', () => {
    void shutdown().finally(() => process.exit(0));
  });
  process.on('SIGINT', () => {
    void shutdown().finally(() => process.exit(0));
  });

  const followCode = await new Promise<number>((resolve, reject) => {
    follow.on('error', reject);
    follow.on('close', (code) => resolve(code ?? 0));
  });

  await shutdown();
  if (followCode !== 0 && !stopping) {
    process.exit(followCode);
  }
}

const isMain =
  import.meta.path === Bun.main ||
  process.argv[1]?.endsWith('e2e-docker-container.ts');

if (isMain) {
  main().catch((error) => {
    console.error('[e2e-docker-container] failed:', error);
    process.exit(1);
  });
}
```

Adjust `isMain` detection to match other `ci/*.ts` scripts in this repo if a different pattern is already used (`import.meta.main` on Bun is preferred when available: `if (import.meta.main) { ... }`).

- [ ] **Step 4: Run unit tests**

Run: `bun test ci/e2e-docker-container.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add ci/e2e-docker-container.ts ci/e2e-docker-container.test.ts
git commit -m "$(cat <<'EOF'
feat(ci): add docker container lifecycle for e2e background

EOF
)"
```

---

### Task 3: Docker wait-ready script

**Files:**
- Create: `ci/wait-for-docker-e2e-ready.ts`

**Interfaces:**
- Consumes: `SMM_AUTH_TOKEN` (default `ChangeMe123`)
- Produces: process exit 0 when `POST http://localhost:30000/api/hello` returns OK with Bearer auth; exit 1 on timeout (120s)

- [ ] **Step 1: Implement script** (mirror `ci/wait-for-e2e-ready.ts` wait loop, but **only** docker UI/API port — no Vite)

```ts
/**
 * Polls docker-served SMM on :30000 until /api/hello responds, or exits 1 on timeout.
 */
const READY_URL = 'http://localhost:30000/api/hello';

async function waitForHttp(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    timeoutMs?: number;
    intervalMs?: number;
  } = {},
): Promise<void> {
  const {
    method = 'GET',
    headers,
    timeoutMs = 120_000,
    intervalMs = 500,
  } = options;

  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, {
        method,
        headers,
        signal: AbortSignal.timeout(5_000),
      });
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `Timed out waiting for ${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

async function main(): Promise<void> {
  const token = process.env.SMM_AUTH_TOKEN ?? 'ChangeMe123';
  console.log('[wait-for-docker-e2e-ready] waiting for', READY_URL);
  await waitForHttp(READY_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('[wait-for-docker-e2e-ready] ready');
}

main().catch((error) => {
  console.error('[wait-for-docker-e2e-ready] failed:', error);
  process.exit(1);
});
```

- [ ] **Step 2: Syntax check**

Run: `bun --print "await import('./ci/wait-for-docker-e2e-ready.ts')"` is wrong (would run main). Prefer:

Run: `bun build ci/wait-for-docker-e2e-ready.ts --outdir=/tmp/smm-wait-docker-check`  
Or simply: `bun -e "await Bun.file('ci/wait-for-docker-e2e-ready.ts').text(); console.log('ok')"`

Expected: no parse errors

- [ ] **Step 3: Commit**

```bash
git add ci/wait-for-docker-e2e-ready.ts
git commit -m "$(cat <<'EOF'
feat(ci): add wait-for-docker-e2e-ready for :30000

EOF
)"
```

---

### Task 4: `apps/e2e/docker/wdio.conf.ts` + package script

**Files:**
- Create: `apps/e2e/docker/wdio.conf.ts`
- Modify: `apps/e2e/package.json`

**Interfaces:**
- Consumes: `WDIO_CACHE_DIR`, `applyE2eWindowSize`, `registerExpectExtensions`, network log helpers, BiDi browser log pattern from desktop `wdio.conf.ts`
- Produces: `pnpm wdio:docker` → `wdio run ./docker/wdio.conf.ts`
- Env: `BROWSER_LOG_ENABLED`, `NETWORK_LOG_ENABLED` (set by runner)

- [ ] **Step 1: Add package script**

In `apps/e2e/package.json` scripts:

```json
"wdio:docker": "wdio run ./docker/wdio.conf.ts"
```

- [ ] **Step 2: Create WDIO config**

Create `apps/e2e/docker/wdio.conf.ts` as an isolated Chrome config:

- `tsConfigPath: '../tsconfig.json'`
- `cacheDir: WDIO_CACHE_DIR`
- `specs: ['../common/**/*.e2e.ts']` (runner always passes `--spec`; this is manual fallback only)
- `maxInstances: 1`
- Chrome capabilities: reuse the same binary/version resolution approach as desktop `apps/e2e/wdio.conf.ts` (pinned Chrome / `CHROME_BIN` / local cache). Args: `--disable-gpu`, `--no-sandbox`, `--force-device-scale-factor=1` (host browser talking to docker UI — **not** `BUILD_ENV=docker` sandbox-only args unless running WDIO itself inside a container).
- `framework: 'mocha'`, `reporters: ['spec']` **and** the same `wdio-html-nice-reporter` setup as desktop so `collect-wdio-report` finds `apps/e2e/reports/html-reports/`
- `mochaOpts.timeout: 6 * 60 * 1000`
- `beforeSession` / `before` / `after` / `onComplete`: copy network-log + BiDi browser console hooks from desktop `wdio.conf.ts` (`BROWSER_LOG_ENABLED`, `isNetworkLogEnabled`, `setupNetworkLogCapture`, etc.)
- Do **not** import ohos/electron services

Keep the file focused: prefer copying the needed hooks rather than importing the whole desktop config object.

- [ ] **Step 3: Smoke config load (no docker required)**

Run: `cd apps/e2e && pnpm exec wdio run ./docker/wdio.conf.ts --help`  
(or `pnpm wdio:docker --help` if WDIO forwards it)

Expected: WDIO prints help / does not crash on config import

- [ ] **Step 4: Commit**

```bash
git add apps/e2e/docker/wdio.conf.ts apps/e2e/package.json
git commit -m "$(cat <<'EOF'
feat(e2e): add docker WDIO config and wdio:docker script

EOF
)"
```

---

### Task 5: Wire `--platform docker` in `run-e2e-test.ts`

**Files:**
- Modify: `ci/run-e2e-test.ts`
- Create: `ci/run-e2e-test.test.ts`

**Interfaces:**
- Consumes: Tasks 2–4 scripts; existing cicd runner
- Produces:
  - `Platform` includes `'docker'`
  - `parseArgv` / validation: docker without `--spec` throws
  - `buildDockerConfig(specs)` as specified in design
  - Export pure helpers needed by tests (`parseArgv`, `buildConfig` or `buildDockerConfig`, `assertSpecsMatchPlatform`) — if exporting from the script file is awkward with `main()`, extract to `ci/run-e2e-test-lib.ts` and keep `run-e2e-test.ts` as thin CLI

Recommended extract (keeps main thin):

- Create `ci/run-e2e-test-lib.ts` with: `Platform`, `parseArgv`, `assertSpecsMatchPlatform`, `defaultPatternsForPlatform`, `specFiles`, `buildConfig` / per-platform builders
- `ci/run-e2e-test.ts` imports lib and runs cicd

If extraction is too large for one task, minimally: move only the functions under test into `ci/run-e2e-test-lib.ts` and leave other builders in place via re-export. Prefer **one** lib file with all existing builder logic relocated so desktop/ohos/electron keep working.

- [ ] **Step 1: Write failing tests**

`ci/run-e2e-test.test.ts` (after lib exists, or against exports):

```ts
import { describe, expect, test } from 'bun:test';
import {
  assertSpecsMatchPlatform,
  buildConfig,
  parseArgv,
} from './run-e2e-test-lib.ts';

describe('run-e2e-test docker platform', () => {
  test('parseArgv accepts --platform docker with --spec', () => {
    const parsed = parseArgv([
      '--platform',
      'docker',
      '--spec',
      './common/movie/SearchMovie.e2e.ts',
    ]);
    expect(parsed.platform).toBe('docker');
    expect(parsed.patterns).toEqual(['./common/movie/SearchMovie.e2e.ts']);
  });

  test('docker buildConfig requires specs (caller enforces empty patterns)', () => {
    // main() must throw when platform===docker && patterns.length===0
    // Test the guard used by main:
    expect(() => {
      const { platform, patterns } = parseArgv(['--platform', 'docker']);
      if (platform === 'docker' && patterns.length === 0) {
        throw new Error('docker requires --spec');
      }
    }).toThrow(/docker requires --spec/);
  });

  test('assertSpecsMatchPlatform rejects ohos specs on docker', () => {
    expect(() =>
      assertSpecsMatchPlatform('docker', ['ohos/layout.e2e.ts']),
    ).toThrow(/ohos/);
  });

  test('buildConfig docker uses container background and wdio:docker', () => {
    const config = buildConfig('docker', ['common/movie/SearchMovie.e2e.ts']);
    expect(config.name).toBe('smm-e2e-docker');
    expect(config.env.E2E_PLATFORM).toBe('docker');
    expect(config.env.BROWSER_LOG_ENABLED).toBe('true');
    expect(config.env.NETWORK_LOG_ENABLED).toBe('true');
    expect(config.background).toEqual([
      {
        name: 'container',
        command: 'bun ci/e2e-docker-container.ts',
        cwd: expect.any(String), // or omit cwd if ROOT is absolute and asserted differently
      },
    ]);
    // Prefer asserting command strings precisely with ROOT from the lib:
    expect(config.background[0]!.name).toBe('container');
    expect(config.background[0]!.command).toBe('bun ci/e2e-docker-container.ts');
    expect(config.tasks[0]!.command).toContain('wait-for-docker-e2e-ready');
    expect(config.tasks.some((t) => t.command.includes('wdio:docker'))).toBe(true);
    expect(config.afterEach[0]!.command).toContain('collect-wdio-report');
  });
});
```

Refine assertions to match the actual `cwd` field shape used by desktop config (`cwd: ROOT`).

- [ ] **Step 2: Run tests — expect FAIL**

Run: `bun test ci/run-e2e-test.test.ts`
Expected: FAIL (lib / docker branch missing)

- [ ] **Step 3: Implement lib + docker profile**

`buildDockerConfig(specs)`:

```ts
function buildDockerConfig(specs: string[]) {
  const env: Record<string, string> = {
    E2E_PLATFORM: 'docker',
    BROWSER_LOG_ENABLED: 'true',
    NETWORK_LOG_ENABLED: 'true',
    SMM_AUTH_TOKEN: process.env.SMM_AUTH_TOKEN ?? 'ChangeMe123',
  };
  if (process.env.EXTERNAL_CONFIG_FILE_URL) {
    env.EXTERNAL_CONFIG_FILE_URL = process.env.EXTERNAL_CONFIG_FILE_URL;
  }

  return {
    name: 'smm-e2e-docker',
    outputDir: './artifacts/cicd',
    env,
    background: [
      { name: 'container', command: 'bun ci/e2e-docker-container.ts', cwd: ROOT },
    ],
    tasks: [
      {
        name: 'wait-ready',
        command: 'bun ci/wait-for-docker-e2e-ready.ts',
        cwd: ROOT,
      },
      ...specs.map((spec) => ({
        name: path.posix.basename(spec),
        command: `pnpm wdio:docker --spec ./${normalizeSpecPath(spec)}`,
        cwd: E2E_ROOT,
      })),
    ],
    afterEach: [
      {
        name: 'collect-wdio-report',
        command: 'bun ci/collect-wdio-report.ts',
        cwd: ROOT,
      },
    ],
    stopOnFailure: false,
    keepRawTimeline: true,
    taskTimeout: 30 * 60 * 1000,
  };
}
```

Also update:
- `USAGE` string to include `docker`
- `PLATFORMS` set
- `assertSpecsMatchPlatform`: for `docker`, reject `isOhosSpec` / `isElectronSpec` (allow `common/` and other non-exclusive paths)
- `main()`: if `platform === 'docker' && patterns.length === 0` → throw with usage
- `defaultPatternsForPlatform('docker')` should not be used when patterns empty (guard first); if called, throw

- [ ] **Step 4: Run tests — expect PASS**

Run: `bun test ci/run-e2e-test.test.ts`
Expected: PASS

- [ ] **Step 5: Dry-run argv error without docker daemon**

Run: `bun ci/run-e2e-test.ts --platform docker`  
Expected: non-zero exit, message mentioning `--spec`

- [ ] **Step 6: Commit**

```bash
git add ci/run-e2e-test.ts ci/run-e2e-test-lib.ts ci/run-e2e-test.test.ts
git commit -m "$(cat <<'EOF'
feat(ci): support --platform docker in run-e2e-test

EOF
)"
```

---

### Task 6: Docs touch-up

**Files:**
- Modify: `apps/e2e/common/README.md`

- [ ] **Step 1: Document docker run command**

Add under Test Environment / execution:

```markdown
### Docker

Requires pre-built `smm:latest` and Docker CLI.

```bash
bun ci/run-e2e-test.ts --platform docker --spec ./common/movie/SearchMovie.e2e.ts
```

`--spec` is required (no default suite). Artifacts: `{task}/main.log` (incl. BiDi browser console), `{task}/container.log`, `wdio-report/`, `network-log/`.
```

- [ ] **Step 2: Commit**

```bash
git add apps/e2e/common/README.md
git commit -m "$(cat <<'EOF'
docs(e2e): document docker platform runner usage

EOF
)"
```

---

### Task 7: Manual smoke (when `smm:latest` available)

**Files:** none (verification only)

- [ ] **Step 1: Confirm image**

Run: `docker image inspect smm:latest`  
Expected: exits 0

- [ ] **Step 2: Run one short common spec**

Run:

```bash
bun ci/run-e2e-test.ts --platform docker --spec ./common/movie/SearchMovie.e2e.ts
```

(or a shorter smoke if one exists; `SearchMovie` is acceptable)

Expected:
- Container starts / stops
- WDIO runs against `:30000`
- Under `artifacts/cicd/<id>/<Spec>/`: `main.log`, `container.log`, `wdio-report/`, `network-log/` present (report/network may be empty dirs only if capture disabled — they should be enabled)

- [ ] **Step 3: If image missing, record skip**

Do not block the plan; note in the PR/summary that smoke was skipped.

---

## Spec coverage self-check

| Spec requirement | Task |
|---|---|
| Full container lifecycle stop/run/logs-f/stop | Task 2 |
| Ports 30000/30002, auth, tmpdir/smm:/media | Task 2 |
| Wait ready on :30000 only | Task 3 |
| Dedicated `docker/wdio.conf.ts` + `wdio:docker` | Task 4 |
| BiDi browser console → main.log | Task 4 + Task 5 env |
| Background name `container` → container.log | Task 5 |
| `--spec` required | Task 5 |
| Reject ohos/electron exclusives | Task 5 |
| `resolveUiPageUrl` docker origin | Task 1 |
| collect-wdio-report afterEach | Task 5 |
| No image build / no attach mode / no docker cp browser.log | Non-goals honored |
| Docs | Task 6 |
| Manual smoke | Task 7 |

## Placeholder / consistency scan

- Names aligned: `DOCKER_CONTAINER_NAME='smm'`, cicd background `'container'`, artifact `container.log`
- Wait script path: `ci/wait-for-docker-e2e-ready.ts`
- Token default `ChangeMe123` everywhere
- No TBD left in tasks
