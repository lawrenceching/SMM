# Core.tryToRenameFolder / applyPlan (rename-files) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `Core.tryToRenameFolder(path, rule?)` and extend `Core.applyPlan` for `rename-files` (disk rename + metadata path rewrite), plus CLI `smm try-to-rename` and update `smm apply`, without changing UI or core-routes.

**Architecture:** Port plex/emby naming and plan builders into `apps/core` pipelines. Persist pending `RenameFilesPlan` via existing plan helpers. On apply, expand associated files, `FsPort.mkdir` parents, `FsPort.rename` each pair, rewrite `mediaFiles` paths, delete plan.

**Tech Stack:** TypeScript, Vitest, `apps/core` FsPort adapters, Commander CLI, `@smm/core` plan types + `videoFileExtensions` / `subtitleFileExtensions` / `getFullExtensionForAssociatedFile`.

**Spec:** `docs/superpowers/specs/2026-08-19-core-try-to-rename-folder-design.md`

## Global Constraints

- Do **not** modify `apps/ui/**` or `packages/core-routes/**` source.
- Scope is **Core + CLI only** (no HTTP / v3 / UI wiring).
- TV show only; not movie rename; not `Core.renameFolder` (directory rename).
- Default naming rule: **`plex`** when `rule` is omitted.
- Zero rename candidates → pending plan with `files: []` (do **not** throw solely for empty plans).
- Extend existing `applyPlan` for `rename-files`; keep recognize-media-file behavior unchanged.
- Register `try-to-rename` in `apps/cli/index.ts` `cliCommands` (same pitfall as recognize).
- Core methods throw `Error` (CLI prints message, exit 1).

---

## File Structure

| File | Responsibility |
|------|----------------|
| `apps/core/src/pipeline/renameRules.ts` | plex/emby `generateNewFileName` (TV; movie helper optional unused) |
| `apps/core/src/pipeline/renameRules.test.ts` | Naming rule unit tests |
| `apps/core/src/pipeline/mediaFilePathEqual.ts` | POSIX path equality |
| `apps/core/src/pipeline/buildTvShowRenamePlanFileEntries.ts` | Video from→to plan entries |
| `apps/core/src/pipeline/buildTvShowRenamePlanFileEntries.test.ts` | Builder tests |
| `apps/core/src/pipeline/findAssociatedFiles.ts` | Same-stem associates from listFiles |
| `apps/core/src/pipeline/buildTvShowRenameListForPlan.ts` | Expand plan + associates |
| `apps/core/src/pipeline/buildTvShowRenameListForPlan.test.ts` | Expand tests |
| `apps/core/src/ports/FsPort.ts` | Add `mkdir(path)` |
| `apps/core/src/adapters/node/NodejsFsAdapter.ts` | Implement mkdir |
| `apps/core/src/adapters/network/NetworkFsAdapter.ts` | mkdir NYI or HTTP if exists |
| `apps/core/src/pipeline/tryToRenameFolder.ts` | Orchestration |
| `apps/core/src/pipeline/applyRenameFilesPlan.ts` | Apply rename-files |
| `apps/core/src/pipeline/applyPlan.ts` | Dispatch recognize vs rename |
| `apps/core/src/Core.ts` | `tryToRenameFolder` + applyPlan wiring |
| `apps/core/src/Core.test.ts` | Core integration tests |
| `apps/cli/src/cli/runCli.ts` | `try-to-rename`; fix `apply` summary for rename |
| `apps/cli/index.ts` | Register `try-to-rename` |
| `apps/cli/test/rename-files-e2e.test.ts` | CLI e2e (distinct from folder `rename-e2e`) |
| `docs/api/index.md` | Short CLI note |

---

### Task 1: Pure renameRules (TV plex/emby)

**Files:**
- Create: `apps/core/src/pipeline/renameRules.ts`
- Create: `apps/core/src/pipeline/renameRules.test.ts`

**Interfaces:**
- Produces:
  - `export type RenameRuleName = "plex" | "emby"`
  - `export interface NewFileNameContext { type: "tv" | "movie"; seasonNumber: number; episodeNumber: number; episodeName?: string; tvshowName?: string; movieName?: string; file: string; tmdbId?: string; releaseYear: string }`
  - `generateNewFileName(ruleName: RenameRuleName, context: NewFileNameContext): string` — returns **relative** path with extension from `context.file`

