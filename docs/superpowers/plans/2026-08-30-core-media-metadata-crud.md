# Core Media Metadata CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `apps/core` the sole owner of media-metadata cache CRUD; expose four CLI RPC bridges; migrate UI hooks and e2e to HTTP so neither knows metadata file directories.

**Architecture:** `MediaMetadataHelper` stores caches under the **data** dir (`getAppDataDir()` / `hello().appDataDir`). `UserConfigHelper` stays on **config** dir (`getUserDataDir()`). CLI routes map 1:1 to Core methods. UI `useMediaMetadataQuery` / `useMediaMetadataMutation` call those routes. Errors for these four APIs use RFC 9457 ProblemDetails with real HTTP status.

**Tech Stack:** TypeScript, Vitest, Bun, Hono, TanStack Query, WebdriverIO e2e.

**Spec:** `docs/superpowers/specs/2026-08-30-core-media-metadata-crud-design.md`

## Global Constraints

- Persistable `MediaMetadata` fields only: `mediaFolderPath`, `type`, `mediaFiles`, `tvShow`, `movie` — **delete** `files` from the interface.
- `setMetadata(folderPath, patch)` whitelist: `type` | `mediaFiles` | `tvShow` | `movie` only; any other patch key → validation error (HTTP 400).
- `setMetadata` / `getMetadata`: missing cache → not-found error (HTTP 404 ProblemDetails).
- `createMetadata`: existing cache → conflict (HTTP 409 ProblemDetails).
- `deleteMetadata`: missing cache → idempotent success.
- Metadata RPCs only: ProblemDetails + real status; do not migrate unrelated APIs.
- UI/e2e must not call `metadataCacheFilePath` or write metadata via `writeFile`.
- Linux: metadata root === `~/.local/share/smm` (or `APP_DATA_DIR`); config root === `~/.config/smm` (or `USER_DATA_DIR`).

---

## File Structure

| File | Responsibility |
|------|----------------|
| `packages/core/types.ts` | Remove `files`; add get/create/set/delete request bodies + ProblemDetails usage notes |
| `apps/core/src/errors/MetadataNotFoundError.ts` (or `pipeline/metadataErrors.ts`) | Typed Core errors for not-found / conflict / validation |
| `apps/core/src/pipeline/setMetadataPatch.ts` | Whitelist merge helper for `setMetadata` |
| `apps/core/src/Core.ts` | `getMetadata` / `createMetadata` / `setMetadata(path, patch)` / `deleteMetadata`; wire Helper roots |
| `apps/core/src/Core.test.ts` (+ focused new test file if preferred) | Unit coverage for CRUD + dir split |
| `apps/cli/src/core/getCore.ts` | Pass `appDataDir: getAppDataDir()`, `userDataDir: getUserDataDir()` |
| `apps/cli/src/route/metadata/problemDetails.ts` | Map Core errors → ProblemDetails JSON responses |
| `apps/cli/src/route/metadata/GetMetadata.ts` | `POST /api/get-metadata` |
| `apps/cli/src/route/metadata/CreateMetadata.ts` | `POST /api/create-metadata` |
| `apps/cli/src/route/metadata/SetMetadata.ts` | `POST /api/set-metadata` |
| `apps/cli/src/route/metadata/DeleteMetadata.ts` | `POST /api/delete-metadata` |
| `apps/cli/server.ts` | Register four routes |
| `apps/ui/src/api/metadata.ts` | Thin `apiFetch` clients for the four RPCs |
| `apps/ui/src/hooks/mediaMetadata/useMediaMetadataQuery.ts` | Query via get-metadata; 404 → null |
| `apps/ui/src/hooks/mediaMetadata/useMediaMetadataMutation.ts` | create/set/delete + cache update |
| `apps/ui/src/lib/mediaMetadataQueryKeys.ts` | `queryFn` uses new API client |
| `apps/e2e/test/lib/metadata-http.ts` | Browser helpers calling the four RPCs |
| Delete / stop using after migration | UI `writeMediaMetadata` path-write, `readMediaMetadataV2` cache-path logic; CLI `handleReadMediaMetadata` / `handleWriteMediaMetadata` once unused |

---

### Task 1: Remove `files` from `MediaMetadata` + add RPC types

**Files:**
- Modify: `packages/core/types.ts` (`MediaMetadata`, request bodies near line ~590 and ~841)
- Fix compile errors in same PR slice where `files` is assigned (prefer minimal: stop writing `files`, delete property access that only existed for cache)

