# Web UI E2E Platform (`--platform web`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `--platform web` so `e2e-web-ui.yml` runs common specs against a built `cli --staticDir apps/ui/dist` on `:30000`, not Vite + `e2e:cli`.

**Architecture:** New cicd profile `buildWebConfig`: one background process (compiled CLI + absolute `--staticDir` + `--port 30000`), wait on `/api/hello`, reuse desktop `pnpm wdio` with `E2E_PLATFORM=web` driving `resolveUiPageUrl` to `:30000`. Workflow builds cli/ui then passes `--platform web`. Design: `docs/superpowers/specs/2026-09-22-web-ui-e2e-platform-design.md`.

**Tech Stack:** Bun, compiled CLI (`apps/cli/dist/cli[.exe]`), Vite-built `apps/ui/dist`, WebdriverIO 9, existing `apps/cicd` runner.

## Global Constraints

- Scope: `e2e-web-ui.yml` + runner/URL helpers only — do **not** change `desktop` or `ci.yml` `host-e2e`.
- Default auth: `SMM_AUTH_ENABLED=true`, `SMM_AUTH_TOKEN=ChangeMe123`.
- Default origin: `http://localhost:30000/`; override via `E2E_WEB_UI_ORIGIN`.
- Reuse desktop `wdio.conf.ts` / `pnpm wdio` (no new `wdio:web` unless a hard blocker appears).
- `--platform web` requires ≥1 `--spec`; reject `ohos/` and `electron/` exclusive specs (same as desktop/docker).
- Do not commit unless the user asks (except when a plan step says to commit and the user already authorized plan execution that includes commits).
- After code changes: run build/typecheck for touched packages per AGENTS.md.

---

## File Map

**Create:**
- `ci/wait-for-web-e2e-ready.ts` — poll `GET {origin}api/hello` with Bearer token (`E2E_WEB_UI_ORIGIN`, default `:30000`)

**Modify:**
- `apps/e2e/test/lib/ui-page-url.ts` — `DEFAULT_WEB_UI_ORIGIN`, `resolveWebUiOrigin()`, `E2E_PLATFORM=web` branch
- `apps/e2e/test/lib/ui-page-url.test.ts` — web origin + override + token cases
- `ci/run-e2e-test-lib.ts` — `Platform` + `web`, `buildWebConfig`, argv/USAGE, spec rules, `buildConfig` dispatch
- `ci/run-e2e-test.test.ts` — parse / requireSpec / assertSpecs / buildWebConfig shape
- `ci/run-e2e-test.ts` — usage comment if it lists platforms
- `apps/e2e/test/lib/e2e-window-size.ts` — on CI, treat `E2E_PLATFORM=web` like former `BUILD_ENV=docker` (fixed 1920×1080, no fit-to-screen)
- `.github/workflows/e2e-web-ui.yml` — build cli/ui, `--platform web`, drop `BUILD_ENV: docker`, update comments

**Reference (read-only):**
- `docs/superpowers/specs/2026-09-22-web-ui-e2e-platform-design.md`
- `ci/wait-for-docker-e2e-ready.ts`
- `ci/run-e2e-test-lib.ts` (`buildDesktopConfig`, `buildDockerConfig`)
- `apps/cli/index.ts` (`--staticDir`, default port 30000)

---

### Task 1: Web UI origin in `resolveUiPageUrl`

**Files:**
- Modify: `apps/e2e/test/lib/ui-page-url.ts`
- Modify: `apps/e2e/test/lib/ui-page-url.test.ts`

**Interfaces:**
- Consumes: `process.env.E2E_PLATFORM`, `process.env.E2E_WEB_UI_ORIGIN`, existing `resolveUiPageUrl`
- Produces:
  - `export const DEFAULT_WEB_UI_ORIGIN = 'http://localhost:30000/'`
  - `export function resolveWebUiOrigin(): string` — `E2E_WEB_UI_ORIGIN` wins (normalize trailing `/`), else `DEFAULT_WEB_UI_ORIGIN`
  - When `os === 'general'` and `E2E_PLATFORM === 'web'`, base URL is `resolveWebUiOrigin()` (same priority style as docker)

- [ ] **Step 1: Extend `withEnv` and add failing tests**

In `apps/e2e/test/lib/ui-page-url.test.ts`, extend `withEnv` overrides to include `E2E_WEB_UI_ORIGIN?: string | undefined` (save/restore like docker origin).

