# Core.renameFolder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `Core.renameFolder({ from, to })` in `apps/core` that mirrors `packages/core-routes` `doRenameFolder` (metadata cache + user config + on-disk rename) without editing UI or core-routes source.

**Architecture:** Extend `FsPort` with `rename`. Port `doRenameFolder` step order into a Core pipeline helper that reuses `renameFolderInMediaMetadata` and `renameFolderInUserConfig`. Throw on failure. No HTTP/CLI/UI/v3 wiring.

**Tech Stack:** TypeScript, Vitest, `apps/core` ports/adapters, `@smm/core` / `@core` path + mediaMetadata helpers.

**Spec:** `docs/superpowers/specs/2026-08-19-core-rename-folder-design.md`

## Global Constraints

- Do **not** modify `apps/ui/**` or `packages/core-routes/**` source.
- Preserve `doRenameFolder` step order and error message strings (no “improvements”).
- `Core.renameFolder` throws; return type is `Promise<void>`.
- `NetworkFsAdapter.rename` throws Not Implemented this round.
- Scope is `apps/core` (+ its tests) only; no integration.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `apps/core/src/ports/FsPort.ts` | Add `rename(from, to): Promise<void>` |
| `apps/core/src/adapters/node/NodejsFsAdapter.ts` | Implement via `fs.promises.rename` + `Path.toPlatformPath` |
| `apps/core/src/adapters/network/NetworkFsAdapter.ts` | `rename` throws NYI |
| `apps/core/src/pipeline/renameFolder.ts` | Orchestration mirroring `doRenameFolder` (pure deps injected) |
| `apps/core/src/Core.ts` | Public `renameFolder({ from, to })` → pipeline |
| `apps/core/src/Core.test.ts` | Behavior tests for renameFolder |
| Adapter `*.test.ts` | FsPort.rename coverage |
| `apps/core/src/index.ts` | Export `RenameFolderArgs` if exported from Core |

---

### Task 1: FsPort.rename + NodejsFsAdapter

**Files:**
- Modify: `apps/core/src/ports/FsPort.ts`
- Modify: `apps/core/src/adapters/node/NodejsFsAdapter.ts`
- Modify: `apps/core/src/adapters/node/NodejsFsAdapter.test.ts`

**Interfaces:**
- Produces: `FsPort.rename(from: string, to: string): Promise<void>` — paths are POSIX; adapter converts at the boundary (same as other methods).

- [ ] **Step 1: Write the failing test**

Append to `NodejsFsAdapter.test.ts`:

```typescript
  it("renames a directory on disk", async () => {
    const adapter = new NodejsFsAdapter();
    const from = joinPosix(tmpPosix, "old-dir");
    const to = joinPosix(tmpPosix, "new-dir");
    await fsp.mkdir(Path.toPlatformPath(from));
    await fsp.writeFile(join(Path.toPlatformPath(from), "a.txt"), "x");

    await adapter.rename(from, to);

    expect(await adapter.exists(from)).toBe(false);
    expect(await adapter.exists(joinPosix(to, "a.txt"))).toBe(true);
    expect(await adapter.readTextFile(joinPosix(to, "a.txt"))).toBe("x");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter core-app exec vitest run src/adapters/node/NodejsFsAdapter.test.ts`

Expected: FAIL — `adapter.rename is not a function` (or type/compile error if tests still typecheck against old interface).

- [ ] **Step 3: Minimal implementation**

In `FsPort.ts`, add:

```typescript
  /** Rename/move a file or directory. Paths are POSIX. Missing source should reject. */
  rename(from: string, to: string): Promise<void>;
```

In `NodejsFsAdapter.ts`:

```typescript
  async rename(from: string, to: string): Promise<void> {
    await fsp.rename(Path.toPlatformPath(from), Path.toPlatformPath(to));
  }
```

Temporarily stub `NetworkFsAdapter.rename` and any in-test `FsPort` objects so the package still typechecks (throw `new Error("Not Implemented")` in Network; add `rename: vi.fn()` / map-based rename in Core.test fakes in this step **only if** TypeScript fails the build — otherwise leave those stubs for Tasks 2–3).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter core-app exec vitest run src/adapters/node/NodejsFsAdapter.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/ports/FsPort.ts \
  apps/core/src/adapters/node/NodejsFsAdapter.ts \
  apps/core/src/adapters/node/NodejsFsAdapter.test.ts \
  apps/core/src/adapters/network/NetworkFsAdapter.ts
