# E2E UIMediaFolderStore Window Bridge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose a read-only `window.__uiMediaFolderStore` bridge and use it in e2e so immersive-input waits fail with folder-status-aware messages (e.g. “Folder was still initializing”), and so `unknown TV show folder was imported` waits until the folder leaves busy statuses.

**Architecture:** Mirror existing page bridges (`_smm_status`, `__jobOrchestrator`). UI registers a narrow snapshot API on `window` after Zustand `create()`. E2E helpers call `browser.execute` to read `{ path, status }`, classify busy statuses to match `TvShowPanelHeader`, and build timeout messages. Design doc: `docs/superpowers/design/e2e-ui-media-folder-store-bridge.md`.

**Tech Stack:** Zustand (`create` + `getState`), TypeScript `Window` augmentation, WebdriverIO `browser.execute` / `browser.waitUntil`, Vitest (UI unit test), existing e2e Gherkin steps / COs.

## Global Constraints

- Bridge is **read-only** (no mutations, no action methods, no full store dump).
- Busy statuses must stay aligned with `TvShowPanelHeader` `isUpdatingTvShow`: `idle` | `pending_for_initialization` | `initializing` | `loading` | `updating`, plus missing selection.
- Init wait timeout for unknown-folder given step: **3 minutes** (`3 * 60 * 1000`), matching `useInitializeImportedMediaFolder` `withTimeout`.
- Do not change product UI visibility rules in this plan.
- Do not commit unless the user asks.

---

## File Map

**Create:**
- `apps/ui/src/stores/uiMediaFolderStoreBridge.ts` — pure helpers + `installUIMediaFolderStoreBridge()` / snapshot builder (unit-testable without WDIO).
- `apps/ui/src/stores/uiMediaFolderStoreBridge.test.ts` — unit tests for snapshot + busy classification + message builder (message builder may live in e2e only; UI tests cover bridge snapshot logic).
- `apps/e2e/test/lib/ui-media-folder-store.ts` — WDIO helper: `getSelectedFolderSnapshot()`, `isBusyFolderStatus()`, `formatImmersiveInputTimeoutMsg()`, `waitUntilSelectedFolderReady()`.

**Modify:**
- `apps/ui/src/stores/uiMediaFolderStore.ts` — call `installUIMediaFolderStoreBridge()` after `create()`.
- `apps/ui/src/types/global.d.ts` — add `Window.__uiMediaFolderStore`.
- `apps/e2e/test/componentobjects/Searchbox.co.ts` — status-aware `timeoutMsg` when waiting for immersive-input.
- `apps/e2e/test/steps/searchbox-input-is-empty.ts` — wait via CO helper (or shared wait) so default `waitForDisplayed` also gets status-aware errors.
- `apps/e2e/test/steps/unknown-tv-show-folder-was-imported.ts` — after sidebar folder appears, wait until selected folder is not busy.

**Reference (read-only):**
- `docs/superpowers/design/e2e-ui-media-folder-store-bridge.md`
- `apps/ui/src/components/tv/TvShowPanelHeader.tsx` (busy status list)
- `apps/e2e/test/pageobjects/page.ts` (`_smm_status` execute pattern)
- `apps/ui/src/hooks/initialization/useInitializeImportedMediaFolder.ts` (3 min timeout)

---

### Task 1: UI bridge helpers + Window typing

**Files:**
- Create: `apps/ui/src/stores/uiMediaFolderStoreBridge.ts`
- Create: `apps/ui/src/stores/uiMediaFolderStoreBridge.test.ts`
- Modify: `apps/ui/src/types/global.d.ts`
- Modify: `apps/ui/src/stores/uiMediaFolderStore.ts`

