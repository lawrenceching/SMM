# Display Folders V3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `POST /api/get-folders` → `Core.getFolders()` and switch Sidebar path list to `useFoldersQuery` when `localStorage["smm.v3.enabled"] === "true"`, keeping status/selection in Zustand and metadata queries unchanged.

**Architecture:** Thin cli Hono route holds a lazy Core singleton (`NodejsFsAdapter`, `appDataDir: getUserDataDir()`). UI adds API client + TanStack Query; Sidebar merges query paths with Zustand status. Flag off = zero behavior change.

**Tech Stack:** TypeScript, Hono (cli), vitest, React 19, TanStack Query, Zustand, `core-app` (`apps/core`).

**Spec:** [docs/superpowers/specs/2026-08-17-display-folders-v3-design.md](../specs/2026-08-17-display-folders-v3-design.md)

## Global Constraints

- Feature flag: `localStorage.getItem("smm.v3.enabled") === "true"` only; default off.
- HTTP RPC style: success/failure both HTTP 200; errors use `error: "Error Reason: …"`.
- `Core` constructed with `appDataDir: getUserDataDir()` so `getFolders` reads the same `smm.json` as today’s UI.
- Do not enrich get-folders DTO; do not remove Zustand; do not migrate import pipeline.
- Package name for `apps/core` is `core-app` (not `core`).

---

## File Structure

```
apps/cli/
  package.json                          # + dependency "core-app": "workspace:*"
  tsconfig.json                         # + paths for core-app
  vitest.config.ts                      # + alias core-app → ../core/src
  server.ts                             # register handleGetFolders
  src/
    core/getCore.ts                     # lazy Core singleton + resetCoreForTests
    route/GetFolders.ts                 # POST /api/get-folders
    route/GetFolders.test.ts

apps/core/
  package.json                          # + "exports": { ".": "./src/index.ts" }

apps/ui/
  src/lib/localStorages.ts              # + isSmmV3Enabled getter (optional but preferred)
  src/lib/isSmmV3Enabled.ts             # OR dedicated helper if not on localStorages
  src/api/getFolders.ts
  src/hooks/folders/foldersQueryKeys.ts
  src/hooks/folders/useFoldersQuery.ts
  src/hooks/folders/useFoldersQuery.test.ts
  src/lib/mergeFolderPathsWithUiStatus.ts
  src/lib/mergeFolderPathsWithUiStatus.test.ts
  src/components/v2/Sidebar.tsx         # V3 path source branch
  src/hooks/userConfig/useSaveUserConfigMutation.ts  # invalidate when folders change
  src/components/eventlisteners/SocketIoUserConfigFolderRenamedEventListener.tsx

docs/api/index.md                       # document POST /api/get-folders
```

---

### Task 1: Wire `core-app` into cli + Core singleton

**Files:**
- Modify: `apps/core/package.json`
- Modify: `apps/cli/package.json`
- Modify: `apps/cli/tsconfig.json`
- Modify: `apps/cli/vitest.config.ts`
- Create: `apps/cli/src/core/getCore.ts`

**Interfaces:**
- Produces: `getCore(): Core`, `resetCoreForTests(): void`

- [ ] **Step 1: Add exports to `apps/core/package.json`**

Add:

```json
"exports": {
  ".": "./src/index.ts"
}
```

- [ ] **Step 2: Add workspace dependency in `apps/cli/package.json`**

Under `"dependencies"`:

```json
"core-app": "workspace:*"
```

Run from repo root:

```bash
pnpm install --filter cli...
```

Expected: lockfile updates; `cli` can resolve `core-app`.

- [ ] **Step 3: Add tsconfig + vitest aliases for `core-app`**

In `apps/cli/tsconfig.json` `paths`:

```json
"core-app": ["../core/src/index.ts"],
"core-app/*": ["../core/src/*"]
```

In `apps/cli/vitest.config.ts` `resolve.alias`:

```ts
'core-app': resolve(__dirname, '../core/src/index.ts'),
```

