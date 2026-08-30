# create-rename-episode-plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `Core.createRenameEpisodePlan`, make `tryToRenameFolder` use it, replace begin/add/end rename AI/MCP tools with one `create-rename-episode-plan` tool, and update unit/e2e tests.

**Architecture:** Validation + plan write live in `apps/core` (`createRenameEpisodePlanPipeline`). Rule path computes Plex/Emby pairs then calls that API. AI/MCP/Debug/UI tools are thin wrappers that pass AI-chosen `files` with `creator: "ai"`, broadcast `RenameFilesPlanReady`, and return `END_PLAN_TASK_SUCCESS_MESSAGE`. Confirm/apply stays `apply-plan`.

**Tech Stack:** TypeScript, Vitest, Bun, Hono, `@smm/core` plan + validation helpers, WebdriverIO e2e.

**Spec:** `docs/superpowers/specs/2026-08-29-create-rename-episode-plan-design.md`

## Global Constraints

- Plan files only via Core `appDataDir` / `writePlan` (no cli `Bun.write` to plans).
- Preserve former begin/add/end **validation semantics** inside Core (metadata exists, non-empty files for AI, episode video `from`, `validateRenameOperations`).
- `tryToRenameFolder` must still allow **empty** `files` when paths already match (existing Core test); use `options.allowEmptyFiles: true` only for that path.
- AI tool success message: reuse `END_PLAN_TASK_SUCCESS_MESSAGE` verbatim.
- Delete begin/add/end rename task surface completely (no compatibility shim).
- Align HTTP `getPlans` / plan routes `appDataDir` with `getCore()` so Linux XDG split cannot hide plans from UI/apply.
- Do not change recognize begin/add/end tools.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `apps/core/src/pipeline/createRenameEpisodePlan.ts` | Validate + write rename-files plan |
| `apps/core/src/pipeline/createRenameEpisodePlan.test.ts` | Unit tests for validation/write |
| `apps/core/src/pipeline/tryToRenameFolder.ts` | Call createRenameEpisodePlan after building pairs |
| `apps/core/src/Core.ts` | `createRenameEpisodePlan` method |
| `apps/core/src/Core.test.ts` | Integration coverage |
| `apps/core/src/index.ts` | Export pipeline types if needed |
| `packages/core/types/ai-tools/createRenameEpisodePlan.ts` | Tool name/schema (replace renameFilesTask.ts) |
| `packages/core/ai-tool/registry.ts` / `systemPrompt.ts` | Register + prompt text |
| `packages/core-routes/src/tools/createRenameEpisodePlan.ts` | Thin MCP/agent tool builder |
| `packages/core-routes/src/mcp/toolHandlers/createRenameEpisodePlan.ts` | MCP register |
| `packages/core-routes/src/mcp/createServer.ts` | Wire new tool; remove old three |
| `apps/cli/src/route/RenameEpisodesPlan.ts` or new route | `POST /api/create-rename-episode-plan` → Core |
| `apps/cli/src/route/Plans.ts` | Same appDataDir as Core (`getUserDataDir`) |
| `apps/cli/src/route/debug/debugCreateRenameEpisodePlan.ts` | Debug helper for e2e |
| `apps/ui/src/ai/tools/CreateRenameEpisodePlan.tsx` | Single UI AI tool |
| `apps/ui/src/ai/Assistant.tsx` / `tools/index.ts` | Register; remove begin/add/end |
| `apps/e2e/test/lib/debugRenameTool.ts` | One-shot create API |
| `apps/e2e/test/specs/ai/AiTool-RenameTool.e2e.ts` | Use one-shot tool |
| Delete | `renameFilesToolV2.ts`, `renameFilesTaskV2.ts`, old MCP handlers, old UI tools, `packages/core/types/ai-tools/renameFilesTask.ts`, core-routes `renameFilesTask.ts` (rename-specific) |

---

### Task 1: Core `createRenameEpisodePlanPipeline`

**Files:**
- Create: `apps/core/src/pipeline/createRenameEpisodePlan.ts`
- Create: `apps/core/src/pipeline/createRenameEpisodePlan.test.ts`
- Modify: `apps/core/src/index.ts` (export)

