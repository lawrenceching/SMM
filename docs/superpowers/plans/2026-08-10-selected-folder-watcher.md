# Selected Folder Watcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Watch only the UI's primary `selectedFolder` via `POST /api/setWatchedFolder`, instead of watching all imported folders at CLI startup.

**Architecture:** Remove startup bulk `initializeFolderWatcher(userConfig.folders)`. Add `FolderWatcher.setWatchedFolder` plus a Hono RPC. UI syncs `selectedFolder` changes through a hook modeled on `useRecheckSelectedFolderAvailability` (AbortController for stale requests).

**Tech Stack:** Bun/Hono (CLI), Vitest, React 19 + Zustand (UI), `@core/types`, `apiFetch`.

**Spec:** `docs/superpowers/specs/2026-08-10-selected-folder-watcher-design.md`

## Global Constraints

- Watch **only** `selectedFolder` (not multi-select `selectedFolders`).
- Empty / missing selection → watch nothing (`folderPath: null`).
- CLI startup must **not** watch all `userConfig.folders`.
- Response shape: `{ data: { watchedFolder: string | null }, error?: string }` with HTTP 200 for business outcomes.
- API failures must not roll back UI selection; console error only (no toast).
- Do not change `FOLDER_CONTENT_CHANGED_EVENT` payload or UI listeners.
- Do not persist watched path in userConfig.

---

## File Map

| File | Responsibility |
|------|----------------|
| `packages/core/types.ts` | Request/response types for the RPC |
| `apps/cli/src/services/folderWatcher.ts` | `setWatchedFolder` + test reset helper |
| `apps/cli/src/services/folderWatcher.test.ts` | Unit tests for set/switch/clear |
| `apps/cli/src/route/SetWatchedFolder.ts` | Hono route + process handler |
| `apps/cli/src/route/SetWatchedFolder.test.ts` | HTTP route tests |
| `apps/cli/server.ts` | Register route; remove startup watch-all |
| `docs/api/index.md` | Document the new API |
| `apps/ui/src/api/setWatchedFolder.ts` | UI client for the RPC |
| `apps/ui/src/hooks/initialization/useSyncWatchedFolder.ts` | Effect syncing selection → CLI |
| `apps/ui/src/hooks/initialization/useSyncWatchedFolder.test.tsx` | Hook tests |
| `apps/ui/src/components/initialization/UIMediaFolderStoreInitializer.tsx` | Mount the sync hook |

---

### Task 1: `FolderWatcher.setWatchedFolder` + unit tests

**Files:**
- Modify: `apps/cli/src/services/folderWatcher.ts`
- Create: `apps/cli/src/services/folderWatcher.test.ts`

**Interfaces:**
- Consumes: existing `startWatching` / `stopWatching` / `stopAllWatching` / `getWatchedFolders`
- Produces:
  - `FolderWatcher.setWatchedFolder(folderPath: string | null): void`
  - `resetFolderWatcherForTests(): void` (clears singleton + stops watches)

- [ ] **Step 1: Write the failing tests**

Create `apps/cli/src/services/folderWatcher.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  FolderWatcher,
  getFolderWatcher,
  resetFolderWatcherForTests,
} from './folderWatcher';

describe('FolderWatcher.setWatchedFolder', () => {
  let dirA: string;
  let dirB: string;
  let watcher: FolderWatcher;

  beforeEach(() => {
    resetFolderWatcherForTests();
    dirA = mkdtempSync(join(tmpdir(), 'smm-watch-a-'));
    dirB = mkdtempSync(join(tmpdir(), 'smm-watch-b-'));
    watcher = getFolderWatcher(10);
  });

  afterEach(() => {
    resetFolderWatcherForTests();
    rmSync(dirA, { recursive: true, force: true });
    rmSync(dirB, { recursive: true, force: true });
  });

  it('watches a single folder', () => {
    watcher.setWatchedFolder(dirA);
    expect(watcher.getWatchedFolders().length).toBe(1);
    expect(watcher.isWatching(dirA)).toBe(true);
  });

  it('switches from A to B (stops A, starts B)', () => {
    watcher.setWatchedFolder(dirA);
    watcher.setWatchedFolder(dirB);
    expect(watcher.isWatching(dirA)).toBe(false);
    expect(watcher.isWatching(dirB)).toBe(true);
    expect(watcher.getWatchedFolders().length).toBe(1);
  });

  it('null clears all watches', () => {
    watcher.setWatchedFolder(dirA);
    watcher.setWatchedFolder(null);
    expect(watcher.getWatchedFolders()).toEqual([]);
  });

  it('empty string clears all watches', () => {
    watcher.setWatchedFolder(dirA);
    watcher.setWatchedFolder('');
    expect(watcher.getWatchedFolders()).toEqual([]);
  });

  it('same path twice stays watching once (idempotent)', () => {
    watcher.setWatchedFolder(dirA);
    watcher.setWatchedFolder(dirA);
    expect(watcher.getWatchedFolders().length).toBe(1);
    expect(watcher.isWatching(dirA)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/cli && pnpm vitest run src/services/folderWatcher.test.ts`

