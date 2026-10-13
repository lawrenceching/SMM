# MCP remote e2e Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `TARGET=remote` MCP Vitest suites call the remote Docker/SMM MCP at `MCP_SERVER_ADDRESS` (no local `cli mcp start`), seeding media via `docker cp` to `/tmp` and config/metadata via HTTP APIs.

**Architecture:** Branch `useMcpServer` on `TARGET`. Add Node-side HTTP helpers (Bearer) and a `docker cp` media helper. Adapt fixture helpers used by tool tests so remote paths are container `/tmp/<runId>/...`. Skip CLI-only lifecycle tests under remote. Keep `dev`/`cli` spawn behavior unchanged.

**Tech Stack:** Vitest, Bun/`node:child_process` for `docker`, fetch for HTTP, existing MCP Inspector client.

**Spec:** `docs/superpowers/specs/2026-10-13-mcp-remote-e2e-design.md`

## Global Constraints

- `TARGET=remote` must never spawn `apps/cli/dist` for tool suites.
- Media under test lives at container path `/tmp/<runId>/...` after `docker cp`.
- Config/metadata seeding uses HTTP + `SMM_AUTH_TOKEN`, not host writes into container config dirs.
- `SMM_DOCKER_CONTAINER` defaults to `smm`.
- `dev` / `cli` behavior and local temp-dir fixtures stay as today.

## File map

| File | Responsibility |
|------|----------------|
| `apps/e2e/mcp/lib/remoteHttp.ts` | Node fetch to remote HTTP API with Bearer |
| `apps/e2e/mcp/lib/remoteDocker.ts` | `docker cp` / `docker exec rm` for `/tmp/<runId>` |
| `apps/e2e/mcp/lib/useMcpServer.ts` | Branch local spawn vs remote attach |
| `apps/e2e/mcp/lib/testSetup.ts` | Remote-aware seed helpers (or thin wrappers) |
| `apps/e2e/mcp/lib/remoteHttp.test.ts` | Unit tests for HTTP helpers (mocked fetch) |
| `apps/e2e/mcp/lib/remoteDocker.test.ts` | Unit tests for path builders / command assembly |
| `apps/e2e/mcp/start-stop-mcp-server-in-cli.test.ts` | Skip when remote |
| Tool tests using host `existsSync` / local dirs | Assert via remote helpers or docker when `TARGET=remote` |
| `apps/e2e/mcp/README.md` | Document remote env + `docker cp` flow |
| `apps/e2e/package.json` | Document `SMM_DOCKER_CONTAINER` in `test:mcp:remote` if needed |

---

### Task 1: Remote HTTP client helpers

**Files:**
- Create: `apps/e2e/mcp/lib/remoteHttp.ts`
- Create: `apps/e2e/mcp/lib/remoteHttp.test.ts`

**Interfaces:**
- Consumes: `HTTP_SERVER_ADDRESS`, `SMM_AUTH_TOKEN` (or explicit args)
- Produces:
  - `remoteAuthHeaders(authToken: string, extra?: Record<string, string>): Record<string, string>`
  - `fetchRemoteHello(httpBase: string, authToken: string): Promise<{ userDataDir: string; appDataDir: string; tmpDir?: string }>`
  - `patchRemoteUserConfigFolders(httpBase: string, authToken: string, folders: string[]): Promise<void>` — uses `POST /api/patchUserConfig` with JSON Patch replacing `/folders`
  - `createRemoteMetadata(httpBase: string, authToken: string, data: MediaMetadata): Promise<void>` — `POST /api/create-metadata` body `{ data }`
  - `setRemoteMetadata(httpBase: string, authToken: string, path: string, patch: object): Promise<void>` — `POST /api/set-metadata`
  - `deleteRemoteMetadata(httpBase: string, authToken: string, path: string): Promise<void>` — `POST /api/delete-metadata`
  - `writeRemoteMediaMetadata(httpBase: string, authToken: string, data: MediaMetadata): Promise<void>` — get-or-create pattern like testbed (`get` then create/set)

- [ ] **Step 1: Write failing unit tests** for `patchRemoteUserConfigFolders` and `createRemoteMetadata` (mock `fetch`).