**Interfaces:**
- Produces:
```typescript
export interface CreateRenameEpisodePlanOptions {
  creator?: "app" | "ai";
  id?: string;
  /** When true, allow files: [] (rule path when names already match). Default false. */
  allowEmptyFiles?: boolean;
}

export interface CreateRenameEpisodePlanDeps {
  fs: FsPort;
  appDataDir: string;
  normalizePosix: (path: string) => string;
  getMediaMetadata: (folder: string) => Promise<MediaMetadata | null>;
  createId?: () => string;
}

export async function createRenameEpisodePlanPipeline(
  mediaFolderPath: string,
  files: Array<{ from: string; to: string }>,
  options: CreateRenameEpisodePlanOptions | undefined,
  deps: CreateRenameEpisodePlanDeps,
): Promise<RenameFilesPlan>;
```

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, expect, it } from "vitest";
import { createRenameEpisodePlanPipeline } from "./createRenameEpisodePlan";
import { inMemoryFs } from "../test/inMemoryFs"; // use same helper pattern as Core.test.ts
import { metadataCachePath, planFilePath } from "./paths";

describe("createRenameEpisodePlanPipeline", () => {
  const appDataDir = "/data";
  const folder = "/m/Show";

  it("writes pending plan with posix paths", async () => {
    const mm = {
      mediaFolderPath: folder,
      type: "tvshow-folder" as const,
      mediaFiles: [{ absolutePath: "/m/Show/S01E01.mkv", seasonNumber: 1, episodeNumber: 1 }],
    };
    const fs = inMemoryFs({
      [metadataCachePath(appDataDir, folder)]: JSON.stringify(mm),
      "/m/Show/S01E01.mkv": "",
    });
    const plan = await createRenameEpisodePlanPipeline(
      folder,
      [{ from: "/m/Show/S01E01.mkv", to: "/m/Show/[1].mkv" }],
      { creator: "ai", id: "fixed-id" },
      {
        fs,
        appDataDir,
        normalizePosix: (p) => p,
        getMediaMetadata: async () => mm as never,
        createId: () => "fixed-id",
      },
    );
    expect(plan.status).toBe("pending");
    expect(plan.creator).toBe("ai");
    expect(plan.files[0]?.to).toBe("/m/Show/[1].mkv");
    expect(await fs.exists(planFilePath(appDataDir, "fixed-id"))).toBe(true);
  });

  it("rejects empty files when allowEmptyFiles is false", async () => {
    await expect(
      createRenameEpisodePlanPipeline(folder, [], { creator: "ai" }, {
        fs: inMemoryFs({}),
        appDataDir,
        normalizePosix: (p) => p,
        getMediaMetadata: async () => ({ mediaFolderPath: folder, type: "tvshow-folder", mediaFiles: [] }) as never,
      }),
    ).rejects.toThrow(/No rename entries/);
  });

  it("rejects when metadata missing", async () => {
    await expect(
      createRenameEpisodePlanPipeline(
        folder,
        [{ from: "/m/Show/a.mkv", to: "/m/Show/b.mkv" }],
        { creator: "ai" },
        {
          fs: inMemoryFs({}),
          appDataDir,
          normalizePosix: (p) => p,
          getMediaMetadata: async () => null,
        },
      ),
    ).rejects.toThrow(/not opened in SMM|Media metadata not found/);
  });
});
```

Adapt imports to match existing `Core.test.ts` / pipeline test helpers (`inMemoryFs` location).

- [ ] **Step 2: Run tests — expect FAIL**

Run: `pnpm --filter core-app exec vitest run src/pipeline/createRenameEpisodePlan.test.ts`  
(or the package script used for `apps/core` in this repo)

Expected: FAIL (module/function missing)

- [ ] **Step 3: Implement pipeline**

Logic outline:

1. `posixFolder = deps.normalizePosix(mediaFolderPath)`
2. `mm = await deps.getMediaMetadata(posixFolder)`; if null → throw using `assertMediaFolderHasMetadata(false, …)` message style (`folderPath "…" is not opened in SMM`)
3. Normalize `files` to posix; if `files.length === 0` && !`allowEmptyFiles` → throw `No rename entries in task`
4. For each `from`, `assertEpisodeVideoFile(mm, from)` — throw on error string
5. `validateRenameOperations(files, posixFolder, probeFromFs(deps.fs))` — if `!isValid` throw joined errors (skip existence checks when `files.length === 0`)
6. `writePlan` with `{ id, task: "rename-files", status: "pending", creator: options?.creator ?? "app", mediaFolderPath: posixFolder, files }`
7. Return plan

Reuse probe helper pattern from `renameEpisodeFile.ts` (`renameFileExistenceProbe`).

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/pipeline/createRenameEpisodePlan.ts apps/core/src/pipeline/createRenameEpisodePlan.test.ts apps/core/src/index.ts
git commit -m "feat(core): add createRenameEpisodePlanPipeline"
```