Expected: FAIL — `setWatchedFolder` / `resetFolderWatcherForTests` not exported or not defined.

- [ ] **Step 3: Implement `setWatchedFolder` and test reset**

In `apps/cli/src/services/folderWatcher.ts`, add to the class:

```ts
  /**
   * Replace the watched set with at most one folder (UI selectedFolder).
   * Pass null or empty string to stop watching.
   */
  setWatchedFolder(folderPath: string | null): void {
    const target =
      folderPath === null || folderPath.trim() === ''
        ? null
        : folderPath;

    if (target === null) {
      this.stopAllWatching();
      return;
    }

    const targetPosix = Path.posix(target);
    for (const watched of this.getWatchedFolders()) {
      if (watched !== targetPosix) {
        this.stopWatching(watched);
      }
    }
    this.startWatching(target);
  }
```

After `getFolderWatcher`, add:

```ts
/** Test-only: stop watches and drop the singleton. */
export function resetFolderWatcherForTests(): void {
  if (instance) {
    instance.stopAllWatching();
    instance = null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/cli && pnpm vitest run src/services/folderWatcher.test.ts`

Expected: PASS (all 5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/services/folderWatcher.ts apps/cli/src/services/folderWatcher.test.ts
git commit -m "$(cat <<'EOF'
feat(cli): add FolderWatcher.setWatchedFolder for single selection

EOF
)"
```

---

### Task 2: Types + `POST /api/setWatchedFolder` route + remove startup watch-all

**Files:**
- Modify: `packages/core/types.ts` (append near other request/response bodies)
- Create: `apps/cli/src/route/SetWatchedFolder.ts`
- Create: `apps/cli/src/route/SetWatchedFolder.test.ts`
- Modify: `apps/cli/server.ts`
- Modify: `docs/api/index.md`

**Interfaces:**
- Consumes: `getFolderWatcher().setWatchedFolder`, types below
- Produces:
  - `SetWatchedFolderRequestBody` / `SetWatchedFolderResponseBody` in `@core/types`
  - `handleSetWatchedFolder(app: Hono): void`
  - `processSetWatchedFolder(body): Promise<SetWatchedFolderResponseBody>`

- [ ] **Step 1: Add types to `packages/core/types.ts`**

Append:

```ts
export interface SetWatchedFolderRequestBody {
  /** Platform absolute path, or null/empty to stop watching. */
  folderPath: string | null
}

export interface SetWatchedFolderResponseBody {
  data?: {
    /** Requested watch target (null when cleared). Not a guarantee fs.watch is active. */
    watchedFolder: string | null
  }
  error?: string
}
```

- [ ] **Step 2: Write the failing route test**

Create `apps/cli/src/route/SetWatchedFolder.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Hono } from 'hono';
import { handleSetWatchedFolder } from './SetWatchedFolder';
import { getFolderWatcher, resetFolderWatcherForTests } from '../services/folderWatcher';