git commit -m "feat(core): add FsPort.rename for NodejsFsAdapter"
```

(Include Network stub in this commit if required for typecheck.)

---

### Task 2: NetworkFsAdapter.rename Not Implemented

**Files:**
- Modify: `apps/core/src/adapters/network/NetworkFsAdapter.ts`
- Modify: `apps/core/src/adapters/network/NetworkFsAdapter.test.ts`

**Interfaces:**
- Consumes: `FsPort.rename`
- Produces: `NetworkFsAdapter.rename` always rejects with a clear Not Implemented error (no HTTP call).

- [ ] **Step 1: Write the failing test**

```typescript
  it("rename throws Not Implemented", async () => {
    const { network } = mockNetwork();
    const adapter = new NetworkFsAdapter({ network, baseUrl: "http://127.0.0.1:30000" });

    await expect(adapter.rename("/m/a", "/m/b")).rejects.toThrow(/Not Implemented/i);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter core-app exec vitest run src/adapters/network/NetworkFsAdapter.test.ts`

Expected: FAIL — missing `rename` or wrong error.

- [ ] **Step 3: Implement**

```typescript
  async rename(_from: string, _to: string): Promise<void> {
    throw new Error("Not Implemented: NetworkFsAdapter.rename");
  }
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter core-app exec vitest run src/adapters/network/NetworkFsAdapter.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/adapters/network/NetworkFsAdapter.ts \
  apps/core/src/adapters/network/NetworkFsAdapter.test.ts
git commit -m "feat(core): stub NetworkFsAdapter.rename as Not Implemented"
```

---

### Task 3: Core.renameFolder happy path (TDD)

**Files:**
- Create: `apps/core/src/pipeline/renameFolder.ts`
- Modify: `apps/core/src/Core.ts`
- Modify: `apps/core/src/Core.test.ts` (extend `inMemoryFs` with `rename`; add describe block)
- Modify: `apps/core/src/index.ts` (export `RenameFolderArgs` if defined on Core)

**Interfaces:**
- Consumes: `FsPort.rename`, `UserConfig`, `metadataCachePath`, `renameFolderInMediaMetadata`, `renameFolderInUserConfig`, `Path`
- Produces:
  - `export interface RenameFolderArgs { from: string; to: string }`
  - `Core.renameFolder(args: RenameFolderArgs): Promise<void>`
  - `export async function renameFolderPipeline(...): Promise<void>` (internal orchestration)

**Reference logic (do not edit):** `packages/core-routes/src/renameFolder.ts` `doRenameFolder` lines 37–86.

- [ ] **Step 1: Extend `inMemoryFs` in `Core.test.ts` with `rename`**

Move map keys under `from` / `from/` to `to` / `to/` (directory move semantics). Example:

```typescript
    rename: vi.fn(async (from: string, to: string) => {
      if (!files.has(from) && ![...files.keys()].some((k) => k === from || k.startsWith(from + "/"))) {
        throw new Error("ENOENT: " + from);
      }
      const entries = [...files.entries()];
      for (const [key, value] of entries) {
        if (key === from || key.startsWith(from + "/")) {
          files.delete(key);
          files.set(to + key.slice(from.length), value);
        }
      }
      // Ensure destination directory marker if only empty dirs matter — file keys alone are enough for these tests.
    }),
```

Also update **every** other inline `FsPort` object in `Core.test.ts` (e.g. concurrent unimport fake) with a `rename` stub (`async () => {}` or `vi.fn()`) so the file typechecks.

- [ ] **Step 2: Write failing happy-path test**

```typescript
describe("renameFolder", () => {
  it("updates metadata cache, user config, and renames on disk", async () => {
    const from = "/m/Show";
    const to = "/m/Show Renamed";
    const oldCache = metadataCachePath("/data/smm", from);
    const newCache = metadataCachePath("/data/smm", to);
    const mm = {
      mediaFolderPath: from,
      type: "tvshow-folder" as const,
      files: [`${from}/S01E01.mkv`],
      mediaFiles: [{ absolutePath: `${from}/S01E01.mkv` }],
    };
    const fs = inMemoryFs({
      [userConfigPath("/data/smm")]: JSON.stringify({
        folders: [from],
        tmdb: {},
        tvdb: {},
        renameRules: [],
        dryRun: false,
        selectedRenameRule: "plex",
      }),
      [oldCache]: JSON.stringify(mm),
      [`${from}/S01E01.mkv`]: "",
    });
    const core = new Core({ fs, network: emptyNetwork(), appDataDir: "/data/smm" });

    await core.renameFolder({ from, to });

    expect(await fs.exists(oldCache)).toBe(false);
    expect(await fs.exists(newCache)).toBe(true);
    const written = JSON.parse(await fs.readTextFile(newCache)) as typeof mm;
    expect(written.mediaFolderPath).toBe(to);
    expect(written.files).toEqual([`${to}/S01E01.mkv`]);
    expect(written.mediaFiles?.[0]?.absolutePath).toBe(`${to}/S01E01.mkv`);

    const folders = await core.getFolders();
    // renameFolderInUserConfig stores Path.toPlatformPath(to)
    expect(folders.map((f) => Path.posix(f))).toEqual([Path.posix(to)]);

    expect(fs.rename).toHaveBeenCalledWith(from, to);
    expect(await fs.exists(`${to}/S01E01.mkv`)).toBe(true);
  });
});
```

Import `Path` is already present in `Core.test.ts`.

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter core-app exec vitest run src/Core.test.ts -t renameFolder`

Expected: FAIL — `core.renameFolder is not a function`.

- [ ] **Step 4: Implement pipeline + Core method**

Create `apps/core/src/pipeline/renameFolder.ts`:

```typescript
import { Path } from "@core/path";
import { renameFolderInMediaMetadata } from "@core/mediaMetadata";
import { renameFolderInUserConfig } from "@core/userConfig";
import type { MediaMetadata } from "@smm/core";
import type { FsPort } from "../ports/FsPort";
import { metadataCachePath } from "./paths";
import type { UserConfig } from "./userConfig";

export interface RenameFolderArgs {
  from: string;
  to: string;
}

export interface RenameFolderDeps {
  fs: FsPort;
  appDataDir: string;
  userConfig: UserConfig;
  normalizePosix: (path: string) => string;
}

function isManaged(folders: string[], mediaFolderPath: string): boolean {
  const targetPlatform = Path.toPlatformPath(mediaFolderPath);
  const targetPosix = Path.posix(mediaFolderPath);
  return folders.some(
    (folder) =>
      Path.toPlatformPath(folder) === targetPlatform || Path.posix(folder) === targetPosix,
  );
}

/** Mirrors packages/core-routes doRenameFolder orchestration (throws instead of { error }). */
export async function renameFolderPipeline(
  args: RenameFolderArgs,
  deps: RenameFolderDeps,
): Promise<void> {
  const fromAsPosix = Path.posix(args.from);
  const toAsPosix = Path.posix(args.to);

  const config = await deps.userConfig.read();
  if (!isManaged(config.folders ?? [], args.from)) {
    throw new Error(`${fromAsPosix} is not managed by SMM`);
  }

  const cachePath = metadataCachePath(deps.appDataDir, fromAsPosix);
  if (!(await deps.fs.exists(cachePath))) {
    throw new Error(`Media metadata not found: ${args.from}`);
  }
  let mediaMetadata: MediaMetadata;
  try {
    mediaMetadata = JSON.parse(await deps.fs.readTextFile(cachePath)) as MediaMetadata;
  } catch {
    throw new Error(`Media metadata not found: ${args.from}`);
  }

  const updatedMetadata = renameFolderInMediaMetadata(mediaMetadata, fromAsPosix, toAsPosix);
  if (!updatedMetadata.mediaFolderPath) {
    throw new Error("Media folder path is required");
  }
  const newCachePath = metadataCachePath(deps.appDataDir, Path.posix(updatedMetadata.mediaFolderPath));
  await deps.fs.writeTextFile(newCachePath, JSON.stringify(updatedMetadata, null, 2));
  await deps.fs.deleteFile(cachePath);

  await deps.userConfig.update((current) =>
    renameFolderInUserConfig(current, fromAsPosix, toAsPosix),
  );

  await deps.fs.rename(fromAsPosix, toAsPosix);
}
```

Note: Prefer matching `doRenameFolder`’s “metadata not found” path (null from read helper) rather than inventing new messages. If `readTextFile` throws ENOENT, map to the same message. Do **not** add validation schema unless tests require it.

In `Core.ts`:

```typescript
import { renameFolderPipeline, type RenameFolderArgs } from "./pipeline/renameFolder";

  async renameFolder(args: RenameFolderArgs): Promise<void> {
    await renameFolderPipeline(args, {
      fs: this.fs,
      appDataDir: this.appDataDir,
      userConfig: this.userConfig,
      normalizePosix: (path) => this.normalizePosix(path),
    });
  }
```

Export `RenameFolderArgs` from `apps/core/src/index.ts` alongside `Core`.

Use `@core/mediaMetadata` and `@core/userConfig` (same `@core/*` → `packages/core/*` alias as `Path`). Do **not** use `@smm/core/mediaMetadata` in apps/core — tsconfig maps `@smm/core` only to `types.ts`.

- [ ] **Step 5: Run happy-path test**

Run: `pnpm --filter core-app exec vitest run src/Core.test.ts -t "updates metadata cache"`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/core/src/pipeline/renameFolder.ts \
  apps/core/src/Core.ts \
  apps/core/src/Core.test.ts \
  apps/core/src/index.ts
git commit -m "feat(core): add Core.renameFolder happy path"
```

---

### Task 4: Core.renameFolder rejection paths

**Files:**
- Modify: `apps/core/src/Core.test.ts`
- Modify: `apps/core/src/pipeline/renameFolder.ts` only if messages/behavior need alignment

**Interfaces:**
- Consumes: `Core.renameFolder`
- Produces: stable throw messages matching `doRenameFolder`

- [ ] **Step 1: Write failing rejection tests**

```typescript
  it("rejects when the folder is not managed", async () => {
    const fs = inMemoryFs({
      [userConfigPath("/data/smm")]: JSON.stringify({
        folders: ["/m/Other"],
        tmdb: {},
        tvdb: {},
        renameRules: [],
        dryRun: false,
        selectedRenameRule: "plex",
      }),
    });
    const core = new Core({ fs, network: emptyNetwork(), appDataDir: "/data/smm" });

    await expect(core.renameFolder({ from: "/m/Show", to: "/m/X" })).rejects.toThrow(
      "/m/Show is not managed by SMM",
    );
    expect(fs.rename).not.toHaveBeenCalled();
  });

  it("rejects when media metadata cache is missing", async () => {
    const from = "/m/Show";
    const fs = inMemoryFs({
      [userConfigPath("/data/smm")]: JSON.stringify({
        folders: [from],
        tmdb: {},
        tvdb: {},
        renameRules: [],
        dryRun: false,
        selectedRenameRule: "plex",
      }),
    });
    const core = new Core({ fs, network: emptyNetwork(), appDataDir: "/data/smm" });

    await expect(core.renameFolder({ from, to: "/m/X" })).rejects.toThrow(
      `Media metadata not found: ${from}`,
    );
    expect(fs.rename).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run tests — expect FAIL only if implementation missing; otherwise PASS**

Run: `pnpm --filter core-app exec vitest run src/Core.test.ts -t renameFolder`

If Task 3 already implemented the throws correctly, these should PASS immediately — that is OK **only if** you first confirm they would fail when the throw lines are temporarily removed (red-green check per project unit-test guideline): briefly comment out the managed/metadata checks, run once to see FAIL, restore, run PASS.

- [ ] **Step 3: Align messages if needed**

Ensure unmanaged uses **posix** `fromAsPosix` in the message (as `doRenameFolder` does) and missing metadata uses the raw `from` argument string.

- [ ] **Step 4: Full core-app test run**

Run: `pnpm --filter core-app test`

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/Core.test.ts apps/core/src/pipeline/renameFolder.ts
git commit -m "test(core): cover renameFolder unmanaged and missing metadata"
```

---

### Task 5: Final verification

- [ ] **Step 1: Typecheck**

Run: `pnpm --filter core-app typecheck`

Expected: exit 0.

- [ ] **Step 2: Confirm no UI / core-routes edits**

Run: `git diff --name-only HEAD~5..HEAD` (or since branch point) and assert no `apps/ui/` or `packages/core-routes/` paths in the renameFolder commits.

- [ ] **Step 3: Optional doc touch** — none required beyond existing design; do not invent HTTP docs.

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| `Core.renameFolder({ from, to })` throws | 3–4 |
| Step order = doRenameFolder | 3 (`renameFolderPipeline`) |
| Reuse pure helpers; leave UI/core-routes untouched | 3, Global Constraints, Task 5 |
| `FsPort.rename`; Node implements; Network NYI | 1–2 |
| Happy path: cache + config + disk | 3 |
| Unmanaged / missing metadata errors | 4 |
| No integration / v3 wiring | Global Constraints |

No TBD placeholders. Signatures consistent: `RenameFolderArgs`, `FsPort.rename(from, to)`.