---

### Task 2: Wire `Core.createRenameEpisodePlan` + refactor `tryToRenameFolder`

**Files:**
- Modify: `apps/core/src/Core.ts`
- Modify: `apps/core/src/pipeline/tryToRenameFolder.ts`
- Modify: `apps/core/src/Core.test.ts` (add direct createRenameEpisodePlan case; keep existing tryToRenameFolder empty-files test)

**Interfaces:**
- Consumes: `createRenameEpisodePlanPipeline`
- Produces: `Core.createRenameEpisodePlan(mediaFolderPath, files, options?)`

- [ ] **Step 1: Failing Core.test**

```typescript
it("createRenameEpisodePlan persists ai plan", async () => {
  const fs = seedWithVideoFile(); // same seed style as tryToRenameFolder tests + real file blob
  const core = new Core({ fs, network: emptyNetwork(), appDataDir });
  const plan = await core.createRenameEpisodePlan(
    "/m/Show",
    [{ from: "/m/Show/S01E01.mkv", to: "/m/Show/[1].mkv" }],
    { creator: "ai" },
  );
  expect(plan.creator).toBe("ai");
  expect(await fs.exists(planFilePath("/data", plan.id))).toBe(true);
});
```

- [ ] **Step 2: Run — FAIL** (`createRenameEpisodePlan is not a function`)

- [ ] **Step 3: Implement Core method + refactor tryToRenameFolder**

```typescript
// Core.ts
async createRenameEpisodePlan(
  mediaFolderPath: string,
  files: Array<{ from: string; to: string }>,
  options?: CreateRenameEpisodePlanOptions,
): Promise<RenameFilesPlan> {
  return createRenameEpisodePlanPipeline(mediaFolderPath, files, options, {
    fs: this.fs,
    appDataDir: this.appDataDir,
    normalizePosix: (p) => this.normalizePosix(p),
    getMediaMetadata: (folder) => this.getMediaMetadata(folder),
  });
}
```

In `tryToRenameFolderPipeline`, replace local `writePlan` block with:

```typescript
return createRenameEpisodePlanPipeline(posixPath, files, {
  creator: "app",
  allowEmptyFiles: true,
  id: createId(),
}, {
  fs: deps.fs,
  appDataDir: deps.appDataDir,
  normalizePosix: deps.normalizePosix,
  getMediaMetadata: async (folder) => { /* read cache same as today or via injected get */ },
  createId,
});
```

Prefer injecting metadata already loaded to avoid double-read: either pass `getMediaMetadata` that returns cached `mediaMetadata`, or add optional `mediaMetadata` to deps. Keep behavior of existing tryToRenameFolder tests green (including empty files).

- [ ] **Step 4: Run Core tests**

Run: `pnpm --filter core-app test` (or repo’s `pnpm test:core`)