Add:

```ts
import { DEFAULT_WEB_UI_ORIGIN, resolveUiPageUrl, resolveWebUiOrigin } from './ui-page-url.ts';

test('web platform uses localhost:30000 when os is general', () => {
  withEnv({ SMM_AUTH_TOKEN: undefined, E2E_PLATFORM: 'web', E2E_WEB_UI_ORIGIN: undefined }, () => {
    expect(resolveUiPageUrl()).toBe(DEFAULT_WEB_UI_ORIGIN);
    expect(resolveUiPageUrl(undefined, 'general')).toBe(DEFAULT_WEB_UI_ORIGIN);
  });
});

test('web platform appends token', () => {
  withEnv({ SMM_AUTH_TOKEN: 'ChangeMe123', E2E_PLATFORM: 'web' }, () => {
    expect(resolveUiPageUrl()).toBe(`${DEFAULT_WEB_UI_ORIGIN}?token=ChangeMe123`);
  });
});

test('E2E_WEB_UI_ORIGIN overrides default web origin', () => {
  withEnv(
    {
      SMM_AUTH_TOKEN: undefined,
      E2E_PLATFORM: 'web',
      E2E_WEB_UI_ORIGIN: 'http://127.0.0.1:30000',
    },
    () => {
      expect(resolveWebUiOrigin()).toBe('http://127.0.0.1:30000/');
      expect(resolveUiPageUrl()).toBe('http://127.0.0.1:30000/');
    },
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test apps/e2e/test/lib/ui-page-url.test.ts`

Expected: FAIL — `DEFAULT_WEB_UI_ORIGIN` / `resolveWebUiOrigin` missing, or web still resolves Vite `:8000`.

- [ ] **Step 3: Implement**

In `apps/e2e/test/lib/ui-page-url.ts`:

```ts
export const DEFAULT_WEB_UI_ORIGIN = 'http://localhost:30000/'

export function resolveWebUiOrigin(): string {
  const fromEnv = process.env.E2E_WEB_UI_ORIGIN?.trim()
  if (!fromEnv) {
    return DEFAULT_WEB_UI_ORIGIN
  }
  return fromEnv.endsWith('/') ? fromEnv : `${fromEnv}/`
}

function defaultBaseUrlForOs(os: TestbedOs): string {
  if (os === 'HarmonyOS') {
    return HARMONYOS_UI_ORIGIN
  }
  if (process.env.E2E_PLATFORM === 'docker') {
    return resolveDockerUiOrigin()
  }
  if (process.env.E2E_PLATFORM === 'web') {
    return resolveWebUiOrigin()
  }
  return `http://localhost:${readUiDevServerPort()}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test apps/e2e/test/lib/ui-page-url.test.ts`

Expected: PASS

- [ ] **Step 5: Commit** (if user authorized commits for this plan)

```bash
git add apps/e2e/test/lib/ui-page-url.ts apps/e2e/test/lib/ui-page-url.test.ts
git commit -m "feat(e2e): resolve UI origin for E2E_PLATFORM=web"
```

---

### Task 2: `wait-for-web-e2e-ready.ts`

**Files:**
- Create: `ci/wait-for-web-e2e-ready.ts`

**Interfaces:**
- Consumes: `process.env.E2E_WEB_UI_ORIGIN`, `process.env.SMM_AUTH_TOKEN`
- Produces: process exit 0 when `GET {origin}api/hello` returns OK with Bearer auth; exit 1 on timeout

- [ ] **Step 1: Create the wait script**

Copy structure from `ci/wait-for-docker-e2e-ready.ts`, but:

```ts
/**
 * Polls host-served SMM (cli --staticDir) until /api/hello responds.
 * Used as the first apps/cicd task for --platform web (no Vite UI wait).
 *
 * Base origin: `E2E_WEB_UI_ORIGIN` (default `http://localhost:30000/`).
 */