```ts
// apps/e2e/mcp/lib/remoteHttp.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRemoteMetadata, patchRemoteUserConfigFolders } from './remoteHttp'

describe('remoteHttp', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('patchRemoteUserConfigFolders posts JSON Patch with Bearer', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { folders: ['/tmp/x'] }, error: null }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await patchRemoteUserConfigFolders('http://127.0.0.1:30000', 'tok', ['/tmp/x'])

    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://127.0.0.1:30000/api/patchUserConfig')
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: 'Bearer tok',
        'Content-Type': 'application/json',
      },
    })
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body.patch).toEqual([{ op: 'replace', path: '/folders', value: ['/tmp/x'] }])
  })

  it('createRemoteMetadata posts data payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { mediaFolderPath: '/tmp/x' } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await createRemoteMetadata('http://127.0.0.1:30000', 'tok', {
      mediaFolderPath: '/tmp/x',
      type: 'movie-folder',
    } as never)

    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://127.0.0.1:30000/api/create-metadata')
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL** (module missing)

Run: `pnpm --filter e2e exec vitest run --config vitest.mcp.config.ts mcp/lib/remoteHttp.test.ts`

Expected: FAIL cannot find module `./remoteHttp`

- [ ] **Step 3: Implement `remoteHttp.ts`**

Use trailing-slash-safe base URL. On non-OK or `{ error }` body, throw with status/body snippet. For metadata create/get/set, follow `apps/cli/docs/MediaMetadataAPI.md` (problem+json on 4xx for metadata routes — check `!resp.ok`).

For `patchUserConfig`, prefer replace `/folders` (simplest for tests). If replace fails against empty config, fall back to documented patch ops used elsewhere in e2e (`browser-fs` / UI).

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/e2e/mcp/lib/remoteHttp.ts apps/e2e/mcp/lib/remoteHttp.test.ts
git commit -m "test(e2e): add remote HTTP helpers for MCP remote fixtures"
```

---

### Task 2: Docker cp media helper

**Files:**
- Create: `apps/e2e/mcp/lib/remoteDocker.ts`
- Create: `apps/e2e/mcp/lib/remoteDocker.test.ts`

**Interfaces:**
- Consumes: `SMM_DOCKER_CONTAINER` (default `smm`)
- Produces:
  - `resolveDockerContainerName(): string`
  - `newRemoteRunId(): string` — e.g. `smm-mcp-${Date.now()}-${random}`
  - `containerTmpRoot(runId: string): string` — returns `/tmp/${runId}`
  - `dockerCpDirToContainer(opts: { container: string; hostDir: string; containerDir: string }): Promise<void>`
  - `dockerRmContainerPath(opts: { container: string; containerPath: string }): Promise<void>`
  - `dockerPathExists(opts: { container: string; containerPath: string }): Promise<boolean>` — `docker exec test -e`

Implementation notes:

- Use `spawn`/`Bun.spawn` with `docker` argv array (no shell).
- `dockerCpDirToContainer`: ensure parent exists (`docker exec mkdir -p`), then `docker cp ${hostDir}/. ${container}:${containerDir}/` (trailing semantics per Docker docs).
- Throw on non-zero exit with combined stderr.

- [ ] **Step 1: Write unit tests** for pure helpers (`resolveDockerContainerName`, `containerTmpRoot`) and mock/spy spawn for `dockerCpDirToContainer` if easy; otherwise test path joining only and one integration-style test skipped without docker.

```ts
import { describe, expect, it, afterEach, vi } from 'vitest'
import { containerTmpRoot, resolveDockerContainerName } from './remoteDocker'

describe('remoteDocker', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('resolveDockerContainerName defaults to smm', () => {
    vi.stubEnv('SMM_DOCKER_CONTAINER', '')
    expect(resolveDockerContainerName()).toBe('smm')
  })

  it('resolveDockerContainerName reads env', () => {
    vi.stubEnv('SMM_DOCKER_CONTAINER', 'my-smm')
    expect(resolveDockerContainerName()).toBe('my-smm')
  })

  it('containerTmpRoot nests under /tmp', () => {
    expect(containerTmpRoot('run-1')).toBe('/tmp/run-1')
  })
})
```

- [ ] **Step 2: Run — FAIL missing module**