Expected: PASS for tryToRenameFolder + new createRenameEpisodePlan

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(core): expose createRenameEpisodePlan; tryToRenameFolder reuses it"
```

---

### Task 3: Align plan HTTP `appDataDir` with Core

**Files:**
- Modify: `apps/cli/src/route/Plans.ts` — `buildConfig().appDataDir` use `getUserDataDir()` (same as `getCore().appDataDir`)
- Audit: `apps/cli/src/mcp/mcp.ts`, `coreRoutesConfig.ts`, `server.ts` plan-related `getAppDataDir()` usages that list/write plans; switch plan persistence hosts to match Core

**Why:** On Linux, Core writes `~/.config/smm/plans`; `getAppDataDir()` is `~/.local/share/smm`. UI `getPlans` must see AI plans.

- [ ] **Step 1: Add/adjust a small unit or document in existing test** that Plans config uses userDataDir (if no easy test, verify by reading both helpers in a cli test with mocked env `USER_DATA_DIR` / `APP_DATA_DIR` different).

- [ ] **Step 2: Apply code change**

```typescript
import { getUserDataDir } from '@/utils/config'
// ...
appDataDir: getUserDataDir(),
```

- [ ] **Step 3: Commit**

```bash
git commit -m "fix(cli): use Core userDataDir for plan HTTP routes on Linux"
```

---

### Task 4: Tool types + registry + system prompt

**Files:**
- Create: `packages/core/types/ai-tools/createRenameEpisodePlan.ts`
- Delete (after migration): `packages/core/types/ai-tools/renameFilesTask.ts`
- Modify: `packages/core/ai-tool/registry.ts`, `systemPrompt.ts`, `systemPrompt.test.ts`
- Update any imports of old constants

**Interfaces:**
```typescript
export const CREATE_RENAME_EPISODE_PLAN = "create-rename-episode-plan" as const;
export const CREATE_RENAME_EPISODE_PLAN_DESCRIPTION =
  "Create a rename-files plan for TV episode video files with explicit from/to paths. " +
  "After success, tell the user to open SMM, review, and approve the plan.";

export const createRenameEpisodePlanInputSchema = z.object({
  mediaFolderPath: z.string().describe("Absolute media folder path (POSIX or Windows)"),
  files: z.array(z.object({
    from: z.string().describe("Current absolute video path"),
    to: z.string().describe("New absolute video path"),
  })).min(1),
});
```

- [ ] **Step 1: Add types file; update registry to single rename tool (`backend: true, frontend: true`)**
- [ ] **Step 2: Fix systemPrompt checklist to call `create-rename-episode-plan` once with files**
- [ ] **Step 3: Run `packages/core` ai-tool tests**
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(core): replace rename begin/add/end tool types with create-rename-episode-plan"
```

---

### Task 5: HTTP + Debug API thin wrappers

**Files:**
- Modify: `apps/cli/src/route/RenameEpisodesPlan.ts` (or add `createRenameEpisodePlan.ts` route registered from server)
- Create: `apps/cli/src/route/debug/debugCreateRenameEpisodePlan.ts`
- Remove: debug begin/add/end rename routes from `debugRenameFilesTask.ts` (+ registration)
- Delete: `apps/cli/src/tools/renameFilesToolV2.ts`, `renameFilesTaskV2.ts` (and fix imports)

**HTTP**

`POST /api/create-rename-episode-plan`

Body: `{ mediaFolderPath, files, creator?: "ai" | "app" }`  
Response: `{ data?: { plan }, error?: string }` (200 + error field)

```typescript
const plan = await getCore().createRenameEpisodePlan(
  mediaFolderPath,
  files,
  { creator: creator === "app" ? "app" : "ai" },
);
// if AI: broadcast RenameFilesPlanReady like end tool
```

**Debug**

`POST /debug/createRenameEpisodePlan` — same body; return `{ success, data: { planId, plan }, error }` for e2e.

- [ ] **Step 1: Implement routes; remove old debug rename task routes**
- [ ] **Step 2: Smoke with curl or existing cli test harness if any**
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(cli): HTTP/debug create-rename-episode-plan via Core; remove V2 rename tools"
```

---

### Task 6: core-routes MCP tool

**Files:**
- Create: `packages/core-routes/src/tools/createRenameEpisodePlan.ts`
- Create: `packages/core-routes/src/mcp/toolHandlers/createRenameEpisodePlan.ts`
- Modify: `packages/core-routes/src/mcp/createServer.ts`, `packages/core-routes/src/tools/index.ts`
- Delete: `renameFilesTask.ts` builders usage, `beginRenameTask.ts`, `addRenameFile.ts`, `endRenameTask.ts`
- Update: `packages/core-routes/src/mcp/toolHandlers/staticText.ts`, `test/mcp/how-to-rename-*.ts`

Tool execute: call host-provided `createRenameEpisodePlan` callback **or** import `createRenameEpisodePlanPipeline` from `core-app` with `config.appDataDir` + fs adapter — prefer pipeline import so MCP does not depend on cli `getCore` singleton.

Must pass `appDataDir` identical to Core’s plan dir (host config). Broadcast `RenameFilesPlanReady`; return `toolOk({ message: END_PLAN_TASK_SUCCESS_MESSAGE, planId })`.

- [ ] **Step 1: Unit test tool success/validation error with mock fs**
- [ ] **Step 2: Implement + remove old handlers**
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(core-routes): single create-rename-episode-plan MCP tool"
```