**Interfaces:**
- Consumes: `useUIMediaFolderStore.getState()`, `UIMediaFolderStatus` from `@/types/UIMediaFolder`
- Produces:
  - `UIMediaFolderStoreBridgeSnapshot = { path: string; status: UIMediaFolderStatus }`
  - `selectSelectedFolderSnapshot(state): UIMediaFolderStoreBridgeSnapshot | null`
  - `installUIMediaFolderStoreBridge(getState: () => UIMediaFolderStoreStateSlice): void`
  - `window.__uiMediaFolderStore.getSelectedFolderSnapshot(): … | null`

- [ ] **Step 1: Write the failing unit test**

Create `apps/ui/src/stores/uiMediaFolderStoreBridge.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  selectSelectedFolderSnapshot,
  type UIMediaFolderStoreBridgeState,
} from "./uiMediaFolderStoreBridge"

describe("selectSelectedFolderSnapshot", () => {
  it("returns null when nothing is selected", () => {
    const state: UIMediaFolderStoreBridgeState = {
      selectedFolder: "",
      folders: [{ path: "/a", status: "ok", test: false }],
    }
    expect(selectSelectedFolderSnapshot(state)).toBeNull()
  })

  it("returns path and status for the selected folder", () => {
    const state: UIMediaFolderStoreBridgeState = {
      selectedFolder: "/a",
      folders: [{ path: "/a", status: "initializing", test: false }],
    }
    expect(selectSelectedFolderSnapshot(state)).toEqual({
      path: "/a",
      status: "initializing",
    })
  })

  it("returns null when selected path is missing from folders", () => {
    const state: UIMediaFolderStoreBridgeState = {
      selectedFolder: "/missing",
      folders: [{ path: "/a", status: "ok", test: false }],
    }
    expect(selectSelectedFolderSnapshot(state)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm -C apps/ui test -- uiMediaFolderStoreBridge.test.ts
```

Expected: FAIL (module / export missing).

- [ ] **Step 3: Implement bridge module + Window type + install from store**

Write `apps/ui/src/stores/uiMediaFolderStoreBridge.ts`:

```ts
import type { UIMediaFolder, UIMediaFolderStatus } from "@/types/UIMediaFolder"

export type UIMediaFolderStoreBridgeSnapshot = {
  path: string
  status: UIMediaFolderStatus
}

/** Minimal state shape needed by the bridge (avoids importing actions). */
export type UIMediaFolderStoreBridgeState = {
  selectedFolder: string
  folders: Pick<UIMediaFolder, "path" | "status" | "test">[]
}

export function selectSelectedFolderSnapshot(
  state: UIMediaFolderStoreBridgeState,
): UIMediaFolderStoreBridgeSnapshot | null {
  const path = state.selectedFolder
  if (!path) return null
  const folder = state.folders.find((f) => f.path === path)
  if (!folder) return null
  return { path: folder.path, status: folder.status }
}

export type UIMediaFolderStoreBridge = {
  getSelectedFolderSnapshot: () => UIMediaFolderStoreBridgeSnapshot | null
}

export function installUIMediaFolderStoreBridge(
  getState: () => UIMediaFolderStoreBridgeState,
): void {
  if (typeof window === "undefined") return
  window.__uiMediaFolderStore = {
    getSelectedFolderSnapshot: () => selectSelectedFolderSnapshot(getState()),
  }
}
```

Extend `apps/ui/src/types/global.d.ts` `Window`:

```ts
import type { UIMediaFolderStoreBridge } from "@/stores/uiMediaFolderStoreBridge"

// inside Window interface:
__uiMediaFolderStore?: UIMediaFolderStoreBridge
```

(Avoid circular imports: if `global.d.ts` importing the store bridge is awkward, inline a duplicate interface in `global.d.ts` matching the bridge shape — prefer inline duplicate to keep `.d.ts` free of runtime imports.)

Preferred `global.d.ts` shape (no runtime import):

```ts
__uiMediaFolderStore?: {
  getSelectedFolderSnapshot(): {
    path: string
    status:
      | "idle"
      | "pending_for_initialization"
      | "initializing"
      | "ok"
      | "folder_not_found"
      | "error_loading_metadata"
      | "loading"
      | "updating"
  } | null
}
```