**Interfaces:**
- Produces:
```typescript
export interface MediaMetadata {
  mediaFolderPath?: string
  mediaFiles?: MediaFileMetadata[]
  type?: "music-folder" | "tvshow-folder" | "movie-folder"
  tvShow?: TvShowMediaMetadata
  movie?: MovieMediaMetadata
}

export interface GetMetadataRequestBody { path: string }
export interface CreateMetadataRequestBody { data: MediaMetadata }
export interface SetMetadataRequestBody {
  path: string
  patch: Pick<MediaMetadata, "type" | "mediaFiles" | "tvShow" | "movie">
}
export interface DeleteMetadataRequestBody { path: string }
export interface MetadataSuccessResponseBody {
  data?: MediaMetadata | true
}
```

- [ ] **Step 1: Delete `files` from the interface**

Remove the deprecated `files` block from `MediaMetadata` in `packages/core/types.ts`.

- [ ] **Step 2: Add the four request body types + success response type**

Place them near existing `ReadMediaMetadataRequestBody` (can leave old types until Task 8 deletes legacy routes).

- [ ] **Step 3: Fix TypeScript breaks from removing `files`**

Run from repo root:
```bash
pnpm exec tsc -p packages/core --noEmit
pnpm exec tsc -p apps/core --noEmit
```
Expected: errors only at `files` assignments/reads. Fix by removing those assignments (UI/Core already treat `files` as non-persisted). Update `PersistedMediaMetadata` if it was `Omit<MediaMetadata, "files">` — simplify to `MediaMetadata` or keep alias.

- [ ] **Step 4: Commit**

```bash
git add packages/core/types.ts apps/core/src/pipeline/mediaMetadataValidation.ts
git commit -m "$(cat <<'EOF'
refactor(core): drop MediaMetadata.files and add metadata RPC types

EOF
)"
```

---

### Task 2: Core errors + `setMetadata` patch helper (TDD)

**Files:**
- Create: `apps/core/src/pipeline/metadataErrors.ts`
- Create: `apps/core/src/pipeline/setMetadataPatch.ts`
- Create: `apps/core/src/pipeline/setMetadataPatch.test.ts`

**Interfaces:**
- Produces:
```typescript
export class MetadataNotFoundError extends Error {
  readonly folderPath: string
  constructor(folderPath: string)
}
export class MetadataAlreadyExistsError extends Error {
  readonly folderPath: string
  constructor(folderPath: string)
}
export class MetadataValidationError extends Error {
  constructor(message: string)
}

export type MetadataPatch = Pick<MediaMetadata, "type" | "mediaFiles" | "tvShow" | "movie">

/** Throws MetadataValidationError if patch has disallowed own-keys. */
export function applyMetadataPatch(
  current: MediaMetadata,
  patch: Record<string, unknown>,
): MediaMetadata
```

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, expect, it } from "vitest"
import { applyMetadataPatch } from "./setMetadataPatch"
import { MetadataValidationError } from "./metadataErrors"