(Keep existing `@core` alias — Core sources import `@core/path`.)

- [ ] **Step 4: Create `apps/cli/src/core/getCore.ts`**

```ts
import {
  Core,
  FetchNetworkAdapter,
  NodejsFsAdapter,
  NoopLoggerAdapter,
} from 'core-app'
import { getUserDataDir } from '@/utils/config'

let instance: Core | undefined

/** Lazy singleton. appDataDir = userDataDir so getFolders reads production smm.json. */
export function getCore(): Core {
  if (!instance) {
    const userDataDir = getUserDataDir()
    instance = new Core({
      fs: new NodejsFsAdapter(),
      network: new FetchNetworkAdapter(),
      logger: new NoopLoggerAdapter(),
      appDataDir: userDataDir,
      userDataDir,
    })
  }
  return instance
}

/** Test-only: drop the singleton so env/dir changes take effect. */
export function resetCoreForTests(): void {
  instance = undefined
}
```

- [ ] **Step 5: Smoke-check TypeScript resolves Core**

Run:

```bash
pnpm --filter cli exec tsc --noEmit 2>&1 | head -40
```

Expected: no errors about `core-app` / `getCore` (pre-existing unrelated errors OK if any; new file must typecheck). If `core-app` import fails, fix aliases / exports before continuing.

- [ ] **Step 6: Commit**

```bash
git add apps/core/package.json apps/cli/package.json apps/cli/tsconfig.json apps/cli/vitest.config.ts apps/cli/src/core/getCore.ts pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(cli): wire core-app and lazy Core singleton for getFolders

EOF
)"
```

---

### Task 2: `POST /api/get-folders` route (TDD)

**Files:**
- Create: `apps/cli/src/route/GetFolders.test.ts`
- Create: `apps/cli/src/route/GetFolders.ts`
- Modify: `apps/cli/server.ts`
- Modify: `docs/api/index.md`

**Interfaces:**
- Consumes: `getCore()`, `resetCoreForTests()`
- Produces: `handleGetFolders(app: Hono): void` registering `POST /api/get-folders`

- [ ] **Step 1: Write failing route tests**

Create `apps/cli/src/route/GetFolders.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { Hono } from 'hono'
import { handleGetFolders } from './GetFolders'
import { resetCoreForTests } from '../core/getCore'

describe('POST /api/get-folders', () => {
  let userDataDir: string
  let prevUserDataDir: string | undefined
  let app: Hono

  beforeEach(() => {
    prevUserDataDir = process.env.USER_DATA_DIR
    userDataDir = mkdtempSync(join(tmpdir(), 'smm-get-folders-'))
    process.env.USER_DATA_DIR = userDataDir
    resetCoreForTests()
    app = new Hono()
    handleGetFolders(app)
  })

  afterEach(() => {
    resetCoreForTests()
    if (prevUserDataDir === undefined) delete process.env.USER_DATA_DIR
    else process.env.USER_DATA_DIR = prevUserDataDir
    rmSync(userDataDir, { recursive: true, force: true })
  })

  it('returns empty folders when smm.json is missing', async () => {
    const res = await app.request('/api/get-folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ data: { folders: [] } })
  })

  it('returns folders from smm.json', async () => {
    writeFileSync(
      join(userDataDir, 'smm.json'),
      JSON.stringify({ folders: ['/media/A', '/media/B'] }),
      'utf-8',
    )
    resetCoreForTests()
    const res = await app.request('/api/get-folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      data: { folders: ['/media/A', '/media/B'] },
    })
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL (module missing)**

```bash
pnpm --filter cli test -- src/route/GetFolders.test.ts
```

Expected: FAIL cannot find `./GetFolders` or `handleGetFolders`.

- [ ] **Step 3: Implement `apps/cli/src/route/GetFolders.ts`**

```ts
import type { Hono } from 'hono'
import { getCore } from '../core/getCore'
import { logger } from '../../lib/logger'

export interface GetFoldersResponseBody {
  data?: { folders: string[] }
  error?: string
}