At end of `apps/ui/src/stores/uiMediaFolderStore.ts`, after `create(...)`:

```ts
import { installUIMediaFolderStoreBridge } from "./uiMediaFolderStoreBridge"

// after: const useUIMediaFolderStore = create<...>(...)
installUIMediaFolderStoreBridge(() => {
  const { folders, selectedFolder } = useUIMediaFolderStore.getState()
  return { folders, selectedFolder }
})
```

Do **not** put action methods on `window`.

- [ ] **Step 4: Run unit tests to verify they pass**

```bash
pnpm -C apps/ui test -- uiMediaFolderStoreBridge.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit** (only if user requested)

```bash
git add apps/ui/src/stores/uiMediaFolderStoreBridge.ts \
  apps/ui/src/stores/uiMediaFolderStoreBridge.test.ts \
  apps/ui/src/stores/uiMediaFolderStore.ts \
  apps/ui/src/types/global.d.ts \
  docs/superpowers/design/e2e-ui-media-folder-store-bridge.md
git commit -m "$(cat <<'EOF'
feat(ui): expose read-only UIMediaFolderStore window bridge for e2e

EOF
)"
```

---

### Task 2: E2E helper for snapshot + timeout messages + wait-ready

**Files:**
- Create: `apps/e2e/test/lib/ui-media-folder-store.ts`

**Interfaces:**
- Consumes: `window.__uiMediaFolderStore` via `browser.execute`
- Produces:
  - `getSelectedFolderSnapshot(): Promise<{ path: string; status: string } | null>`
  - `isBusyFolderStatus(status: string | null | undefined): boolean`
  - `formatImmersiveInputTimeoutMsg(timeoutMs: number, snapshot): string`
  - `waitUntilSelectedFolderReady(timeoutMs?: number): Promise<void>`

- [ ] **Step 1: Add e2e helper module**

Create `apps/e2e/test/lib/ui-media-folder-store.ts`:

```ts
import { browser } from '@wdio/globals'

export type E2eFolderSnapshot = { path: string; status: string }

/** Must match TvShowPanelHeader isUpdatingTvShow busy statuses. */
const BUSY_STATUSES = new Set([
  'idle',
  'pending_for_initialization',
  'initializing',
  'loading',
  'updating',
])

export function isBusyFolderStatus(status: string | null | undefined): boolean {
  if (status == null || status === '') return true
  return BUSY_STATUSES.has(status)
}

export async function getSelectedFolderSnapshot(): Promise<E2eFolderSnapshot | null> {
  return browser.execute(() => {
    const bridge = (
      window as Window & {
        __uiMediaFolderStore?: {
          getSelectedFolderSnapshot?: () => { path: string; status: string } | null
        }
      }
    ).__uiMediaFolderStore
    if (!bridge?.getSelectedFolderSnapshot) return null
    return bridge.getSelectedFolderSnapshot()
  })
}

export function formatImmersiveInputTimeoutMsg(
  timeoutMs: number,
  snapshot: E2eFolderSnapshot | null,
): string {
  if (snapshot && isBusyFolderStatus(snapshot.status)) {
    return (
      `Folder was still ${snapshot.status} after ${timeoutMs}ms ` +
      `(immersive-input hidden until status=ok; path=${snapshot.path})`
    )
  }
  if (snapshot) {
    return (
      `immersive-input was not displayed after ${timeoutMs}ms ` +
      `(folder status=${snapshot.status}; path=${snapshot.path})`
    )
  }
  return (
    `immersive-input was not displayed after ${timeoutMs}ms ` +
    `(could not read folder status from window.__uiMediaFolderStore)`
  )
}