function resolveReadyUrl(): string {
  const origin = (process.env.E2E_WEB_UI_ORIGIN?.trim() || 'http://localhost:30000/').replace(
    /\/?$/,
    '/',
  );
  return new URL('api/hello', origin).toString();
}
```

Log prefix: `[wait-for-web-e2e-ready]`. Same `waitForHttp` loop (120s timeout, Bearer `SMM_AUTH_TOKEN ?? 'ChangeMe123'`).

- [ ] **Step 2: Smoke the module loads**

Run: `bun -e "await import('./ci/wait-for-web-e2e-ready.ts')"`  

(Do not leave it running against a dead port in CI of this plan — implementation only; full wait is covered when Task 3 wires the config.)

Alternatively skip smoke if import executes `main()` immediately (it does). Then only verify with:

Run: `bun --print "1"` and rely on Task 3 integration; **or** temporarily run against nothing and expect exit 1 quickly is too slow (120s). Prefer: no long smoke; Task 3 unit test asserts the command string.

- [ ] **Step 3: Commit** (if authorized)

```bash
git add ci/wait-for-web-e2e-ready.ts
git commit -m "feat(ci): add wait-for-web-e2e-ready for --platform web"
```

---

### Task 3: `buildWebConfig` + platform wiring

**Files:**
- Modify: `ci/run-e2e-test-lib.ts`
- Modify: `ci/run-e2e-test.test.ts`
- Modify: `ci/run-e2e-test.ts` (file header usage comment only)

**Interfaces:**
- Consumes: `Platform`, `ROOT`, `E2E_ROOT`, `normalizeSpecPath`, `assignE2eLocalPortEnv` (optional; web uses fixed 30000 — do **not** require UI_PORT)
- Produces:
  - `Platform` includes `'web'`
  - `buildWebConfig(specs: string[]): CicdConfig`
  - `buildConfig('web', specs)` → `buildWebConfig`
  - `requireSpecsForPlatform('web', [])` throws (same as docker)
  - `assertSpecsMatchPlatform` treats `web` like desktop/docker (reject ohos/electron exclusives)

CLI binary command (cross-platform):

```ts
function resolveWebCliCommand(): string {
  const binName = process.platform === 'win32' ? 'cli.exe' : 'cli';
  const cliBin = path.join(ROOT, 'apps', 'cli', 'dist', binName);
  const staticDir = path.join(ROOT, 'apps', 'ui', 'dist');
  // Quote paths for spaces; cicd runs via shell on Windows bash.
  return `"${cliBin}" --staticDir "${staticDir}" --port 30000`;
}
```

Background env must include auth on the process — set in `config.env` so cicd injects into background:

```ts
SMM_AUTH_ENABLED: 'true',
SMM_AUTH_TOKEN: process.env.SMM_AUTH_TOKEN ?? 'ChangeMe123',
```

- [ ] **Step 1: Write the failing tests**

Add to `ci/run-e2e-test.test.ts`:

```ts
describe('run-e2e-test web platform', () => {
  test('parseArgv accepts --platform web with --spec', () => {
    const parsed = parseArgv([
      '--platform',
      'web',
      '--spec',
      './common/config/ConfigDialog-Settings.e2e.ts',
    ]);
    expect(parsed.platform).toBe('web');
  });

  test('web without --spec is rejected by requireSpecsForPlatform', () => {
    const { platform, patterns } = parseArgv(['--platform', 'web']);
    expect(() => requireSpecsForPlatform(platform, patterns)).toThrow(/web requires/);
  });

  test('assertSpecsMatchPlatform rejects ohos specs on web', () => {
    expect(() => assertSpecsMatchPlatform('web', ['ohos/layout.e2e.ts'])).toThrow(
      /ohos|platform-specific/,
    );
  });

  test('buildConfig web uses cli --staticDir background and no Vite', () => {
    const config = buildConfig('web', ['common/config/ConfigDialog-Settings.e2e.ts']);
    expect(config.name).toBe('smm-e2e-web');
    expect(config.env.E2E_PLATFORM).toBe('web');
    expect(config.env.SMM_AUTH_ENABLED).toBe('true');
    expect(config.env.BROWSER_LOG_ENABLED).toBe('true');
    expect(config.env.NETWORK_LOG_ENABLED).toBe('true');
    expect(config.background).toHaveLength(1);
    expect(config.background[0]!.name).toBe('cli');
    expect(config.background[0]!.command).toContain('--staticDir');
    expect(config.background[0]!.command).toContain('--port 30000');
    expect(config.background[0]!.command).not.toContain('dev:ui');
    expect(config.background.some((b) => b.command.includes('dev:ui'))).toBe(false);
    expect(config.tasks[0]!.command).toContain('wait-for-web-e2e-ready');
    expect(config.tasks.some((t) => t.command.includes('pnpm wdio') && !t.command.includes('wdio:docker'))).toBe(true);
    expect(config.afterEach[0]!.command).toContain('collect-wdio-report');
  });

  test('buildConfig web forwards E2E_WEB_UI_ORIGIN', () => {
    const prev = process.env.E2E_WEB_UI_ORIGIN;
    process.env.E2E_WEB_UI_ORIGIN = 'http://127.0.0.1:30000/';
    try {
      const config = buildConfig('web', ['common/config/ConfigDialog-Settings.e2e.ts']);
      expect(config.env.E2E_WEB_UI_ORIGIN).toBe('http://127.0.0.1:30000/');
    } finally {
      if (prev === undefined) delete process.env.E2E_WEB_UI_ORIGIN;
      else process.env.E2E_WEB_UI_ORIGIN = prev;
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test ci/run-e2e-test.test.ts`

Expected: FAIL — `web` not a valid platform / `buildWebConfig` missing.

- [ ] **Step 3: Implement `buildWebConfig` and wire platform**

In `ci/run-e2e-test-lib.ts`:

1. `export type Platform = 'desktop' | 'ohos' | 'electron' | 'docker' | 'web';`
2. Add `'web'` to `PLATFORMS`.
3. Update `USAGE` string to include `web`.
4. `requireSpecsForPlatform`: also reject empty patterns for `web` (message `/web requires/`).
5. `defaultPatternsForPlatform`: for `web`, throw same style as docker (require `--spec`).
6. `assertSpecsMatchPlatform`: keep desktop+docker+web on the shared exclusive-rejection branch (comment update).
7. Add `buildWebConfig` + dispatch in `buildConfig`.

```ts
export function buildWebConfig(specs: string[]): CicdConfig {
  const env: Record<string, string> = {
    E2E_PLATFORM: 'web',
    BROWSER_LOG_ENABLED: 'true',
    NETWORK_LOG_ENABLED: 'true',
    SMM_AUTH_ENABLED: 'true',
    SMM_AUTH_TOKEN: process.env.SMM_AUTH_TOKEN ?? 'ChangeMe123',
  };
  if (process.env.EXTERNAL_CONFIG_FILE_URL) {
    env.EXTERNAL_CONFIG_FILE_URL = process.env.EXTERNAL_CONFIG_FILE_URL;
  }
  if (process.env.E2E_WEB_UI_ORIGIN?.trim()) {
    env.E2E_WEB_UI_ORIGIN = process.env.E2E_WEB_UI_ORIGIN.trim();
  }
  // Forward media DB keys like docker when present (optional).
  if (process.env.TMDB_API_KEY?.trim()) env.TMDB_API_KEY = process.env.TMDB_API_KEY.trim();
  if (process.env.TVDB_API_KEY?.trim()) env.TVDB_API_KEY = process.env.TVDB_API_KEY.trim();

  return {
    name: 'smm-e2e-web',
    outputDir: './artifacts/cicd',
    env,
    background: [
      {
        name: 'cli',
        command: resolveWebCliCommand(),
        cwd: ROOT,
      },
    ],
    tasks: [
      { name: 'wait-ready', command: 'bun ci/wait-for-web-e2e-ready.ts', cwd: ROOT },
      ...specs.map((spec) => ({
        name: path.posix.basename(spec),
        command: `pnpm wdio --spec ./${normalizeSpecPath(spec)}`,
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

Update `ci/run-e2e-test.ts` header comment to list `--platform web`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test ci/run-e2e-test.test.ts`

Expected: PASS

- [ ] **Step 5: Commit** (if authorized)

```bash
git add ci/run-e2e-test-lib.ts ci/run-e2e-test.test.ts ci/run-e2e-test.ts
git commit -m "feat(ci): add --platform web for built cli+ui e2e"
```

---

### Task 4: CI window size for `web` + workflow

**Files:**
- Modify: `apps/e2e/test/lib/e2e-window-size.ts`
- Modify: `apps/e2e/wdio.conf.test.ts` (or existing window-size tests if present) — only if tests assert `BUILD_ENV=docker`; add `E2E_PLATFORM=web` case
- Modify: `.github/workflows/e2e-web-ui.yml`

**Interfaces:**
- Consumes: `process.env.E2E_PLATFORM`, `process.env.CI`
- Produces: `shouldFitE2eWindowToScreen()` returns `false` when `CI === 'true' && E2E_PLATFORM === 'web'` (same fixed 1920×1080 behavior previously obtained via `BUILD_ENV=docker`)

- [ ] **Step 1: Update window-size policy**

In `apps/e2e/test/lib/e2e-window-size.ts`, extend the early return that skips fit-to-screen:

```ts
if (process.env.BUILD_ENV === 'docker') {
  return false
}
if (process.env.CI === 'true' && process.env.E2E_PLATFORM === 'web') {
  return false
}
if (process.env.CI === 'true' && process.env.E2E_PLATFORM === 'electron') {
  return false
}
```

Add/adjust unit test in `apps/e2e/wdio.conf.test.ts` (or the file that already tests `shouldFitE2eWindowToScreen`) for `E2E_PLATFORM=web` + `CI=true` → no fit.

- [ ] **Step 2: Run window-size related tests**

Run: `bun test apps/e2e/wdio.conf.test.ts`

Expected: PASS

- [ ] **Step 3: Update `e2e-web-ui.yml`**

1. Header comments: built CLI serves static UI; `--platform web`; not Vite.
2. After `pnpm install` / require secrets / Chrome setup, add:

```yaml
      - name: Build CLI
        run: pnpm --filter cli run build

      - name: Build UI
        run: pnpm --filter ui run build
```

3. Change Run Web UI e2e to:

```yaml
      - name: Run Web UI e2e
        id: e2e
        run: |
          set -euo pipefail
          bun ci/run-e2e-test.ts --platform web --spec "./common/config/*.e2e.ts"
          bun ci/run-e2e-test.ts --platform web --spec "./common/movie/*.e2e.ts"
          bun ci/run-e2e-test.ts --platform web --spec "./common/music/*.e2e.ts"
          bun ci/run-e2e-test.ts --platform web --spec "./common/other/*.e2e.ts"
          bun ci/run-e2e-test.ts --platform web --spec "./common/tv/*.e2e.ts"
          bun ci/run-e2e-test.ts --platform web --spec "./common/tvdb/*.e2e.ts"
        env:
          CHROME_BIN: ${{ steps.setup-chrome.outputs.chrome-path || steps.runner-chrome.outputs.chrome-path }}
          CHROMEDRIVER: ${{ steps.setup-chrome.outputs.chromedriver-path }}
```

Remove `BUILD_ENV: docker` from that step.

- [ ] **Step 4: Typecheck / unit verify**

Run:

```bash
bun test ci/run-e2e-test.test.ts apps/e2e/test/lib/ui-page-url.test.ts apps/e2e/wdio.conf.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit** (if authorized)

```bash
git add apps/e2e/test/lib/e2e-window-size.ts apps/e2e/wdio.conf.test.ts .github/workflows/e2e-web-ui.yml
git commit -m "ci: run Web UI e2e against --platform web"
```

---

### Task 5: Local smoke (optional but recommended before dispatch)

**Files:** none (manual)

- [ ] **Step 1: Build artifacts**

```bash
pnpm --filter cli run build
pnpm --filter ui run build
```

- [ ] **Step 2: Run one short config spec**

```bash
bun ci/run-e2e-test.ts --platform web --spec "./common/config/ConfigDialog-Settings.e2e.ts"
```

Expected:
- cicd background `cli` command contains `--staticDir` and `--port 30000`
- wait-ready succeeds against `:30000`
- network log has no `@vite/client` / `/src/main.tsx`

- [ ] **Step 3: Dispatch `e2e-web-ui.yml` on GitHub** and confirm the same acceptance signals on a matrix job.

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| `--platform web` + `buildWebConfig` | Task 3 |
| Single `cli --staticDir` background, port 30000 | Task 3 |
| Wait `/api/hello` only (no Vite wait) | Task 2 + 3 |
| `resolveUiPageUrl` for web + `E2E_WEB_UI_ORIGIN` | Task 1 |
| `e2e-web-ui.yml` builds + `--platform web`, drop `BUILD_ENV: docker` | Task 4 |
| Keep `desktop` / host-e2e unchanged | Global Constraints |
| CI window size without `BUILD_ENV=docker` | Task 4 |
| Unit tests for parse/config/URL | Tasks 1, 3 |
| Acceptance: no Vite in logs | Task 5 |

## Placeholder / consistency self-review

- No TBD steps; CLI path helper named `resolveWebCliCommand` consistently.
- WDIO decision locked: reuse `pnpm wdio`.
- Origin env locked: `E2E_WEB_UI_ORIGIN` (not reuse `E2E_DOCKER_UI_ORIGIN`).
