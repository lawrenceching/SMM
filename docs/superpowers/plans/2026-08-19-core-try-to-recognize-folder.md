# Core.tryToRecognizeFolder / applyPlan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `Core.tryToRecognizeFolder`, `Core.getPlan`, and `Core.applyPlan` (recognize-media-file only) plus CLI `smm try-to-recognize` / `smm apply`, without changing UI or core-routes plan HTTP APIs.

**Architecture:** Persist plans under `{appDataDir}/plans/{id}.plan.json` via `FsPort`. List on-disk files with `FsPort.listFiles`, match with existing `recognizeEpisodes`, merge `mediaFiles` with a port of UI `updateMediaFileMetadatas` semantics, then delete the plan file on apply.

**Tech Stack:** TypeScript, Vitest, `apps/core` ports/adapters, Commander CLI in `apps/cli`, `@smm/core` plan types.

**Spec:** `docs/superpowers/specs/2026-08-19-core-try-to-recognize-folder-design.md`

## Global Constraints

- Do **not** modify `apps/ui/**` or `packages/core-routes/**` source.
- Scope is **Core + CLI only** (no HTTP / v3 / UI wiring).
- Reuse `apps/core/src/pipeline/recognizeEpisodes.ts`; do not re-port UI Worker `recognizeEpisodesAsync`.
- Zero matches → return / persist pending plan with `files: []` (do **not** throw solely for empty matches).
- Do **not** persist deprecated `MediaMetadata.files` (listFiles is in-memory for matching only; `setMetadata` already strips `files`).
- `applyPlan` this milestone supports only `task === "recognize-media-file"`; other tasks throw.
- Core methods throw `Error` (CLI prints message, exit 1).

---

## File Structure

| File | Responsibility |
|------|----------------|
| `apps/core/src/pipeline/paths.ts` | Add `planFilePath(appDataDir, id)` |
| `apps/core/src/pipeline/updateMediaFileMetadatas.ts` | Pure merge helper (UI parity) |
| `apps/core/src/pipeline/updateMediaFileMetadatas.test.ts` | Unit tests for merge |
| `apps/core/src/pipeline/plans.ts` | Read/write/delete plan JSON via `FsPort` |
| `apps/core/src/pipeline/plans.test.ts` | Plan storage tests |
| `apps/core/src/pipeline/tryToRecognizeFolder.ts` | Orchestration for try-to-recognize |
| `apps/core/src/pipeline/applyPlan.ts` | Orchestration for apply (recognize only) |
| `apps/core/src/Core.ts` | Public `tryToRecognizeFolder` / `getPlan` / `applyPlan` |
| `apps/core/src/Core.test.ts` | Integration-style Core tests |
| `apps/core/src/index.ts` | Export `Plan` type alias if useful |
| `apps/cli/src/cli/runCli.ts` | Register `try-to-recognize` and `apply` |
| `apps/cli/test/recognize-e2e.test.ts` | CLI round-trip e2e |
| `docs/api/index.md` | Brief CLI note (optional; include in Task 5) |

---

### Task 1: Pure `updateMediaFileMetadatas`

**Files:**
- Create: `apps/core/src/pipeline/updateMediaFileMetadatas.ts`
- Create: `apps/core/src/pipeline/updateMediaFileMetadatas.test.ts`

**Interfaces:**
- Produces: `updateMediaFileMetadatas(mediaFiles, videoFilePath, seasonNumber, episodeNumber): MediaFileMetadata[]`
- Semantics: remove any entry with the same season/episode **or** same `absolutePath`, then append `{ absolutePath, seasonNumber, episodeNumber }` (paths stored as POSIX via `Path.posix`).

- [ ] **Step 1: Write the failing test**