describe('POST /api/setWatchedFolder', () => {
  let dirA: string;
  let dirB: string;
  let app: Hono;

  beforeEach(() => {
    resetFolderWatcherForTests();
    dirA = mkdtempSync(join(tmpdir(), 'smm-api-watch-a-'));
    dirB = mkdtempSync(join(tmpdir(), 'smm-api-watch-b-'));
    app = new Hono();
    handleSetWatchedFolder(app);
    getFolderWatcher(10);
  });

  afterEach(() => {
    resetFolderWatcherForTests();
    rmSync(dirA, { recursive: true, force: true });
    rmSync(dirB, { recursive: true, force: true });
  });

  it('starts watching the requested folder', async () => {
    const res = await app.request('/api/setWatchedFolder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath: dirA }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.error).toBeUndefined();
    expect(body.data.watchedFolder).toBe(dirA);
    expect(getFolderWatcher().isWatching(dirA)).toBe(true);
  });

  it('switches watched folder', async () => {
    await app.request('/api/setWatchedFolder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath: dirA }),
    });
    const res = await app.request('/api/setWatchedFolder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath: dirB }),
    });
    const body = await res.json();
    expect(body.data.watchedFolder).toBe(dirB);
    expect(getFolderWatcher().isWatching(dirA)).toBe(false);
    expect(getFolderWatcher().isWatching(dirB)).toBe(true);
  });

  it('null stops watching', async () => {
    await app.request('/api/setWatchedFolder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath: dirA }),
    });
    const res = await app.request('/api/setWatchedFolder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath: null }),
    });
    const body = await res.json();
    expect(body.data.watchedFolder).toBeNull();
    expect(getFolderWatcher().getWatchedFolders()).toEqual([]);
  });
});
```

- [ ] **Step 3: Run route test to verify it fails**

Run: `cd apps/cli && pnpm vitest run src/route/SetWatchedFolder.test.ts`

Expected: FAIL — module `./SetWatchedFolder` not found.

- [ ] **Step 4: Implement the route**

Create `apps/cli/src/route/SetWatchedFolder.ts`:

```ts
import type { Hono } from 'hono';
import type {
  SetWatchedFolderRequestBody,
  SetWatchedFolderResponseBody,
} from '@core/types';
import { getFolderWatcher } from '../services/folderWatcher';
import { logger, logHttpReqIn, logHttpRespOut } from '../../lib/logger';

export async function processSetWatchedFolder(
  body: SetWatchedFolderRequestBody,
): Promise<SetWatchedFolderResponseBody> {
  const folderPath =
    body?.folderPath === undefined
      ? null
      : body.folderPath === null || String(body.folderPath).trim() === ''
        ? null
        : String(body.folderPath);

  const watcher = getFolderWatcher();
  watcher.setWatchedFolder(folderPath);

  return {
    data: {
      watchedFolder: folderPath,
    },
  };
}

export function handleSetWatchedFolder(app: Hono) {
  app.post('/api/setWatchedFolder', async (c) => {
    try {
      const rawBody = await c.req.json().catch(() => ({}));
      logHttpReqIn(c, rawBody);
      const result = await processSetWatchedFolder(rawBody as SetWatchedFolderRequestBody);
      logHttpRespOut(c, result, 200);
      return c.json(result, 200);
    } catch (error) {
      logger.error({ error }, 'SetWatchedFolder route error');
      const respBody: SetWatchedFolderResponseBody = {
        data: { watchedFolder: null },
        error: `Error Reason: ${
          error instanceof Error ? error.message : 'Failed to set watched folder'
        }`,
      };
      logHttpRespOut(c, respBody, 200);
      return c.json(respBody, 200);
    }
  });
}
```

- [ ] **Step 5: Register route and remove startup watch-all**

In `apps/cli/server.ts`:

1. Add import: `import { handleSetWatchedFolder } from './src/route/SetWatchedFolder';`
2. Near other `handle*` registrations (e.g. after `handleIsFolderAvailable`), add: `handleSetWatchedFolder(this.app);`
3. Remove the call `this.initializeFolderWatcherAsync();` and delete the private method `initializeFolderWatcherAsync` (and unused imports of `initializeFolderWatcher` / `getUserConfig` if they become unused from that path only — keep `getUserConfig` if still used elsewhere in the file).

- [ ] **Step 6: Document in `docs/api/index.md`**

Add a section (near other short RPC entries):

```md
## SetWatchedFolder
Source Code: apps/cli/src/route/SetWatchedFolder.ts
HTTP: `POST /api/setWatchedFolder` — sets the single media folder the CLI `FolderWatcher` listens to (UI primary `selectedFolder`). Request body: `{ folderPath: string | null }` (platform absolute path, or null/empty to stop watching). Response: `{ data: { watchedFolder: string | null }, error?: string }`. Startup no longer watches all imported folders.
```

- [ ] **Step 7: Run tests**

Run: `cd apps/cli && pnpm vitest run src/services/folderWatcher.test.ts src/route/SetWatchedFolder.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/core/types.ts apps/cli/src/route/SetWatchedFolder.ts apps/cli/src/route/SetWatchedFolder.test.ts apps/cli/server.ts docs/api/index.md
git commit -m "$(cat <<'EOF'
feat(cli): add setWatchedFolder API and stop watching all folders on startup