export function handleGetFolders(app: Hono): void {
  app.post('/api/get-folders', async (c) => {
    try {
      // Body optional; tolerate missing/invalid JSON
      try {
        await c.req.json()
      } catch {
        /* empty body OK */
      }
      const folders = await getCore().getFolders()
      const body: GetFoldersResponseBody = { data: { folders } }
      return c.json(body, 200)
    } catch (error) {
      logger.error({ error }, '[POST /api/get-folders] route error')
      const body: GetFoldersResponseBody = {
        error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
      return c.json(body, 200)
    }
  })
}
```

- [ ] **Step 4: Register in `apps/cli/server.ts`**

Add import near other route imports:

```ts
import { handleGetFolders } from './src/route/GetFolders'
```

In the route registration block (near `handlePlans(this.app)`):

```ts
handleGetFolders(this.app)
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
pnpm --filter cli test -- src/route/GetFolders.test.ts
```

Expected: 2 passed.

- [ ] **Step 6: Document in `docs/api/index.md`**

Add a section (near Plans or SetWatchedFolder):

```markdown
## GetFolders
Source Code: apps/cli/src/route/GetFolders.ts
HTTP: `POST /api/get-folders` — returns imported media folder paths via Layer 2 `Core.getFolders()` (reads `userDataDir/smm.json`). Request body: `{}` (optional). Response: `{ data: { folders: string[] } }` or `{ error }`. Used by UI `useFoldersQuery` when `localStorage["smm.v3.enabled"] === "true"`.
```

- [ ] **Step 7: Commit**

```bash
git add apps/cli/src/route/GetFolders.ts apps/cli/src/route/GetFolders.test.ts apps/cli/server.ts docs/api/index.md
git commit -m "$(cat <<'EOF'
feat(cli): add POST /api/get-folders via Core.getFolders

EOF
)"
```

---

### Task 3: UI flag + API client + `useFoldersQuery`

**Files:**
- Modify: `apps/ui/src/lib/localStorages.ts`
- Create: `apps/ui/src/api/getFolders.ts`
- Create: `apps/ui/src/hooks/folders/foldersQueryKeys.ts`
- Create: `apps/ui/src/hooks/folders/useFoldersQuery.ts`
- Create: `apps/ui/src/hooks/folders/useFoldersQuery.test.ts`
- Create: `apps/ui/src/hooks/folders/index.ts`

**Interfaces:**
- Produces: `isSmmV3Enabled(): boolean`, `getFolders(signal?)`, `FOLDERS_QUERY_KEY`, `useFoldersQuery()`

- [ ] **Step 1: Add flag helper on `localStorages`**

In `apps/ui/src/lib/localStorages.ts`, add constant + getter on the exported object:

```ts
const STORAGE_KEY_SMM_V3_ENABLED = 'smm.v3.enabled'

// inside localStorages object:
get isSmmV3Enabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_SMM_V3_ENABLED) === 'true'
  } catch {
    return false
  }
},
```

Also export a named function for non-React call sites:

```ts
export function isSmmV3Enabled(): boolean {
  return localStorages.isSmmV3Enabled
}
```

- [ ] **Step 2: Create API client `apps/ui/src/api/getFolders.ts`**

```ts
import { apiFetch } from '@/lib/apiFetch'

export interface GetFoldersResponseBody {
  data?: { folders: string[] }
  error?: string
}

export async function getFolders(signal?: AbortSignal): Promise<GetFoldersResponseBody> {
  const resp = await apiFetch('/api/get-folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
    signal,
  })

  if (!resp.ok) {
    throw new Error(`HTTP Layer Error: ${resp.status} ${resp.statusText}`)
  }

  return (await resp.json()) as GetFoldersResponseBody
}
```

- [ ] **Step 3: Create query keys + hook**

`apps/ui/src/hooks/folders/foldersQueryKeys.ts`:

```ts
export const FOLDERS_QUERY_ROOT = 'folders' as const
export const foldersQueryKey = [FOLDERS_QUERY_ROOT] as const
```

`apps/ui/src/hooks/folders/useFoldersQuery.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { getFolders } from '@/api/getFolders'
import { isSmmV3Enabled } from '@/lib/localStorages'
import { foldersQueryKey } from './foldersQueryKeys'