- [ ] **Step 3: Implement `remoteDocker.ts`**

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/e2e/mcp/lib/remoteDocker.ts apps/e2e/mcp/lib/remoteDocker.test.ts
git commit -m "test(e2e): add docker cp helpers for remote MCP media fixtures"
```

---

### Task 3: Branch `useMcpServer` for remote attach

**Files:**
- Modify: `apps/e2e/mcp/lib/useMcpServer.ts`
- Modify: `apps/e2e/mcp/lib/context.ts` if needed to export a shared `isRemoteTarget()` helper (optional; can read `process.env.TARGET` in useMcpServer)
- Test: extend or add `apps/e2e/mcp/lib/useMcpServer.remote.test.ts` that stubs env + hello fetch and asserts `startMcpServer` is not called (vi.mock `./mcpServer`)

**Interfaces:**
- Consumes: Task 1 `fetchRemoteHello`; env `TARGET`, `MCP_SERVER_ADDRESS`, `HTTP_SERVER_ADDRESS`, `SMM_AUTH_TOKEN`
- Produces: `McpTestContext` with at least:
  - `url: string`
  - `userDataDir: string`
  - `appDataDir: string`
  - `isRemote: boolean`
  - `httpServerAddress?: string`
  - `authToken?: string`
  - `containerName?: string`
  - `server?: McpServerHandle` — only for local; remote `stop` is no-op or cleanup hook registry

- [ ] **Step 1: Write failing test** — when `TARGET=remote`, mocked `startMcpServer` must not be invoked; `ctx.url` equals `MCP_SERVER_ADDRESS`.

```ts
vi.mock('./mcpServer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./mcpServer')>()
  return {
    ...actual,
    startMcpServer: vi.fn(async () => {
      throw new Error('startMcpServer must not be called for remote')
    }),
  }
})
```

Use Vitest `beforeAll` by importing a test-only export `attachMcpServerForTests()` **or** call the same logic extracted as `resolveMcpTestContext(): Promise<McpTestContext>` so unit tests don't need full Vitest hooks. Prefer extracting:

```ts
export async function createMcpTestContext(): Promise<McpTestContext & { stop: () => Promise<void> }>
export function useMcpServer(): McpTestContext // hooks call createMcpTestContext
```

- [ ] **Step 2: Run — FAIL** (still always spawns / missing export)

- [ ] **Step 3: Implement branch**

```ts
if (process.env.TARGET === 'remote') {
  const url = process.env.MCP_SERVER_ADDRESS!
  const http = process.env.HTTP_SERVER_ADDRESS!
  const token = process.env.SMM_AUTH_TOKEN!
  const hello = await fetchRemoteHello(http, token)
  return {
    url,
    userDataDir: hello.userDataDir,
    appDataDir: hello.appDataDir,
    isRemote: true,
    httpServerAddress: http,
    authToken: token,
    containerName: resolveDockerContainerName(),
    stop: async () => {},
  }
}
// else existing startMcpServer()
```

- [ ] **Step 4: Run unit test PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/e2e/mcp/lib/useMcpServer.ts apps/e2e/mcp/lib/useMcpServer.remote.test.ts
git commit -m "fix(e2e): attach remote MCP URL instead of spawning local CLI"
```

---

### Task 4: Remote fixture seeding API on testSetup

**Files:**
- Modify: `apps/e2e/mcp/lib/testSetup.ts`
- Create: `apps/e2e/mcp/lib/remoteFixtures.ts` (preferred: keep docker/http orchestration out of giant testSetup)
- Test: `apps/e2e/mcp/lib/remoteFixtures.test.ts` with mocked docker + http

**Interfaces:**
- Consumes: Task 1 + Task 2 helpers; `setupTestMediaFolders` local materialize
- Produces:
  - `seedRemoteMediaFolder(opts): Promise<{ containerPath: string; runId: string; cleanup: () => Promise<void> }>`
    1. `setupTestMediaFolders()` + `materialize(folder)` on host
    2. `runId = newRemoteRunId()`; `containerDir = containerTmpRoot(runId) + '/' + folder.folderName` (or copy whole mediaDir under `/tmp/runId/media`)
    3. `dockerCpDirToContainer`
    4. Return container posix path for the folder
    5. `cleanup`: host `media.cleanup()` + `dockerRmContainerPath(/tmp/runId)`
  - `seedRemoteRecognizedFolder(ctx, folder, ...): Promise<{ path: string; cleanup }>` — docker media + `patchRemoteUserConfigFolders` + `writeRemoteMediaMetadata` with `mediaFolderPath` = container path

Recommended layout after copy:

```
/tmp/<runId>/media/<folderName>/...
```

MCP `path` args = `/tmp/<runId>/media/<folderName>`.

- [ ] **Step 1: Failing unit test** for path construction / that seed calls dockerCp + patchUserConfig (mocks)

- [ ] **Step 2: Implement `remoteFixtures.ts`**

- [ ] **Step 3: PASS unit tests**

- [ ] **Step 4: Commit**