EOF
)"
```

---

### Task 3: UI API client + `useSyncWatchedFolder` + wire into initializer

**Files:**
- Create: `apps/ui/src/api/setWatchedFolder.ts`
- Create: `apps/ui/src/hooks/initialization/useSyncWatchedFolder.ts`
- Create: `apps/ui/src/hooks/initialization/useSyncWatchedFolder.test.tsx`
- Modify: `apps/ui/src/components/initialization/UIMediaFolderStoreInitializer.tsx`
- Modify: `apps/ui/src/components/initialization/UIMediaFolderStoreInitializer.test.tsx` (mock the new hook like `useRecheckSelectedFolderAvailability`)

**Interfaces:**
- Consumes: `selectedFolder` from `useUIMediaFolderStore`, `apiFetch`, `@core/types` response type
- Produces:
  - `setWatchedFolder(folderPath: string | null, signal?: AbortSignal): Promise<SetWatchedFolderResponseBody>`
  - `useSyncWatchedFolder(): void`

- [ ] **Step 1: Write the failing hook test**

Create `apps/ui/src/hooks/initialization/useSyncWatchedFolder.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { useSyncWatchedFolder } from "./useSyncWatchedFolder"
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore"
import * as api from "@/api/setWatchedFolder"

vi.mock("@/api/setWatchedFolder", () => ({
  setWatchedFolder: vi.fn(() => Promise.resolve({ data: { watchedFolder: null } })),
}))

describe("useSyncWatchedFolder", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useUIMediaFolderStore.setState({
      folders: [],
      selectedFolder: "",
      selectedFolders: [],
    })
  })

  it("calls API with null when nothing is selected", async () => {
    renderHook(() => useSyncWatchedFolder())
    await waitFor(() => {
      expect(api.setWatchedFolder).toHaveBeenCalledWith(null, expect.any(AbortSignal))
    })
  })

  it("calls API when selectedFolder changes", async () => {
    const { rerender } = renderHook(() => useSyncWatchedFolder())
    useUIMediaFolderStore.getState().setSelectedFolder("/media/ShowA")
    rerender()
    await waitFor(() => {
      expect(api.setWatchedFolder).toHaveBeenCalledWith("/media/ShowA", expect.any(AbortSignal))
    })
  })

  it("aborts previous request on rapid change", async () => {
    const signals: AbortSignal[] = []
    vi.mocked(api.setWatchedFolder).mockImplementation((_path, signal) => {
      if (signal) signals.push(signal)
      return Promise.resolve({ data: { watchedFolder: _path } })
    })

    const { rerender } = renderHook(() => useSyncWatchedFolder())
    useUIMediaFolderStore.getState().setSelectedFolder("/media/A")
    rerender()
    useUIMediaFolderStore.getState().setSelectedFolder("/media/B")
    rerender()

    await waitFor(() => {
      expect(api.setWatchedFolder).toHaveBeenCalledWith("/media/B", expect.any(AbortSignal))
    })
    expect(signals.some((s) => s.aborted)).toBe(true)
  })
})
```

- [ ] **Step 2: Run hook test to verify it fails**

Run: `cd apps/ui && pnpm vitest run src/hooks/initialization/useSyncWatchedFolder.test.tsx`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement API client**

Create `apps/ui/src/api/setWatchedFolder.ts`:

```ts
import type {
  SetWatchedFolderRequestBody,
  SetWatchedFolderResponseBody,
} from "@core/types"
import { apiFetch } from "@/lib/apiFetch"