Port TV formulas from `apps/ui/src/lib/renameRules.ts` verbatim:

- plex: `Season ${SS}/${tvshowName} - S${SS}E${EE} - ${episodeName}${ext}` (SS/EE pad 2)
- emby: `Season ${S}/${tvshowName} S${S}E${E} ${episodeName}${ext}` (no pad)

Use `extname` from `./paths` (already in core).

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { generateNewFileName } from "./renameRules";

describe("generateNewFileName", () => {
  const base = {
    type: "tv" as const,
    seasonNumber: 1,
    episodeNumber: 2,
    episodeName: "Pilot",
    tvshowName: "Show",
    file: "/m/Show/S01E02.mkv",
    releaseYear: "2019",
  };

  it("builds plex relative path", () => {
    expect(generateNewFileName("plex", base)).toBe(
      "Season 01/Show - S01E02 - Pilot.mkv",
    );
  });

  it("builds emby relative path", () => {
    expect(generateNewFileName("emby", base)).toBe(
      "Season 1/Show S1E2 Pilot.mkv",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter core-app exec vitest run src/pipeline/renameRules.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Minimal implementation**

Create `renameRules.ts` by porting UI `generatePlexTvFileName` / `generateEmbyTvFileName` / `generateNewFileName` (include movie branch for parity with UI helper even if unused this milestone — keeps copy faithful; or omit movie and only handle `type === "tv"` — **prefer TV-only** and throw/ignore movie to stay YAGNI: if `context.type !== "tv"` throw `new Error("Only TV rename is supported")`).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter core-app exec vitest run src/pipeline/renameRules.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/pipeline/renameRules.ts apps/core/src/pipeline/renameRules.test.ts
git commit -m "feat(core): add plex/emby TV renameRules"
```

---

### Task 2: buildTvShowRenamePlanFileEntries

**Files:**
- Create: `apps/core/src/pipeline/mediaFilePathEqual.ts`
- Create: `apps/core/src/pipeline/buildTvShowRenamePlanFileEntries.ts`
- Create: `apps/core/src/pipeline/buildTvShowRenamePlanFileEntries.test.ts`

**Interfaces:**
- Consumes: `generateNewFileName`, `RenameRuleName`
- Produces:
  - `mediaFilePathEqual(a, b): boolean` — `Path.posix` compare (same as UI)
  - `buildTvShowRenamePlanFileEntries(mm, rule): Array<{ from: string; to: string }>`
  - Join: `joinPosix(mediaFolderPath, relativePath)` from `./paths`
  - Skip when `mediaFilePathEqual(from, to)`; skip episodes without `mediaFiles` entry

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import type { MediaMetadata } from "@smm/core";
import { buildTvShowRenamePlanFileEntries } from "./buildTvShowRenamePlanFileEntries";

function mm(partial: Partial<MediaMetadata> & Pick<MediaMetadata, "mediaFolderPath">): MediaMetadata {
  return {
    type: "tvshow-folder",
    mediaFiles: [],
    tvShow: {
      id: "1",
      name: "Show",
      seasons: [
        {
          season: 1,
          episodes: [{ season: 1, episode: 1, name: "Ep1" }],
        },
      ],
    },
    ...partial,
  } as MediaMetadata;
}

describe("buildTvShowRenamePlanFileEntries", () => {
  it("emits from→to for plex when current name differs", () => {
    const meta = mm({
      mediaFolderPath: "/m/Show",
      mediaFiles: [{ absolutePath: "/m/Show/S01E01.mkv", seasonNumber: 1, episodeNumber: 1 }],
    });
    const files = buildTvShowRenamePlanFileEntries(meta, "plex");
    expect(files).toEqual([
      {
        from: "/m/Show/S01E01.mkv",
        to: "/m/Show/Season 01/Show - S01E01 - Ep1.mkv",
      },
    ]);
  });

  it("omits already-matching paths", () => {
    const to = "/m/Show/Season 01/Show - S01E01 - Ep1.mkv";
    const meta = mm({
      mediaFolderPath: "/m/Show",
      mediaFiles: [{ absolutePath: to, seasonNumber: 1, episodeNumber: 1 }],
    });
    expect(buildTvShowRenamePlanFileEntries(meta, "plex")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter core-app exec vitest run src/pipeline/buildTvShowRenamePlanFileEntries.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`mediaFilePathEqual.ts` — copy UI logic with `@core/path`.

`buildTvShowRenamePlanFileEntries.ts` — port UI loop; `to = joinPosix(Path.posix(mediaFolderPath), relative)` with Path.posix on `from`/`to`.

- [ ] **Step 4: Run test to verify it passes**

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/pipeline/mediaFilePathEqual.ts \
  apps/core/src/pipeline/buildTvShowRenamePlanFileEntries.ts \
  apps/core/src/pipeline/buildTvShowRenamePlanFileEntries.test.ts
git commit -m "feat(core): build TV rename plan file entries"
```

---

### Task 3: findAssociatedFiles + buildTvShowRenameListForPlan

**Files:**
- Create: `apps/core/src/pipeline/findAssociatedFiles.ts`
- Create: `apps/core/src/pipeline/buildTvShowRenameListForPlan.ts`
- Create: `apps/core/src/pipeline/buildTvShowRenameListForPlan.test.ts`

**Interfaces:**
- Produces:
  - `findAssociatedFiles(mediaFolderPath, filePaths, videoFilePath): string[]` — return **absolute** POSIX paths of associates (simpler than UI `File[]`; Core apply only needs paths)
  - `buildTvShowRenameListForPlan({ mediaFolderPath, localFiles, plan }): Array<{ from: string; to: string }>` — plan.files first, then associates with stem-matched extensions via `getFullExtensionForAssociatedFile` from `@smm/core` / `@core/utils` (check which export path core-app already uses)

Associate matching: same stem rules as UI `findAssociatedFiles` (exact stem+ext and language-tagged `stem.*.ext`) using `extensions.imageFileExtensions`, `subtitleFileExtensions`, `audioTrackFileExtensions`, and `.nfo` from `@core/utils` or `@smm/core`.

Subtitle multi-dot: use `getFullExtensionForAssociatedFile` when building `to` (UI used `ext(filename, 2)` for subtitle case — prefer shared `getFullExtensionForAssociatedFile` for correctness).

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import type { RenameFilesPlan } from "@smm/core/types/RenameFilesPlan";
import { buildTvShowRenameListForPlan } from "./buildTvShowRenameListForPlan";

describe("buildTvShowRenameListForPlan", () => {
  it("includes video and same-stem subtitle", () => {
    const plan: RenameFilesPlan = {
      id: "p1",
      task: "rename-files",
      status: "pending",
      creator: "app",
      mediaFolderPath: "/m/Show",
      files: [
        {
          from: "/m/Show/S01E01.mkv",
          to: "/m/Show/Season 01/Show - S01E01 - Ep1.mkv",
        },
      ],
    };
    const localFiles = [
      "/m/Show/S01E01.mkv",
      "/m/Show/S01E01.sc.ass",
      "/m/Show/other.mkv",
    ];
    const list = buildTvShowRenameListForPlan({
      mediaFolderPath: "/m/Show",
      localFiles,
      plan,
    });
    expect(list[0]).toEqual(plan.files[0]);
    expect(list).toContainEqual({
      from: "/m/Show/S01E01.sc.ass",
      to: "/m/Show/Season 01/Show - S01E01 - Ep1.sc.ass",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — module not found.

- [ ] **Step 3: Implement** `findAssociatedFiles` + `buildTvShowRenameListForPlan`

Normalize all paths with `Path.posix` at boundaries.

- [ ] **Step 4: Run test to verify it passes**

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/pipeline/findAssociatedFiles.ts \
  apps/core/src/pipeline/buildTvShowRenameListForPlan.ts \
  apps/core/src/pipeline/buildTvShowRenameListForPlan.test.ts
git commit -m "feat(core): expand rename plan with associated files"
```

---

### Task 4: FsPort.mkdir

**Files:**
- Modify: `apps/core/src/ports/FsPort.ts`
- Modify: `apps/core/src/adapters/node/NodejsFsAdapter.ts`
- Modify: `apps/core/src/adapters/node/NodejsFsAdapter.test.ts`
- Modify: `apps/core/src/adapters/network/NetworkFsAdapter.ts` — throw `Not Implemented: NetworkFsAdapter.mkdir` unless an existing mkdir HTTP API is already used elsewhere (prefer NYI this round)
- Modify: in-memory `FsPort` fakes in `Core.test.ts` / pipeline tests — add `mkdir: vi.fn(async () => {})` (no-op or track created dirs)

**Interfaces:**
- Produces: `FsPort.mkdir(path: string): Promise<void>` — create directory (and parents). Idempotent if exists.

- [ ] **Step 1: Write failing adapter test**

```typescript
  it("creates nested directories", async () => {
    const adapter = new NodejsFsAdapter();
    const dir = joinPosix(tmpPosix, "Season 01");
    await adapter.mkdir(dir);
    expect(await adapter.exists(dir)).toBe(true);
  });
```

(Use existing tmp helpers in `NodejsFsAdapter.test.ts`.)

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — `mkdir is not a function`.

- [ ] **Step 3: Implement**

```typescript
// FsPort
/** Create a directory (and parents). Idempotent if it already exists. Paths are POSIX. */
mkdir(path: string): Promise<void>;

// NodejsFsAdapter
async mkdir(path: string): Promise<void> {
  await fsp.mkdir(Path.toPlatformPath(path), { recursive: true });
}
```

Stub Network + update test fakes so the package typechecks.

- [ ] **Step 4: Run adapter test — PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/ports/FsPort.ts \
  apps/core/src/adapters/node/NodejsFsAdapter.ts \
  apps/core/src/adapters/node/NodejsFsAdapter.test.ts \
  apps/core/src/adapters/network/NetworkFsAdapter.ts \
  apps/core/src/Core.test.ts
git commit -m "feat(core): add FsPort.mkdir for rename parents"
```

---

### Task 5: tryToRenameFolder + Core method

**Files:**
- Create: `apps/core/src/pipeline/tryToRenameFolder.ts`
- Modify: `apps/core/src/Core.ts`
- Modify: `apps/core/src/Core.test.ts`
- Modify: `apps/core/src/index.ts` — export `RenameRuleName` if useful

**Interfaces:**
- Consumes: `buildTvShowRenamePlanFileEntries`, `writePlan`, `UserConfig`, managed check (duplicate `isManaged` from `tryToRecognizeFolder` / `renameFolder`)
- Produces:
  - `tryToRenameFolderPipeline(path, rule | undefined, deps): Promise<RenameFilesPlan>`
  - `Core.tryToRenameFolder(path: string, rule?: RenameRuleName): Promise<RenameFilesPlan>`

**Behavior:**

1. Managed check → `{posix} is not managed by SMM`
2. Metadata miss → `Media metadata not found: {path}`
3. Not TV with episodes → `Folder is not a TV show with episodes: {path}` (reuse same helper spirit as tryToRecognizeFolder)
4. If `rule` provided and not `plex`|`emby` → `Unsupported rename rule: {rule}`
5. `effectiveRule = rule ?? "plex"`
6. Build entries; create pending plan `creator: "app"`, `task: "rename-files"`, `files` may be `[]`
7. `writePlan`; return

- [ ] **Step 1: Write failing Core tests**

Seed managed folder + metadata with `mediaFiles` pointing at `/m/Show/S01E01.mkv` and episode name; assert plan.files to plex target; assert empty when already matching; assert unmanaged throws.

- [ ] **Step 2: Run — FAIL** (`tryToRenameFolder is not a function`)

- [ ] **Step 3: Implement pipeline + Core wrapper**

- [ ] **Step 4: Run Core tests focused — PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(core): add Core.tryToRenameFolder"
```

---

### Task 6: applyPlan rename-files branch

**Files:**
- Create: `apps/core/src/pipeline/applyRenameFilesPlan.ts`
- Modify: `apps/core/src/pipeline/applyPlan.ts` — dispatch by `plan.task`
- Modify: `apps/core/src/Core.ts` — pass `mkdir` / listFiles through deps
- Modify: `apps/core/src/Core.test.ts`

**Interfaces:**
- Produces: `applyRenameFilesPlanPipeline(plan, deps): Promise<void>`
- Deps: `{ fs, appDataDir, normalizePosix, getMediaMetadata, setMetadata }`
- `applyPlan.ts` becomes:

```typescript
export async function applyPlanPipeline(plan: Plan, deps: ApplyPlanDeps): Promise<void> {
  if (plan.task === "recognize-media-file") {
    return applyRecognizeMediaFilePlanPipeline(plan, deps);
  }
  if (plan.task === "rename-files") {
    return applyRenameFilesPlanPipeline(plan, deps);
  }
  throw new Error(`Unsupported plan task: ${plan.task}`);
}
```

Rename existing export name if needed so Core calls one dispatcher (update imports).

**applyRenameFilesPlan behavior:**

1. Assert `task === "rename-files"`
2. Load metadata; throw if missing
3. `localFiles = (await fs.listFiles(folder)).map(Path.posix)`
4. `renameList = buildTvShowRenameListForPlan(...)`
5. For each `{ from, to }`: `dirname` of `to` → `fs.mkdir(parent)`; then `fs.rename(from, to)`
6. Rewrite `mediaFiles`: for each entry, if `absolutePath` equals any rename `from` (posix), set to corresponding `to` (only video roots that appear in `plan.files`, or any pair in renameList — **prefer**: map all renameList pairs onto mediaFiles paths so video updates; associates are not in mediaFiles)
7. `setMetadata`; `deletePlan`
8. Empty files: skip steps 5–6 disk/mediaFiles mutation; still `deletePlan`

- [ ] **Step 1: Write failing tests**

Happy path: inMemoryFs with `/m/Show/S01E01.mkv` + `/m/Show/S01E01.ass`, pending plan, apply → files at Season path, mediaFiles updated, plan gone.

Empty plan: delete plan, mediaFiles unchanged.

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

- [ ] **Step 4: Full `Core.test.ts` PASS** (recognize + rename)

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(core): applyPlan supports rename-files"
```

---

### Task 7: CLI try-to-rename + apply summary + e2e

**Files:**
- Modify: `apps/cli/src/cli/runCli.ts`
- Modify: `apps/cli/index.ts` — add `'try-to-rename'` to `cliCommands`
- Create: `apps/cli/test/rename-files-e2e.test.ts`
- Modify: `docs/api/index.md`

**CLI:**

```typescript
program
  .command('try-to-rename')
  .description('Build a pending rename-files plan (plex/emby)')
  .argument('<folder>', 'Imported media folder path')
  .option('--rule <rule>', 'Naming rule: plex | emby', 'plex')
  .action(async (folder: string, opts: { rule: string }) => {
    // validate rule; call tryToRenameFolder(folder, opts.rule as ...)
    // print plan id, task, status, folder, files as "  from → to" or (none)
  })
```

Update `apply` description and count:

```typescript
const count =
  plan.task === 'recognize-media-file' || plan.task === 'rename-files'
    ? plan.files.length
    : 0
console.log(`applied ${plan.id} (${count} file(s))`)
```

**E2e** (mirror recognize-e2e setup):

1. `createAndImportInitializedFolder` with `mediaFiles: []`
2. `smm try-to-recognize` + `smm apply`
3. `smm try-to-rename --rule plex`
4. Assert plan stdout contains `Season 01`
5. `smm apply <id>`
6. Assert `existsSync` for renamed video under `Season 01/`; old `S01E01.mkv` gone
7. Assert `getMediaMetadata` absolutePath updated

Also: empty candidates case optional; unmanaged reject optional.

- [ ] **Step 1: Write failing e2e**

- [ ] **Step 2: Run — FAIL** (unknown command or apply fails)

- [ ] **Step 3: Implement CLI + index registration + docs**

- [ ] **Step 4: E2e + core-app tests PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(cli): add smm try-to-rename and apply rename-files"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| `tryToRenameFolder` + pending plan | 5 |
| Default rule plex | 5, 7 |
| Empty `files: []` pending | 5 |
| applyPlan rename-files + associates | 3, 6 |
| mkdir Season parents | 4, 6 |
| CLI try-to-rename / apply | 7 |
| index.ts cliCommands | 7 |
| No UI / core-routes | Global |
| TV only | 1–2, 5 |

## Type consistency

- `RenameRuleName = "plex" | "emby"`
- `RenameFilesPlan.files: { from, to }[]` (POSIX)
- Error strings match design table
- `applyPlan` supports both recognize and rename tasks after Task 6