Create `apps/core/src/pipeline/updateMediaFileMetadatas.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { updateMediaFileMetadatas } from "./updateMediaFileMetadatas";

describe("updateMediaFileMetadatas", () => {
  it("adds a new mapping", () => {
    const next = updateMediaFileMetadatas([], "/m/Show/S01E01.mkv", 1, 1);
    expect(next).toEqual([
      { absolutePath: "/m/Show/S01E01.mkv", seasonNumber: 1, episodeNumber: 1 },
    ]);
  });

  it("replaces same season/episode and same path", () => {
    const prev = [
      { absolutePath: "/m/Show/old.mkv", seasonNumber: 1, episodeNumber: 1 },
      { absolutePath: "/m/Show/S01E02.mkv", seasonNumber: 1, episodeNumber: 2 },
    ];
    const next = updateMediaFileMetadatas(prev, "/m/Show/S01E01.mkv", 1, 1);
    expect(next).toEqual([
      { absolutePath: "/m/Show/S01E02.mkv", seasonNumber: 1, episodeNumber: 2 },
      { absolutePath: "/m/Show/S01E01.mkv", seasonNumber: 1, episodeNumber: 1 },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter core-app exec vitest run src/pipeline/updateMediaFileMetadatas.test.ts`

Expected: FAIL — module not found / cannot resolve `./updateMediaFileMetadatas`.

- [ ] **Step 3: Minimal implementation**

Create `apps/core/src/pipeline/updateMediaFileMetadatas.ts`:

```typescript
import { Path } from "@core/path";
import type { MediaFileMetadata } from "@smm/core";

/** Same semantics as apps/ui TvShowPanelUtils.updateMediaFileMetadatas. */
export function updateMediaFileMetadatas(
  mediaFiles: MediaFileMetadata[],
  videoFilePath: string,
  seasonNumber: number,
  episodeNumber: number,
): MediaFileMetadata[] {
  const absolutePath = Path.posix(videoFilePath);
  const next = mediaFiles
    .filter((m) => !(m.seasonNumber === seasonNumber && m.episodeNumber === episodeNumber))
    .filter((m) => m.absolutePath !== absolutePath);
  next.push({ absolutePath, seasonNumber, episodeNumber });
  return next;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter core-app exec vitest run src/pipeline/updateMediaFileMetadatas.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/pipeline/updateMediaFileMetadatas.ts \
  apps/core/src/pipeline/updateMediaFileMetadatas.test.ts
git commit -m "feat(core): add updateMediaFileMetadatas for recognize apply"
```

---

### Task 2: Plan file path + FsPort storage helpers

**Files:**
- Modify: `apps/core/src/pipeline/paths.ts`
- Create: `apps/core/src/pipeline/plans.ts`
- Create: `apps/core/src/pipeline/plans.test.ts`

**Interfaces:**
- Produces:
  - `planFilePath(appDataDir: string, planId: string): string` → `{appDataDir}/plans/{id}.plan.json` (POSIX via `joinPosix`)
  - `type Plan = RecognizeMediaFilePlan | RenameFilesPlan`
  - `writePlan(fs, appDataDir, plan): Promise<void>`
  - `readPlan(fs, appDataDir, id): Promise<Plan | null>`
  - `deletePlan(fs, appDataDir, id): Promise<void>` (idempotent via `fs.deleteFile`)

- [ ] **Step 1: Write the failing test**

Create `apps/core/src/pipeline/plans.test.ts` (reuse a tiny in-memory `FsPort` like `Core.test.ts`, or import a shared fake if you extract one — duplicating the Map fake in this file is fine):