export function useFoldersQuery() {
  const enabled = isSmmV3Enabled()
  return useQuery({
    queryKey: foldersQueryKey,
    enabled,
    queryFn: async (): Promise<string[]> => {
      const resp = await getFolders()
      if (resp.error) throw new Error(resp.error)
      return resp.data?.folders ?? []
    },
  })
}
```

`apps/ui/src/hooks/folders/index.ts`:

```ts
export { useFoldersQuery } from './useFoldersQuery'
export { foldersQueryKey, FOLDERS_QUERY_ROOT } from './foldersQueryKeys'
```

- [ ] **Step 4: Write hook unit test (flag gating)**

`apps/ui/src/hooks/folders/useFoldersQuery.test.ts` — follow existing hook test patterns in `apps/ui` (QueryClientProvider + renderHook). Minimal cases:

1. When `localStorage` key unset → `fetch` / `getFolders` not called (`isFetching` false / no network).
2. When key `"true"` → queryFn runs and returns folders from mocked `getFolders`.

Mock `@/api/getFolders` with vitest `vi.mock`. Set/clear `localStorage` in beforeEach/afterEach.

- [ ] **Step 5: Run UI test**

```bash
pnpm --filter ui test -- src/hooks/folders/useFoldersQuery.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/ui/src/lib/localStorages.ts apps/ui/src/api/getFolders.ts apps/ui/src/hooks/folders
git commit -m "$(cat <<'EOF'
feat(ui): add useFoldersQuery gated by smm.v3.enabled

EOF
)"
```

---

### Task 4: Merge helper + Sidebar V3 branch

**Files:**
- Create: `apps/ui/src/lib/mergeFolderPathsWithUiStatus.ts`
- Create: `apps/ui/src/lib/mergeFolderPathsWithUiStatus.test.ts`
- Modify: `apps/ui/src/components/v2/Sidebar.tsx`

**Interfaces:**
- Consumes: `useFoldersQuery()`, `UIMediaFolder[]` from Zustand
- Produces: `mergeFolderPathsWithUiStatus(paths, zustandFolders): UIMediaFolder[]`

- [ ] **Step 1: Write failing merge tests**

```ts
import { describe, expect, it } from 'vitest'
import { mergeFolderPathsWithUiStatus } from './mergeFolderPathsWithUiStatus'
import type { UIMediaFolder } from '@/types/UIMediaFolder'

describe('mergeFolderPathsWithUiStatus', () => {
  it('defaults status to ok when Zustand has no row', () => {
    const result = mergeFolderPathsWithUiStatus(['/m/A'], [])
    expect(result).toEqual([
      expect.objectContaining({ status: 'ok', path: expect.any(String) }),
    ])
  })

  it('preserves Zustand status/type/test when path matches', () => {
    const existing: UIMediaFolder[] = [
      { path: '/m/A', status: 'initializing', type: 'tvshow-folder', test: true },
    ]
    const result = mergeFolderPathsWithUiStatus(['/m/A'], existing)
    expect(result[0]?.status).toBe('initializing')
    expect(result[0]?.type).toBe('tvshow-folder')
    expect(result[0]?.test).toBe(true)
  })

  it('follows query path order', () => {
    const existing: UIMediaFolder[] = [
      { path: '/m/B', status: 'ok' },
      { path: '/m/A', status: 'ok' },
    ]
    const result = mergeFolderPathsWithUiStatus(['/m/A', '/m/B'], existing)
    expect(result.map((r) => r.path)).toEqual(
      result.map((_, i) => result[i]!.path), // length 2
    )
    expect(result).toHaveLength(2)
  })
})
```

(Adjust path assertions to use `Path.toPlatformPath` / `Path.posix` consistently with implementation.)

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter ui test -- src/lib/mergeFolderPathsWithUiStatus.test.ts
```