export async function waitUntilSelectedFolderReady(
  timeoutMs: number = 3 * 60 * 1000,
): Promise<void> {
  await browser.waitUntil(
    async () => {
      const snapshot = await getSelectedFolderSnapshot()
      return snapshot != null && !isBusyFolderStatus(snapshot.status)
    },
    {
      timeout: timeoutMs,
      interval: 250,
      timeoutMsg: await (async () => {
        // WDIO timeoutMsg is evaluated when wait starts in some versions;
        // prefer a function if supported, else static + re-read in catch.
        return 'Selected folder did not leave busy status'
      })(),
    },
  )
}
```

**Important implementation note for Step 1:** WebdriverIO’s `timeoutMsg` is typically a **string**, not async. Implement `waitUntilSelectedFolderReady` like this instead:

```ts
export async function waitUntilSelectedFolderReady(
  timeoutMs: number = 3 * 60 * 1000,
): Promise<void> {
  try {
    await browser.waitUntil(
      async () => {
        const snapshot = await getSelectedFolderSnapshot()
        return snapshot != null && !isBusyFolderStatus(snapshot.status)
      },
      {
        timeout: timeoutMs,
        interval: 250,
        timeoutMsg: `Selected folder was still busy after ${timeoutMs}ms`,
      },
    )
  } catch (err) {
    const snapshot = await getSelectedFolderSnapshot().catch(() => null)
    if (snapshot && isBusyFolderStatus(snapshot.status)) {
      throw new Error(
        `Folder was still ${snapshot.status} after ${timeoutMs}ms ` +
          `(path=${snapshot.path})`,
      )
    }
    if (snapshot) {
      throw new Error(
        `Selected folder did not become ready after ${timeoutMs}ms ` +
          `(status=${snapshot.status}; path=${snapshot.path})`,
      )
    }
    throw err
  }
}
```

- [ ] **Step 2: Sanity-check helper types compile with e2e package**

Run (or project-equivalent typecheck for e2e if available):

```bash
pnpm -C apps/e2e exec tsc --noEmit -p tsconfig.json
```

If e2e has no standalone `tsc` script, skip and rely on WDIO compile on next task’s local run. Expected: no errors in the new file.

- [ ] **Step 3: Commit** (only if user requested)

```bash
git add apps/e2e/test/lib/ui-media-folder-store.ts
git commit -m "$(cat <<'EOF'
feat(e2e): add UIMediaFolderStore snapshot helpers for status-aware waits

EOF
)"
```

---

### Task 3: Wire status-aware messages into Searchbox waits

**Files:**
- Modify: `apps/e2e/test/componentobjects/Searchbox.co.ts`
- Modify: `apps/e2e/test/steps/searchbox-input-is-empty.ts`

**Interfaces:**
- Consumes: `getSelectedFolderSnapshot`, `formatImmersiveInputTimeoutMsg` from Task 2
- Produces: immersive-input waits that throw status-aware errors

- [ ] **Step 1: Add `SearchboxCO.waitForImmersiveInputDisplayed`**

In `Searchbox.co.ts`, import helpers and add:

```ts
import {
  formatImmersiveInputTimeoutMsg,
  getSelectedFolderSnapshot,
} from '../lib/ui-media-folder-store'

async waitForImmersiveInputDisplayed(timeout: number = 15000): Promise<void> {
  try {
    await waitForDisplay('[data-testid="immersive-input"]', {
      timeout,
      interval: 200,
      timeoutMsg: `immersive-input was not displayed after ${timeout}ms`,
    })
  } catch (err) {
    const snapshot = await getSelectedFolderSnapshot().catch(() => null)
    throw new Error(formatImmersiveInputTimeoutMsg(timeout, snapshot))
  }
}
```

Update `waitForTitleToBeOneOf` to call `waitForImmersiveInputDisplayed(timeout)` instead of raw `waitForDisplay` with the old static message.

- [ ] **Step 2: Update `searchbox input is empty` step**

Replace:

```ts
await SearchboxCO.input.waitForDisplayed()
```

with:

```ts
await SearchboxCO.waitForImmersiveInputDisplayed(15000)
```

Keep the empty-value assertion unchanged.

- [ ] **Step 3: Manual / local verification of message path (optional red-green)**

If a quick Ohos/browser run is available:

```bash
bun ci/run-e2e-test.ts --spec ./common/tv/SearchTvShow.e2e.ts
```

On a still-failing slow init (before Task 4 wait), expect timeout text to include `Folder was still initializing` (or another busy status), **not** only `immersive-input was not displayed`.

If environment cannot reproduce, unit-level check of `formatImmersiveInputTimeoutMsg` via a tiny Node assert in a one-off `node -e` is acceptable for this task; full e2e proof is Task 4/5.

- [ ] **Step 4: Commit** (only if user requested)

```bash
git add apps/e2e/test/componentobjects/Searchbox.co.ts \
  apps/e2e/test/steps/searchbox-input-is-empty.ts