describe("applyMetadataPatch", () => {
  const base = { mediaFolderPath: "/m/Show", type: "movie-folder" as const }

  it("merges allowed keys", () => {
    const next = applyMetadataPatch(base, {
      mediaFiles: [{ absolutePath: "/m/Show/a.mp4" }],
      movie: { id: 1, title: "A" } as never,
    })
    expect(next.mediaFiles?.[0]?.absolutePath).toBe("/m/Show/a.mp4")
    expect(next.type).toBe("movie-folder")
  })

  it("rejects unknown keys", () => {
    expect(() => applyMetadataPatch(base, { mediaFolderPath: "/x" })).toThrow(MetadataValidationError)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd apps/core && pnpm exec vitest run src/pipeline/setMetadataPatch.test.ts
```

- [ ] **Step 3: Implement `metadataErrors.ts` + `applyMetadataPatch`**

Allowed keys set: `type`, `mediaFiles`, `tvShow`, `movie`. Any other own enumerable key → `MetadataValidationError`.

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/pipeline/metadataErrors.ts apps/core/src/pipeline/setMetadataPatch.ts apps/core/src/pipeline/setMetadataPatch.test.ts
git commit -m "$(cat <<'EOF'
feat(core): add metadata patch whitelist helper and typed errors

EOF
)"
```

---

### Task 3: Core CRUD methods + separate config/data roots

**Files:**
- Modify: `apps/core/src/Core.ts` (constructor + metadata methods ~404–412)
- Modify: `apps/core/src/Core.test.ts` (or create `apps/core/src/Core.metadataCrud.test.ts`)
- Modify: `apps/cli/src/core/getCore.ts`

**Critical wiring (do not skip):**

```typescript
// Core constructor
this.userConfig = new UserConfigHelper(this.fs, this.userDataDir);
const metadataRoot = this.reportedAppDataDir ?? this.appDataDir;
this.mediaMetadata = new MediaMetadataHelper(this.fs, metadataRoot);

// getCore()
instance = new Core({
  fs: new NodejsFsAdapter(),
  // ...
  appDataDir: getAppDataDir(),      // data: metadata + plans when using appDataDir
  userDataDir: getUserDataDir(),    // config: smm.json
  reportedAppDataDir: getAppDataDir(),
  // ...
});
```

If `UserConfigHelper` previously read `smm.json` from `appDataDir` while `getCore` passed `userDataDir` as `appDataDir`, switching `appDataDir` to `getAppDataDir()` **requires** UserConfigHelper to use `userDataDir` or config will move. Verify existing Core tests that write `smm.json` under `appDataDir` — update fixtures to pass distinct `userDataDir` / `appDataDir` when needed.

**Interfaces:**
- Produces on `Core`:
```typescript
async getMetadata(folderPath: string): Promise<PersistedMediaMetadata> // throws MetadataNotFoundError
async createMetadata(mm: MediaMetadata): Promise<PersistedMediaMetadata> // throws MetadataAlreadyExistsError
async setMetadata(folderPath: string, patch: MetadataPatch): Promise<PersistedMediaMetadata>
async deleteMetadata(folderPath: string): Promise<void>
```

- Internal full writes that used old `setMetadata(mm)` must call `this.mediaMetadata.write(...)` or `createMetadata` as appropriate.
- Call sites that need “null if missing” keep `this.mediaMetadata.read(folder)` (do **not** make `getMetadata` return null).

- [ ] **Step 1: Write failing Core tests**

Cover: get throws when missing; create then get; create twice throws; set merges; set missing throws; set illegal key throws; delete idempotent; metadata file lands under `reportedAppDataDir` while `smm.json` under `userDataDir`.

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd apps/core && pnpm exec vitest run src/Core.metadataCrud.test.ts
```

- [ ] **Step 3: Implement Core methods + constructor split + getCore env wiring**

Rename/replace public `getMediaMetadata` usages carefully: grep `getMediaMetadata` and update. Prefer keeping a deprecated private adapter only if compile cost is high — otherwise delete.

Old full-document `setMetadata(mm: MediaMetadata)` conflicts with new signature — rename internal full write to `writeMetadata` private method **or** only use `mediaMetadata.write` inside Core.

- [ ] **Step 4: Run Core unit tests — expect PASS**

```bash
cd apps/core && pnpm exec vitest run src/Core.metadataCrud.test.ts src/Core.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/Core.ts apps/core/src/Core.metadataCrud.test.ts apps/cli/src/core/getCore.ts
git commit -m "$(cat <<'EOF'
feat(core): metadata CRUD API and separate config/data dirs

EOF
)"
```

---

### Task 4: CLI ProblemDetails helper + four RPC routes (TDD)

**Files:**
- Create: `apps/cli/src/route/metadata/problemDetails.ts`
- Create: `apps/cli/src/route/metadata/GetMetadata.ts` (+ `.test.ts`)
- Create: `apps/cli/src/route/metadata/CreateMetadata.ts` (+ `.test.ts`)
- Create: `apps/cli/src/route/metadata/SetMetadata.ts` (+ `.test.ts`)
- Create: `apps/cli/src/route/metadata/DeleteMetadata.ts` (+ `.test.ts`)
- Modify: `apps/cli/server.ts` (register handlers)

**Interfaces:**
```typescript
export function problemJson(
  c: Context,
  status: 400 | 404 | 409 | 500,
  type: string,
  title: string,
  detail: string,
): Response
// Content-Type: application/problem+json
// body: ProblemDetails { type, title, status, detail, instance: c.req.path }
```

Map:
- `MetadataNotFoundError` → 404 `urn:smm:problem:metadata-not-found`
- `MetadataAlreadyExistsError` → 409 `urn:smm:problem:metadata-already-exists`
- `MetadataValidationError` → 400 `urn:smm:problem:metadata-validation`
- other → 500 `urn:smm:problem:internal`

Success examples:
- get/create/set: `c.json({ data: mm }, 200)`
- delete: `c.json({ data: true }, 200)`

- [ ] **Step 1: Write failing route test for get-metadata 404**

Follow `RenameEpisodeFile.test.ts` pattern: temp `USER_DATA_DIR` + `APP_DATA_DIR`, `resetCoreForTests()`, mount route, `app.request`.

```typescript
it("returns 404 ProblemDetails when missing", async () => {
  const res = await app.request("/api/get-metadata", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path: "/no/such/folder" }),
  })
  expect(res.status).toBe(404)
  expect(res.headers.get("content-type")).toContain("application/problem+json")
  const body = await res.json()
  expect(body.type).toBe("urn:smm:problem:metadata-not-found")
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd apps/cli && pnpm exec vitest run src/route/metadata/GetMetadata.test.ts
```

- [ ] **Step 3: Implement get/create/set/delete handlers + register in `server.ts`**

- [ ] **Step 4: Expand tests** for create 409, set 400 illegal field, delete 200 twice, happy-path roundtrip create→get→set→get→delete

- [ ] **Step 5: Run all metadata route tests — PASS**

- [ ] **Step 6: Commit**

```bash
git add apps/cli/src/route/metadata apps/cli/server.ts
git commit -m "$(cat <<'EOF'
feat(cli): add get/create/set/delete-metadata RPC bridges

EOF
)"
```

---

### Task 5: UI API client + hooks

**Files:**
- Create: `apps/ui/src/api/metadata.ts`
- Modify: `apps/ui/src/lib/mediaMetadataQueryKeys.ts`
- Modify: `apps/ui/src/hooks/mediaMetadata/useMediaMetadataQuery.ts`
- Create or replace: `apps/ui/src/hooks/mediaMetadata/useMediaMetadataMutation.ts`
- Modify: `apps/ui/src/hooks/mediaMetadata/index.ts` exports
- Adapt callers of `useUpdateMediaMetadataMutation` / `useFetchMediaMetadataMutation` to the new mutation (re-export aliases temporarily if needed)

**Interfaces:**
```typescript
export class MetadataHttpError extends Error {
  constructor(public problem: ProblemDetails, public status: number)
}

export async function getMetadata(path: string, signal?: AbortSignal): Promise<MediaMetadata>
// 404 → throw MetadataHttpError with status 404

export async function createMetadata(data: MediaMetadata): Promise<MediaMetadata>
export async function setMetadata(path: string, patch: MetadataPatch): Promise<MediaMetadata>
export async function deleteMetadata(path: string): Promise<void>
```

`useMediaMetadataQuery`: on 404, return `null` (use `queryFn` that catches `MetadataHttpError` with status 404). Do **not** synthesize blank metadata with `files`.

`useMediaMetadataMutation`: expose `create`, `set`, `remove` (or `deleteMetadata`) that update `mediaMetadataQueryKey`.

- [ ] **Step 1: Implement `apps/ui/src/api/metadata.ts` using `apiFetch`**

Parse ProblemDetails when `!resp.ok`.

- [ ] **Step 2: Point `mediaMetadataReadQueryOptions` at `getMetadata`**

- [ ] **Step 3: Implement `useMediaMetadataMutation` and switch call sites**

Grep:
```bash
rg "useUpdateMediaMetadataMutation|useFetchMediaMetadataMutation|mediaMetadataRepository\.(write|read)" apps/ui/src -n
```

- [ ] **Step 4: Typecheck UI**

```bash
pnpm exec tsc -p apps/ui --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add apps/ui/src/api/metadata.ts apps/ui/src/hooks/mediaMetadata apps/ui/src/lib/mediaMetadataQueryKeys.ts
git commit -m "$(cat <<'EOF'
feat(ui): read/write media metadata via Core HTTP RPCs

EOF
)"
```

---

### Task 6: Remove UI path-based metadata persistence

**Files:**
- Modify/delete usage of: `apps/ui/src/api/writeMediaMetadata.ts`, `apps/ui/src/api/readMediaMetadataV2.ts`, `apps/ui/src/api/mediaMetadataRepository.ts`, `apps/ui/src/api/deleteMediaMetadata.ts`
- Ensure no remaining `metadataCacheFilePath` in `apps/ui/src` production code (tests may mock)

- [ ] **Step 1: Grep and eliminate path writers**

```bash
rg "metadataCacheFilePath|writeMediaMetadata\(|readMediaMetadataV2" apps/ui/src -n
```

Replace remaining repository methods with HTTP client wrappers or delete the repository class if unused.

- [ ] **Step 2: Typecheck + unit tests for UI if present**

```bash
pnpm exec tsc -p apps/ui --noEmit
pnpm --filter ui test -- --run 2>/dev/null || true
```

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
refactor(ui): stop persisting metadata via writeFile cache paths

EOF
)"
```