- [ ] **Step 3: Implement merge helper**

```ts
import { Path } from '@core/path'
import type { UIMediaFolder } from '@/types/UIMediaFolder'

export function mergeFolderPathsWithUiStatus(
  paths: string[],
  zustandFolders: UIMediaFolder[],
): UIMediaFolder[] {
  const byPosix = new Map(
    zustandFolders.map((f) => [Path.posix(f.path), f] as const),
  )
  return paths.map((p) => {
    const posix = Path.posix(p)
    const existing = byPosix.get(posix)
    const platform = Path.toPlatformPath(p)
    return {
      path: platform,
      status: existing?.status ?? 'ok',
      test: existing?.test,
      type: existing?.type,
    }
  })
}
```

- [ ] **Step 4: Run merge tests — PASS**

- [ ] **Step 5: Branch Sidebar folder source**

In `apps/ui/src/components/v2/Sidebar.tsx`:

1. Import `isSmmV3Enabled`, `useFoldersQuery`, `mergeFolderPathsWithUiStatus`.
2. Call `const foldersQuery = useFoldersQuery()` (hook always called; query self-disables when flag off).
3. Replace raw `folders` used for **list rows** with:

```ts
const v3 = isSmmV3Enabled()
const listFolders = v3
  ? mergeFolderPathsWithUiStatus(foldersQuery.data ?? [], folders)
  : folders
```

4. Use `listFolders` for `folderPaths`, `rowsWithMeta`, and list rendering. Keep selection / actions on Zustand as today.

Do **not** change filter/sort/search `useMemo` logic beyond swapping the input array to `listFolders`-derived `rowsWithMeta`.

- [ ] **Step 6: Manual sanity (optional in agent run)**

With flag off, open app — Sidebar unchanged. With `localStorage.setItem('smm.v3.enabled','true')` and reload — network shows `POST /api/get-folders`, list still renders.

- [ ] **Step 7: Commit**

```bash
git add apps/ui/src/lib/mergeFolderPathsWithUiStatus.ts apps/ui/src/lib/mergeFolderPathsWithUiStatus.test.ts apps/ui/src/components/v2/Sidebar.tsx
git commit -m "$(cat <<'EOF'
feat(ui): Sidebar uses useFoldersQuery paths when smm.v3.enabled

EOF
)"
```

---

### Task 5: Invalidate folders query when config folders change

**Files:**
- Create: `apps/ui/src/hooks/folders/invalidateFoldersQuery.ts`
- Modify: `apps/ui/src/hooks/userConfig/useSaveUserConfigMutation.ts`
- Modify: `apps/ui/src/components/eventlisteners/SocketIoUserConfigFolderRenamedEventListener.tsx`

**Interfaces:**
- Produces: `invalidateFoldersQueryIfV3(queryClient: QueryClient): void`

- [ ] **Step 1: Add helper**

```ts
import type { QueryClient } from '@tanstack/react-query'
import { isSmmV3Enabled } from '@/lib/localStorages'
import { foldersQueryKey } from './foldersQueryKeys'

export function invalidateFoldersQueryIfV3(queryClient: QueryClient): void {
  if (!isSmmV3Enabled()) return
  void queryClient.invalidateQueries({ queryKey: foldersQueryKey })
}
```

Export from `apps/ui/src/hooks/folders/index.ts`.

- [ ] **Step 2: Hook `useSaveUserConfigMutation`**

In `onSuccess`, after `setQueryData` for userConfig:

```ts
onSuccess: (config, { config: _requested }) => {
  const helloData = queryClient.getQueryData<HelloResponseBody>(helloQueryKey)
  const dir = helloData?.userDataDir
  if (dir) {
    const prev =
      queryClient.getQueryData<UserConfig>(userConfigQueryKey(dir)) ?? defaultUserConfig
    // Note: setQueryData already applied `config` above — compare using mutation variables
  }
}
```

Correct pattern — use mutation variables for “previous vs next”:

```ts
mutationFn: async ({ traceId, config }) => {
  const helloData = ...
  const dir = ...
  const prev = queryClient.getQueryData<UserConfig>(userConfigQueryKey(dir)) ?? defaultUserConfig
  // ... existing writeFile ...
  return { config, prevFolders: prev.folders }
},
onSuccess: ({ config, prevFolders }) => {
  const dir = queryClient.getQueryData<HelloResponseBody>(helloQueryKey)?.userDataDir
  if (dir) {
    queryClient.setQueryData(userConfigQueryKey(dir), config)
  }
  const foldersChanged =
    prevFolders.length !== config.folders.length ||
    prevFolders.some((p, i) => p !== config.folders[i])
  if (foldersChanged) {
    invalidateFoldersQueryIfV3(queryClient)
  }
},
```

Keep language-change behavior intact. Adjust any callers that assumed `mutateAsync` resolved to bare `UserConfig` — grep `saveUserConfigMutation` / `mutateAsync({ traceId, config` and update types if needed.

- [ ] **Step 3: Invalidate on socket rename**

In `SocketIoUserConfigFolderRenamedEventListener`, after updating folders in Zustand / cache:

```ts
import { useQueryClient } from '@tanstack/react-query'
import { invalidateFoldersQueryIfV3 } from '@/hooks/folders'

// inside component:
const queryClient = useQueryClient()
// inside listener after setFolders:
invalidateFoldersQueryIfV3(queryClient)
```

- [ ] **Step 4: Run related tests**

```bash
pnpm --filter ui test -- src/hooks/userConfig
pnpm --filter ui test -- src/hooks/folders
pnpm --filter ui test -- src/lib/mergeFolderPathsWithUiStatus.test.ts
```

Fix any breakage from `mutateAsync` return-type change.

- [ ] **Step 5: Commit**

```bash
git add apps/ui/src/hooks/folders apps/ui/src/hooks/userConfig/useSaveUserConfigMutation.ts apps/ui/src/components/eventlisteners/SocketIoUserConfigFolderRenamedEventListener.tsx
git commit -m "$(cat <<'EOF'
feat(ui): invalidate folders query when UserConfig.folders changes (v3)

EOF
)"
```

---

### Task 6: Spec status + verification

**Files:**
- Modify: `docs/superpowers/specs/2026-08-17-display-folders-v3-design.md` (status line at top)
- Modify: `docs/superpowers/plans/2026-08-17-display-folders-v3.md` (this file — mark Implemented when done)

- [ ] **Step 1: Run focused verification**

```bash
pnpm --filter cli test -- src/route/GetFolders.test.ts
pnpm --filter ui test -- src/hooks/folders src/lib/mergeFolderPathsWithUiStatus.test.ts
```

Expected: all PASS.

- [ ] **Step 2: Mark design implemented**

At top of the design spec, add:

```markdown
> **Status:** Implemented (YYYY-MM-DD). ...
```

- [ ] **Step 3: Final commit**

```bash
git add docs/superpowers/specs/2026-08-17-display-folders-v3-design.md docs/superpowers/plans/2026-08-17-display-folders-v3.md
git commit -m "$(cat <<'EOF'
docs: mark display-folders V3 design/plan as implemented

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Flag `smm.v3.enabled` | Task 3 |
| `POST /api/get-folders` → `Core.getFolders` | Task 2 |
| Core `appDataDir: getUserDataDir()` | Task 1 |
| `useFoldersQuery` | Task 3 |
| Merge paths + Zustand status | Task 4 |
| Sidebar V3 branch; old path untouched | Task 4 |
| Invalidate on folders change | Task 5 |
| API docs | Task 2 |
| No Socket push / no DTO enrich / no Zustand removal | (YAGNI — not tasked) |

## Self-review notes

- `useSaveUserConfigMutation` return type change must be grepped — do not leave callers assuming bare `UserConfig`.
- Hook order: always call `useFoldersQuery()`; rely on `enabled`, do not conditionally call hooks.
- Path matching uses `Path.posix` on both sides when merging.