```bash
git add apps/e2e/mcp/lib/remoteFixtures.ts apps/e2e/mcp/lib/remoteFixtures.test.ts
git commit -m "test(e2e): remote media docker cp + HTTP metadata seeding"
```

---

### Task 5: Skip CLI lifecycle under remote + wire tool tests to remote fixtures

**Files:**
- Modify: `apps/e2e/mcp/start-stop-mcp-server-in-cli.test.ts` — top-level `describe.skipIf(process.env.TARGET === 'remote')`
- Modify tool tests that call `writeUserConfig` / `seedMediaMetadata` / host `existsSync`:
  - `rename-folder.test.ts`
  - `get-job.test.ts`
  - `scrape.test.ts`
  - `get-media-folders.test.ts`
  - `get-media-metadata.test.ts`
  - `get-episode.test.ts`
  - `get-episodes.test.ts`
  - `is-folder-exist.test.ts`
  - `list-files.test.ts`
  - any other file using `ctx.userDataDir` for writes

**Pattern for each test file:**

```ts
const ctx = useMcpServer()

async function seedForTarget(...) {
  if (ctx.isRemote) {
    return seedRemoteRecognizedFolder({
      httpServerAddress: ctx.httpServerAddress!,
      authToken: ctx.authToken!,
      containerName: ctx.containerName!,
    }, folder, ...)
  }
  // existing local seed
}
```

For assertions that used `existsSync(hostPath)` after rename:

```ts
if (ctx.isRemote) {
  expect(await dockerPathExists({ container: ctx.containerName!, containerPath: newPath })).toBe(true)
} else {
  expect(existsSync(newPath)).toBe(true)
}
```

For metadata cache file reads on disk under remote: use `POST /api/get-metadata` instead of reading `appDataDir` files.

TMDB-only / readme / tools-list / get-app-context: usually no change beyond remote URL (already via `ctx.url`).

- [ ] **Step 1: Apply skipIf to CLI lifecycle test**

- [ ] **Step 2: Update filesystem-dependent tests to branch seed/assert**

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter e2e typecheck`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/e2e/mcp
git commit -m "fix(e2e): seed remote MCP fixtures via docker cp and HTTP APIs"
```

---

### Task 6: Docs + package script env note

**Files:**
- Modify: `apps/e2e/mcp/README.md`
- Modify: `apps/e2e/package.json` `test:mcp:remote` — optionally pass through `SMM_DOCKER_CONTAINER` (no required change if env is inherited)

- [ ] **Step 1: Document** remote requirements: running container, ports, auth, `SMM_DOCKER_CONTAINER`, that tool tests hit remote MCP, media via `docker cp` to `/tmp`.

- [ ] **Step 2: Commit**

```bash
git add apps/e2e/mcp/README.md apps/e2e/package.json
git commit -m "docs(e2e): document remote MCP e2e docker cp workflow"
```

---

### Task 7: Manual verification against Docker

**Prereq:** `smm` container running with ports `30000`/`30001`, auth token matching script.

- [ ] **Step 1: Run**

```bash
cd apps/e2e
pnpm test:mcp:remote
```

Expected: tests pass (or only intentional skips); **no** local `cli mcp start` for tool files.

- [ ] **Step 2: Check container logs**

```bash
docker logs smm 2>&1 | grep '"source":"mcp"'
```

Expected: at least one line with `"msg":"access","source":"mcp"`.

- [ ] **Step 3: Confirm local target still works** (smoke)

```bash
pnpm --filter e2e exec vitest run --config vitest.mcp.config.ts mcp/tools-list.test.ts mcp/readme.test.ts
```

(With `TARGET` unset/dev — may need entrypoint; or set `TARGET=cli` after ensuring binary exists.)

- [ ] **Step 4: Commit any verification fixes if needed**

---

## Spec coverage self-check

| Spec requirement | Task |
|------------------|------|
| remote uses `MCP_SERVER_ADDRESS`, no spawn | Task 3 |
| docker cp to `/tmp/<runId>` | Task 2, 4 |
| HTTP config/metadata | Task 1, 4 |
| `SMM_DOCKER_CONTAINER` default `smm` | Task 2 |
| skip CLI start-stop under remote | Task 5 |
| container shows `source=mcp` access | Task 7 |
| dev/cli unchanged | Task 3, 7 |

## Placeholder scan

No TBD / “implement later” steps; APIs named explicitly (`/api/patchUserConfig`, `/api/create-metadata`, `/api/set-metadata`, `/api/delete-metadata`, `/api/get-metadata`, `/api/hello`).