---

### Task 7: E2E metadata HTTP helpers

**Files:**
- Create: `apps/e2e/test/lib/metadata-http.ts`
- Modify: `apps/e2e/test/lib/testbed.ts` (optional: use `deleteMetadataViaBrowser` in cleanup)
- Modify any helper like `expectMediaMetadataViaBrowser` to use get-metadata

**Pattern (browser execute + fetch to CLI origin):**

```typescript
export async function getMetadataViaBrowser(folderPath: string): Promise<MediaMetadata | null> {
  return browser.execute(async (path) => {
    const token = new URLSearchParams(location.search).get("token")
      ?? localStorage.getItem("smm-auth-token")
    const res = await fetch("/api/get-metadata", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ path }),
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(await res.text())
    const body = await res.json()
    return body.data
  }, folderPath)
}
```

Adjust auth header to match how other e2e browser helpers call APIs (reuse existing helper if one exists — prefer DRY with `browser-fs` / execute patterns in `apps/e2e/test/lib`).

- [ ] **Step 1: Add create/get/set/delete helpers**

- [ ] **Step 2: Add a small e2e or reuse debug path to smoke CRUD** (optional dedicated spec under `apps/e2e/common/other/` if lightweight)

- [ ] **Step 3: Commit**

```bash
git add apps/e2e/test/lib/metadata-http.ts
git commit -m "$(cat <<'EOF'
test(e2e): add browser helpers for metadata HTTP CRUD

EOF
)"
```