```typescript
import { describe, expect, it, vi } from "vitest";
import type { FsPort } from "../ports/FsPort";
import type { RecognizeMediaFilePlan } from "@smm/core/types/RecognizeMediaFilePlan";
import { planFilePath } from "./paths";
import { deletePlan, readPlan, writePlan } from "./plans";

function inMemoryFs(): FsPort & { raw: Map<string, string> } {
  const files = new Map<string, string>();
  return {
    raw: files,
    readTextFile: vi.fn(async (path: string) => {
      const v = files.get(path);
      if (v === undefined) throw new Error("ENOENT: " + path);
      return v;
    }),
    writeTextFile: vi.fn(async (path: string, content: string) => {
      files.set(path, content);
    }),
    exists: vi.fn(async (path: string) => files.has(path)),
    listFiles: vi.fn(async () => []),
    deleteFile: vi.fn(async (path: string) => {
      files.delete(path);
    }),
    rename: vi.fn(async () => {}),
  };
}

describe("plans storage", () => {
  it("writes and reads a recognize plan", async () => {
    const fs = inMemoryFs();
    const plan: RecognizeMediaFilePlan = {
      id: "p1",
      task: "recognize-media-file",
      status: "pending",
      creator: "app",
      mediaFolderPath: "/m/Show",
      files: [{ season: 1, episode: 1, path: "/m/Show/S01E01.mkv" }],
    };
    await writePlan(fs, "/data", plan);
    expect(fs.raw.has(planFilePath("/data", "p1"))).toBe(true);
    await expect(readPlan(fs, "/data", "p1")).resolves.toEqual(plan);
  });

  it("deletePlan is idempotent", async () => {
    const fs = inMemoryFs();
    await deletePlan(fs, "/data", "missing");
    expect(fs.deleteFile).toHaveBeenCalledWith(planFilePath("/data", "missing"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter core-app exec vitest run src/pipeline/plans.test.ts`

Expected: FAIL — missing `./plans` or `planFilePath`.

- [ ] **Step 3: Minimal implementation**

In `paths.ts` add:

```typescript
/** `<appDataDir>/plans/{id}.plan.json`, POSIX form (same layout as core-routes). */
export function planFilePath(appDataDir: string, planId: string): string {
  return joinPosix(Path.posix(appDataDir), "plans", `${planId}.plan.json`);
}
```

Create `plans.ts`:

```typescript
import type { RecognizeMediaFilePlan } from "@smm/core/types/RecognizeMediaFilePlan";
import type { RenameFilesPlan } from "@smm/core/types/RenameFilesPlan";
import type { FsPort } from "../ports/FsPort";
import { planFilePath } from "./paths";

export type Plan = RecognizeMediaFilePlan | RenameFilesPlan;

export async function writePlan(fs: FsPort, appDataDir: string, plan: Plan): Promise<void> {
  await fs.writeTextFile(planFilePath(appDataDir, plan.id), JSON.stringify(plan, null, 2));
}

export async function readPlan(
  fs: FsPort,
  appDataDir: string,
  id: string,
): Promise<Plan | null> {
  const path = planFilePath(appDataDir, id);
  if (!(await fs.exists(path))) return null;
  try {
    return JSON.parse(await fs.readTextFile(path)) as Plan;
  } catch {
    return null;
  }
}

export async function deletePlan(fs: FsPort, appDataDir: string, id: string): Promise<void> {
  await fs.deleteFile(planFilePath(appDataDir, id));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter core-app exec vitest run src/pipeline/plans.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/pipeline/paths.ts \
  apps/core/src/pipeline/plans.ts \
  apps/core/src/pipeline/plans.test.ts
git commit -m "feat(core): add plan file storage helpers"
```

---

### Task 3: `tryToRecognizeFolder` pipeline + Core method

**Files:**
- Create: `apps/core/src/pipeline/tryToRecognizeFolder.ts`
- Modify: `apps/core/src/Core.ts`
- Modify: `apps/core/src/Core.test.ts`
- Modify: `apps/core/src/index.ts` (export if needed)

**Interfaces:**
- Consumes: `UserConfig.read`, `FsPort.listFiles` / `writeTextFile`, `recognizeEpisodes`, `writePlan`, `metadataCachePath` / metadata read
- Produces: `tryToRecognizeFolderPipeline(path, deps): Promise<RecognizeMediaFilePlan>`
- Produces: `Core.tryToRecognizeFolder(path: string): Promise<RecognizeMediaFilePlan>`