git commit -m "$(cat <<'EOF'
fix(e2e): report folder status when immersive-input wait times out

EOF
)"
```

---

### Task 4: Wait for folder ready in `unknown TV show folder was imported`

**Files:**
- Modify: `apps/e2e/test/steps/unknown-tv-show-folder-was-imported.ts`

**Interfaces:**
- Consumes: `waitUntilSelectedFolderReady` from Task 2
- Produces: given step that does not return while selected folder is busy

- [ ] **Step 1: After sidebar folder is visible, wait for ready**

After successful `Sidebar.waitForFolderName(...)`, add:

```ts
import { waitUntilSelectedFolderReady } from '../lib/ui-media-folder-store'

// after folder appears in sidebar:
await waitUntilSelectedFolderReady(3 * 60 * 1000)
```

Remove or keep the existing `browser.pause(1000)` — prefer **remove** the fixed pause once the status wait exists (the wait already polls).

Ensure import path still selects the folder (import flow currently selects the new folder; if selection is empty, `waitUntilSelectedFolderReady` fails with bridge null — acceptable and clearer than immersive timeout).

- [ ] **Step 2: Commit** (only if user requested)

```bash
git add apps/e2e/test/steps/unknown-tv-show-folder-was-imported.ts
git commit -m "$(cat <<'EOF'
fix(e2e): wait for folder init before searchbox steps on unknown TV import

EOF
)"
```

---

### Task 5: Verification

**Files:** none (run only), optionally touch `apps/e2e/common-e2e-tests-verification.md` if documenting Ohos result.

- [ ] **Step 1: UI unit tests**

```bash
pnpm -C apps/ui test -- uiMediaFolderStoreBridge.test.ts
```

Expected: PASS.

- [ ] **Step 2: Re-run SearchTvShow e2e (Ohos or Electron as available)**

```bash
bun ci/run-e2e-test.ts --spec ./common/tv/SearchTvShow.e2e.ts
```

Expected outcomes:

- **Pass:** preferred if SCF/TMDB healthy and init finishes within 3 minutes.
- **Fail with status-aware message:** if init still exceeds 3 minutes or network broken — message must mention busy status / ready wait, not a bare immersive-input miss from the given step.

- [ ] **Step 3: Update progress note if Ohos matrix is maintained**

If `apps/e2e/common-e2e-tests-verification.md` tracks SearchTvShow, update that row with the new result and note that failures should now surface folder status.

- [ ] **Step 4: Commit docs** (only if user requested)

---

## Self-Review Checklist

1. **Spec coverage:** Bridge + typing (Task 1), e2e read/helpers (Task 2), timeout messages (Task 3), wait-ready given step (Task 4), verification (Task 5) — matches design §§2–3.
2. **Placeholders:** None intentional; WDIO `timeoutMsg` pitfall called out with concrete catch-rewrite.
3. **Type consistency:** Snapshot `{ path, status }`; bridge name `__uiMediaFolderStore`; busy set matches header; 3 min timeout consistent.

## Out of Scope (explicit)

- Exposing write APIs or full Zustand `getState` with actions.
- Changing `TvShowPanelHeader` visibility rules.
- Fixing TMDB/SCF latency itself.
- Applying the same wait to every import step in the suite (only `unknown TV show folder was imported` in this plan; other steps can adopt the helper later).