---

### Task 8: Retire legacy CLI metadata write/read routes (when unused)

**Files:**
- Modify: `apps/cli/server.ts` — unregister `handleReadMediaMetadata` / `handleWriteMediaMetadata` if no callers
- Delete or gut: `apps/cli/src/route/mediaMetadata/read.ts`, `write.ts` (keep utils only if still needed by debug)

- [ ] **Step 1: Confirm no UI/e2e callers of `/api/readMediaMetadata` or `/api/writeMediaMetadata`**

```bash
rg "readMediaMetadata|writeMediaMetadata" apps/ui apps/e2e packages -n
```

- [ ] **Step 2: Remove registration + dead code**

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
chore(cli): remove legacy read/write MediaMetadata file routes

EOF
)"
```

---

### Task 9: Regression — Movie rename e2e + Core rename path

**Files:**
- Verify: `apps/e2e/common/movie/Movie-RenameVideoFile.e2e.ts`
- Ensure recognize/import writes metadata via Core (`createMetadata` / Core import blank write) into the **same** data dir Core rename reads

- [ ] **Step 1: Confirm import/recognize path uses Core metadata helper (not UI writeFile)**

If UI still writes metadata during initialize, Task 5–6 must already have routed that through `createMetadata`/`setMetadata` HTTP.

- [ ] **Step 2: Run rename e2e**

```bash
bun ci/run-e2e-test.ts --spec ./common/movie/Movie-RenameVideoFile.e2e.ts
```

Expected: PASS; no browser console `Media metadata not found` on confirm.

- [ ] **Step 3: Commit any testbed fixes if required**

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Remove `files` | Task 1 |
| Core get/create/set/delete | Task 3 |
| set whitelist + missing errors | Task 2–3 |
| appDataDir alignment | Task 3 (`getCore` + constructor) |
| HTTP four RPCs + ProblemDetails | Task 4 |
| UI hooks via HTTP | Task 5–6 |
| E2E via execute/HTTP | Task 7 |
| Legacy route removal | Task 8 |
| Rename regression | Task 9 |

## Self-review notes

- No TBD placeholders in task steps.
- `setMetadata` signature change vs old full-document write is explicit in Task 3.
- Config vs data directory split is mandatory to avoid moving `smm.json` onto Linux data dir.