---

### Task 7: UI AI tool

**Files:**
- Create: `apps/ui/src/ai/tools/CreateRenameEpisodePlan.tsx`
- Create: `apps/ui/src/api/createRenameEpisodePlan.ts` (apiFetch POST)
- Modify: `apps/ui/src/ai/tools/index.ts`, `Assistant.tsx`, `Assistant.registry.test.ts`
- Delete: `BeginRenameFilesTask.tsx`, `AddRenameFileToTask.tsx`, `EndRenameFilesTask.tsx` (move `cleanupRenamePlan` to a small helper if still referenced by `useAiBasedRenameFilesFlow`)
- Update: `useAiBasedRenameFilesFlow` imports of `cleanupRenamePlan`

UI tool:

```typescript
const resp = await createRenameEpisodePlanApi({
  mediaFolderPath,
  files,
  creator: "ai",
});
if (resp.error) return { error: resp.error };
await queryClient.invalidateQueries({ queryKey: [PLANS_QUERY_ROOT] });
return toolOk({ message: END_PLAN_TASK_SUCCESS_MESSAGE, taskId: resp.data.plan.id });
```

- [ ] **Step 1: Registry test expects `CreateRenameEpisodePlanTool` only**
- [ ] **Step 2: Implement; remove old tools**
- [ ] **Step 3: `pnpm --filter ui test` relevant files**
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(ui): single CreateRenameEpisodePlan AI tool"
```

---

### Task 8: E2E `AiTool-RenameTool` + debug helper

**Files:**
- Modify: `apps/e2e/test/lib/debugRenameTool.ts` → `createRenameEpisodePlan({ mediaFolderPath, files })`
- Modify: `apps/e2e/test/specs/ai/AiTool-RenameTool.e2e.ts`

Replace create/add/end with:

```typescript
await createRenameEpisodePlan({
  mediaFolderPath: folder.path!,
  files: [{
    from: path.join(folder.path!, "S01E01.mp4"),
    to: path.join(folder.path!, "[1].mp4"),
  }],
});
await Prompts.aiBasedRenamePrompt.waitForDisplayed();
await Prompts.confirmButton.click();
// same waitUntil / expectMediaMetadataToBe
```

- [ ] **Step 1: Update helper + spec**
- [ ] **Step 2: Run desktop e2e**

Run: `bun ci/run-e2e-test.ts --spec ./test/specs/ai/AiTool-RenameTool.e2e.ts`  
Expected: PASS (on Windows local)

- [ ] **Step 3: Commit**

```bash
git commit -m "test(e2e): AiTool-RenameTool uses create-rename-episode-plan"
```

---

### Task 9: Docs polish

**Files:**
- Update: `docs/dev/rename-episodes.md` Testing table row for AI if needed
- Update: `docs/DebugAPI.md` rename sections
- Remove stale begin/add/end from `docs/AI-driven-recognition.md` / `docs/superpowers/reference/AI_RenameFile_Process.md` (short note pointing to new tool)

- [ ] **Step 1: Edit docs**
- [ ] **Step 2: Commit**

```bash
git commit -m "docs: document create-rename-episode-plan; remove begin/add/end rename docs"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| `Core.createRenameEpisodePlan` + validations | 1–2 |
| `tryToRenameFolder` → create API | 2 |
| Single AI/MCP tool + success message + broadcast | 5–7 |
| Delete begin/add/end | 4–7 |
| Linux plan dir / apply visibility | 3 |
| E2E refactor | 8 |
| Docs | 9 |

## Placeholder / consistency notes

- Tool constant name: `create-rename-episode-plan` / `CREATE_RENAME_EPISODE_PLAN`
- Empty files: only via `allowEmptyFiles: true` from `tryToRenameFolder`
- `cleanupRenamePlan` must survive End tool deletion if cancel flow still needs it