**Deps shape:**

```typescript
export interface TryToRecognizeFolderDeps {
  fs: FsPort;
  appDataDir: string;
  userConfig: UserConfig;
  normalizePosix: (path: string) => string;
  /** Injected for tests; default `randomUUID` from `node:crypto`. */
  createId?: () => string;
}
```

**Behavior (must match spec):**

1. `isManaged` same compare as `renameFolder.ts` (`Path.toPlatformPath` + `Path.posix`).
2. Throw `{posix} is not managed by SMM` if unmanaged.
3. Read metadata cache; throw `Media metadata not found: {path}` if missing/corrupt.
4. If `type !== "tvshow-folder"` OR no `tvShow.seasons` with at least one episode → throw `Folder is not a TV show with episodes: {path}` (use original `path` or posix consistently; prefer the caller `path` string in the message like renameFolder’s metadata miss).
5. `listed = await fs.listFiles(posixPath)` → map each with `Path.posix`.
6. `recognizeEpisodes({ ...mm, mediaFolderPath: posixPath, files: listedPosix })`.
7. Map results to `RecognizedFile[]` (`path: Path.posix(file)`, season, episode). Empty array allowed.
8. Build plan: `status: "pending"`, `creator: "app"`, `task: "recognize-media-file"`, `id: createId()`.
9. `writePlan`; return plan.

- [ ] **Step 1: Write the failing Core tests**

Append to `Core.test.ts` a new `describe("tryToRecognizeFolder", () => { ... })` using existing `inMemoryFs` / `emptyNetwork`. Seed:

- `userConfigPath("/data")` with `folders: ["/m/Show"]`
- metadata cache for `/m/Show` with `type: "tvshow-folder"`, `tvShow: { id: "1", name: "Show", seasons: [{ season: 1, episodes: [{ season: 1, episode: 1 }, { season: 1, episode: 2 }] }] }`, `mediaFiles: []`
- Disk keys: `"/m/Show/S01E01.mkv": ""`, `"/m/Show/S01E02.mkv": ""` (so `listFiles` returns them)

```typescript
describe("tryToRecognizeFolder", () => {
  it("creates a pending plan with matched files", async () => {
    // seed as above; use vi.spyOn or inject createId via making Core call pipeline —
    // Prefer testing through Core: stub randomUUID by exporting createId only on pipeline
    // and calling Core which uses randomUUID — assert plan.id is uuid-shaped OR
    // read whatever id is returned.
    const core = new Core({ fs, network: emptyNetwork(), appDataDir: "/data" });
    const plan = await core.tryToRecognizeFolder("/m/Show");
    expect(plan.task).toBe("recognize-media-file");
    expect(plan.status).toBe("pending");
    expect(plan.creator).toBe("app");
    expect(plan.files).toEqual([
      { season: 1, episode: 1, path: "/m/Show/S01E01.mkv" },
      { season: 1, episode: 2, path: "/m/Show/S01E02.mkv" },
    ]);
    expect(await fs.exists(planFilePath("/data", plan.id))).toBe(true);
  });

  it("returns pending plan with empty files when nothing matches", async () => {
    // same metadata seasons, but only "/m/Show/random.mkv"
    const plan = await core.tryToRecognizeFolder("/m/Show");
    expect(plan.files).toEqual([]);
    expect(plan.status).toBe("pending");
  });

  it("rejects unmanaged folders", async () => {
    await expect(core.tryToRecognizeFolder("/m/Other")).rejects.toThrow(/not managed by SMM/);
  });
});
```

Also import `planFilePath` from `./pipeline/paths`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter core-app exec vitest run src/Core.test.ts -t tryToRecognizeFolder`

Expected: FAIL — `tryToRecognizeFolder is not a function`.

- [ ] **Step 3: Implement pipeline + Core wrapper**

Create `tryToRecognizeFolder.ts` implementing the steps above (copy `isManaged` from `renameFolder.ts` into this file or a tiny shared helper — duplicating the 8-line function is OK for this milestone).

In `Core.ts`:

```typescript
import { tryToRecognizeFolderPipeline } from "./pipeline/tryToRecognizeFolder";
import type { RecognizeMediaFilePlan } from "@smm/core/types/RecognizeMediaFilePlan";