export async function setWatchedFolder(
  folderPath: string | null,
  signal?: AbortSignal,
): Promise<SetWatchedFolderResponseBody> {
  const body: SetWatchedFolderRequestBody = { folderPath }
  const resp = await apiFetch("/api/setWatchedFolder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  })

  if (!resp.ok) {
    throw new Error(`setWatchedFolder: HTTP ${resp.status} ${resp.statusText}`)
  }

  const data = (await resp.json()) as SetWatchedFolderResponseBody
  if (data.error) {
    console.error("[setWatchedFolder] API error", data.error)
  }
  return data
}
```

- [ ] **Step 4: Implement the hook**

Create `apps/ui/src/hooks/initialization/useSyncWatchedFolder.ts`:

```ts
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore"
import { setWatchedFolder } from "@/api/setWatchedFolder"
import { useEffect } from "react"

/**
 * Keeps CLI FolderWatcher in sync with the primary sidebar selection.
 */
export function useSyncWatchedFolder() {
  const selectedFolder = useUIMediaFolderStore((s) => s.selectedFolder)

  useEffect(() => {
    const ac = new AbortController()
    const folderPath = selectedFolder?.trim() ? selectedFolder : null

    void (async () => {
      try {
        await setWatchedFolder(folderPath, ac.signal)
      } catch (error) {
        if (ac.signal.aborted) return
        console.error("[useSyncWatchedFolder] failed to sync watched folder", error)
      }
    })()

    return () => {
      ac.abort()
    }
  }, [selectedFolder])
}
```

- [ ] **Step 5: Wire into initializer**

In `apps/ui/src/components/initialization/UIMediaFolderStoreInitializer.tsx`:

1. Import `useSyncWatchedFolder` from `@/hooks/initialization/useSyncWatchedFolder`
2. Call `useSyncWatchedFolder()` next to `useRecheckSelectedFolderAvailability()`

In `apps/ui/src/components/initialization/UIMediaFolderStoreInitializer.test.tsx`, add a mock:

```ts
vi.mock("@/hooks/initialization/useSyncWatchedFolder", () => ({
  useSyncWatchedFolder: vi.fn(),
}))
```

- [ ] **Step 6: Run UI tests**

Run: `cd apps/ui && pnpm vitest run src/hooks/initialization/useSyncWatchedFolder.test.tsx src/components/initialization/UIMediaFolderStoreInitializer.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/ui/src/api/setWatchedFolder.ts apps/ui/src/hooks/initialization/useSyncWatchedFolder.ts apps/ui/src/hooks/initialization/useSyncWatchedFolder.test.tsx apps/ui/src/components/initialization/UIMediaFolderStoreInitializer.tsx apps/ui/src/components/initialization/UIMediaFolderStoreInitializer.test.tsx
git commit -m "$(cat <<'EOF'
feat(ui): sync FolderWatcher with selectedFolder via setWatchedFolder

EOF
)"
```

---

### Task 4: Manual verification checklist

**Files:** none (manual)

- [ ] **Step 1: Start the app**

Run: `pnpm dev` (or Electron) with a library that has many imported folders.

- [ ] **Step 2: Confirm startup logs**

Expected: CLI does **not** log `[FolderWatcher] Started watching folder` for every imported path on boot. At most one watch appears after UI restores/selects a folder.

- [ ] **Step 3: Switch folders in the sidebar**

Expected: log shows stop for previous path and start for the new path; only one watched folder at a time.

- [ ] **Step 4: Commit note (optional)**

If verification finds a bug, fix in a follow-up commit on the same branch; otherwise no commit required for this task.

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| No watch-all on startup | Task 2 |
| Watch only `selectedFolder` | Task 3 |
| Empty selection → no watch | Tasks 1–3 |
| Switch stops old / starts new | Tasks 1–2 |
| `POST /api/setWatchedFolder` | Task 2 |
| Response `data.watchedFolder` | Task 2 |
| Docs `docs/api/index.md` | Task 2 |
| Rapid switch / AbortSignal | Task 3 |
| No toast on API failure | Task 3 |
| Out of scope items untouched | (no tasks for them) |