async tryToRecognizeFolder(path: string): Promise<RecognizeMediaFilePlan> {
  return tryToRecognizeFolderPipeline(path, {
    fs: this.fs,
    appDataDir: this.appDataDir,
    userConfig: this.userConfig,
    normalizePosix: (p) => this.normalizePosix(p),
  });
}
```

Use `import { randomUUID } from "node:crypto"` inside the pipeline default `createId`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter core-app exec vitest run src/Core.test.ts -t tryToRecognizeFolder`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/pipeline/tryToRecognizeFolder.ts \
  apps/core/src/Core.ts \
  apps/core/src/Core.test.ts \
  apps/core/src/index.ts
git commit -m "feat(core): add Core.tryToRecognizeFolder"
```

---

### Task 4: `getPlan` + `applyPlan`

**Files:**
- Create: `apps/core/src/pipeline/applyPlan.ts`
- Modify: `apps/core/src/Core.ts`
- Modify: `apps/core/src/Core.test.ts`
- Modify: `apps/core/src/index.ts` — export `type Plan` from `./pipeline/plans`

**Interfaces:**
- Consumes: `readPlan`, `deletePlan`, `updateMediaFileMetadatas`, `getMediaMetadata`/`setMetadata` via deps
- Produces:
  - `Core.getPlan(id: string): Promise<Plan>` — throws `Plan not found: {id}` if null
  - `Core.applyPlan(plan: Plan): Promise<void>`

**`applyPlan` behavior:**

1. If `plan.task !== "recognize-media-file"` → throw `Unsupported plan task: {task}`.
2. Load metadata for `plan.mediaFolderPath`; throw `Media metadata not found: {path}` if missing.
3. Start from `mediaMetadata.mediaFiles ?? []`; for each `plan.files` entry call `updateMediaFileMetadatas(..., file.path, file.season, file.episode)`.
4. `setMetadata({ ...mm, mediaFiles })` (via writing cache the same way as `Core.setMetadata`, or call through deps).
5. `deletePlan(fs, appDataDir, plan.id)`.
6. Empty `files` still deletes the plan.

Prefer implementing apply in `applyPlan.ts` with deps `{ fs, appDataDir, getMediaMetadata, setMetadata }` **or** inline metadata read/write like rename pipeline — pick one style and stay consistent with `tryToRecognizeFolder.ts` (inject `fs` + `appDataDir` + `normalizePosix` and read/write cache directly is fine).

- [ ] **Step 1: Write the failing tests**

In `Core.test.ts`:

```typescript
describe("applyPlan", () => {
  it("merges mediaFiles and deletes the plan file", async () => {
    const core = /* seeded Show with empty mediaFiles + pending plan already written OR tryToRecognize first */;
    const plan = await core.tryToRecognizeFolder("/m/Show");
    await core.applyPlan(plan);
    const mm = await core.getMediaMetadata("/m/Show");
    expect(mm?.mediaFiles).toEqual([
      { absolutePath: "/m/Show/S01E01.mkv", seasonNumber: 1, episodeNumber: 1 },
      { absolutePath: "/m/Show/S01E02.mkv", seasonNumber: 1, episodeNumber: 2 },
    ]);
    expect(await fs.exists(planFilePath("/data", plan.id))).toBe(false);
  });

  it("applies empty files plan as no-op on mediaFiles but deletes plan", async () => {
    // seed unmatched videos; tryToRecognize → files []; apply
    const before = await core.getMediaMetadata("/m/Show");
    const plan = await core.tryToRecognizeFolder("/m/Show");
    expect(plan.files).toEqual([]);
    await core.applyPlan(plan);
    const after = await core.getMediaMetadata("/m/Show");
    expect(after?.mediaFiles).toEqual(before?.mediaFiles ?? []);
    expect(await fs.exists(planFilePath("/data", plan.id))).toBe(false);
  });

  it("getPlan throws when missing", async () => {
    await expect(core.getPlan("nope")).rejects.toThrow("Plan not found: nope");
  });

  it("rejects unsupported tasks", async () => {
    await expect(
      core.applyPlan({
        id: "r1",
        task: "rename-files",
        status: "pending",
        creator: "app",
        mediaFolderPath: "/m/Show",
        files: [],
      }),
    ).rejects.toThrow(/Unsupported plan task/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter core-app exec vitest run src/Core.test.ts -t "applyPlan|getPlan"`

Expected: FAIL — methods missing.

- [ ] **Step 3: Implement**

```typescript
// Core.ts
import { applyRecognizeMediaFilePlanPipeline } from "./pipeline/applyPlan";
import { readPlan, type Plan } from "./pipeline/plans";

async getPlan(id: string): Promise<Plan> {
  const plan = await readPlan(this.fs, this.appDataDir, id);
  if (!plan) throw new Error(`Plan not found: ${id}`);
  return plan;
}

async applyPlan(plan: Plan): Promise<void> {
  await applyRecognizeMediaFilePlanPipeline(plan, {
    fs: this.fs,
    appDataDir: this.appDataDir,
    normalizePosix: (p) => this.normalizePosix(p),
    setMetadata: (mm) => this.setMetadata(mm),
    getMediaMetadata: (folder) => this.getMediaMetadata(folder),
  });
}
```

In `applyPlan.ts`, implement the recognize-only branch and `deletePlan` after success.

Export `Plan` from `index.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter core-app exec vitest run src/Core.test.ts`

Expected: PASS (full Core suite still green).

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/pipeline/applyPlan.ts \
  apps/core/src/Core.ts \
  apps/core/src/Core.test.ts \
  apps/core/src/index.ts
git commit -m "feat(core): add Core.getPlan and applyPlan for recognize"
```

---

### Task 5: CLI `try-to-recognize` / `apply` + e2e

**Files:**
- Modify: `apps/cli/src/cli/runCli.ts`
- Create: `apps/cli/test/recognize-e2e.test.ts`
- Modify: `docs/api/index.md` (short “CLI recognize” note under a sensible heading, or append near RenameFolder v3)

**Interfaces:**
- Consumes: `getCore().tryToRecognizeFolder` / `getPlan` / `applyPlan`
- CLI:
  - `smm try-to-recognize <folder>`
  - `smm apply <plan-id>`

- [ ] **Step 1: Write the failing e2e test**

Create `apps/cli/test/recognize-e2e.test.ts` mirroring `rename-e2e.test.ts` setup (`USER_DATA_DIR`, `createAndImportInitializedFolder`, `tvShowFolder`).

```typescript
it("try-to-recognize then apply updates mediaFiles", async () => {
  const folder = await createAndImportInitializedFolder(mediaDir, { ...tvShowFolder }, {
    updateMediaMetadata: (mm) => ({ ...mm, mediaFiles: [] }),
  });
  const path = folder.path!;

  const tried = await smm(["try-to-recognize", path]);
  expect(tried.code, tried.stderr || tried.stdout).toBe(0);
  expect(tried.stdout).toMatch(/plan:\s+[0-9a-f-]{36}/i);
  const planId = tried.stdout.match(/plan:\s+([0-9a-f-]{36})/i)?.[1];
  expect(planId).toBeTruthy();

  const applied = await smm(["apply", planId!]);
  expect(applied.code, applied.stderr || applied.stdout).toBe(0);

  const mm = await getCore().getMediaMetadata(path);
  expect(mm?.mediaFiles?.length).toBeGreaterThan(0);
  expect(mm?.mediaFiles?.[0]?.seasonNumber).toBe(1);
});
```

(Adjust assertions to match real template seasons/files in `天使降临到我身边.metadata.json` + `tvShowFolder` file names — if template seasons do not include S01E01.. from fixture, either use `updateMediaMetadata` to set seasons that match fixture names, or assert against whatever `recognizeEpisodes` returns for that fixture.)

- [ ] **Step 2: Run e2e to verify it fails**

Run: `pnpm --filter cli exec vitest run test/recognize-e2e.test.ts`

Expected: FAIL — unknown command `try-to-recognize` / exit !== 0.

- [ ] **Step 3: Implement CLI commands**

In `runCli.ts`, after `rm` (or near metadata):

```typescript
  program
    .command('try-to-recognize')
    .description('Build a pending recognize-media-file plan for a TV show folder')
    .argument('<folder>', 'Imported media folder path')
    .action(async (folder: string) => {
      try {
        const plan = await getCore().tryToRecognizeFolder(folder)
        console.log(`plan: ${plan.id}`)
        console.log(`task: ${plan.task}`)
        console.log(`status: ${plan.status}`)
        console.log(`folder: ${plan.mediaFolderPath}`)
        console.log('files:')
        if (plan.files.length === 0) {
          console.log('  (none)')
        } else {
          for (const f of plan.files) {
            const ep = `S${String(f.season).padStart(2, '0')}E${String(f.episode).padStart(2, '0')}`
            console.log(`  ${ep}  ${f.path}`)
          }
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error))
        exitCode = 1
      }
    })

  program
    .command('apply')
    .description('Apply a pending plan by id (recognize-media-file)')
    .argument('<planId>', 'Plan id from try-to-recognize')
    .action(async (planId: string) => {
      try {
        const plan = await getCore().getPlan(planId)
        await getCore().applyPlan(plan)
        const count = plan.task === 'recognize-media-file' ? plan.files.length : 0
        console.log(`applied ${plan.id} (${count} file(s))`)
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error))
        exitCode = 1
      }
    })
```

Add a short section to `docs/api/index.md`:

```markdown
## CLI: try-to-recognize / apply
Source Code: apps/cli/src/cli/runCli.ts + apps/core Core.tryToRecognizeFolder / applyPlan
`smm try-to-recognize <folder>` — rule-based episode recognition → pending plan under `{userDataDir}/plans/`.
`smm apply <plan-id>` — apply recognize-media-file plan (updates metadata cache, deletes plan file).
```

- [ ] **Step 4: Run e2e to verify it passes**

Run: `pnpm --filter cli exec vitest run test/recognize-e2e.test.ts`

Expected: PASS

Also run: `pnpm --filter core-app exec vitest run src/Core.test.ts src/pipeline/`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/cli/runCli.ts \
  apps/cli/test/recognize-e2e.test.ts \
  docs/api/index.md
git commit -m "feat(cli): add smm try-to-recognize and apply"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| `tryToRecognizeFolder` + pending plan | 3 |
| Zero matches → `files: []` pending | 3 |
| `getPlan` / `applyPlan` recognize only | 4 |
| listFiles in-memory; no persist `files` | 3–4 (`setMetadata` strips) |
| Reuse `recognizeEpisodes` | 3 |
| CLI try-to-recognize / apply | 5 |
| No UI / core-routes edits | Global |
| Plan path `{appDataDir}/plans/{id}.plan.json` | 2 |
| Empty apply deletes plan | 4 |

## Type consistency

- `Plan` = `RecognizeMediaFilePlan | RenameFilesPlan` in `pipeline/plans.ts`
- `tryToRecognizeFolder` returns `RecognizeMediaFilePlan`
- `RecognizedFile.path` / `MediaFileMetadata.absolutePath` are POSIX
- Error strings: `not managed by SMM`, `Media metadata not found:`, `Folder is not a TV show with episodes:`, `Plan not found:`, `Unsupported plan task:`
