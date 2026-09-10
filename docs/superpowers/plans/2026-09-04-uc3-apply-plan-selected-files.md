# UC3 Apply Plan With Selected Episodes Implementation Plan

**Status**: Implemented (2026-09-04, commits caa77348..9db702eb)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `POST /api/apply-plan` accepts `data: { files }` to apply only selected episodes of a rename plan; Core rejects the original plan, creates a subset plan, and applies it; selection errors return RFC 9457 ProblemDetails (400).

**Architecture:** New core pipeline `applySelectedRenameFilesPlanPipeline` (validate membership → reject → create subset plan → apply). `applyPlanPipeline`/`Core.applyPlan` gain an optional `data?: { files?: string[] }` argument. The CLI route reads `data` from the body and maps `SelectedFilesNotInPlanError` + shape errors to `400 application/problem+json`.

**Tech Stack:** TypeScript, Vitest (core + cli), Hono, `@smm/types` (`ProblemDetails`, `RenameFilesPlan`).

**Spec:** `docs/superpowers/specs/2026-09-04-uc3-apply-plan-selected-files-design.md`

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `apps/core/src/pipeline/applySelectedRenameFilesPlan.ts` | `SelectedFilesNotInPlanError` + selected-apply pipeline (reject → create subset → apply) |
| Create | `apps/core/src/pipeline/applySelectedRenameFilesPlan.test.ts` | Pipeline + dispatch tests (in-memory `FsPort`) |
| Modify | `apps/core/src/pipeline/applyPlan.ts` | `ApplyPlanData` type; `applyPlanPipeline(plan, deps, data?)` dispatch |
| Modify | `apps/core/src/Core.ts` (~line 561) | `applyPlan(plan, data?)` passes data through |
| Modify | `apps/cli/src/route/RenameEpisodesPlan.ts` | `POST /api/apply-plan` reads `data`, returns ProblemDetails 400 for selection errors |
| Modify | `apps/cli/src/route/RenameEpisodesPlan.test.ts` | apply-plan route tests |

Established facts (verified in repo):
- `ApplyPlanDeps` = `{ fs, appDataDir, normalizePosix, getMediaMetadata, setMetadata }` (`apps/core/src/pipeline/applyPlan.ts:7`) — structurally satisfies `CreateRenameEpisodePlanDeps` (its `createId?` is optional and omitted → `randomUUID`).
- `rejectPlan(fs, appDataDir, id)` marks `rejected` and keeps the file (`apps/core/src/pipeline/plans.ts:89`).
- `planFilePath(appDataDir, id)` = `<appDataDir>/plans/<id>.plan.json` (`apps/core/src/pipeline/paths.ts:34`).
- `mediaFilePathEqual(a, b)` compares via `Path.posix` with fallback (`apps/core/src/pipeline/mediaFilePathEqual.ts`).
- `createRenameEpisodePlanPipeline(folder, files, options, deps)` validates metadata/episodes/rename-ops and writes a `pending` plan (`apps/core/src/pipeline/createRenameEpisodePlan.ts:36`).
- `applyRenameFilesPlanPipeline` renames entries + associated files, rewrites metadata, deletes the plan file (`apps/core/src/pipeline/applyRenameFilesPlan.ts:14`).
- Core exports subpaths: `"./pipeline/*": "./src/pipeline/*"`; CLI already imports `@smm/core/ai-tool/toolResult` the same way.
- `ProblemDetails` is exported from `@smm/types` root (`packages/types/types.ts:884`).
- Existing circular-import pattern is fine: value import one direction, type-only the other (`applyRenameFilesPlan.ts` ↔ `applyPlan.ts`).

---

### Task 1: Core — selected-files apply pipeline

**Files:**
- Create: `apps/core/src/pipeline/applySelectedRenameFilesPlan.test.ts`
- Create: `apps/core/src/pipeline/applySelectedRenameFilesPlan.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/core/src/pipeline/applySelectedRenameFilesPlan.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import type { MediaMetadata } from "@smm/types";
import type { RenameFilesPlan } from "@smm/types/RenameFilesPlan";
import type { FsPort } from "../ports/FsPort";
import { planFilePath } from "./paths";
import {
  applySelectedRenameFilesPlanPipeline,
  SelectedFilesNotInPlanError,
} from "./applySelectedRenameFilesPlan";

const appDataDir = "/data";
const folder = "/m/Show";

function inMemoryFs(seed: Record<string, string> = {}): FsPort & { raw: Map<string, string> } {
  const files = new Map(Object.entries(seed));
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
    writeBinaryFile: vi.fn(async () => {}),
    exists: vi.fn(async (path: string) => files.has(path)),
    listFiles: vi.fn(async (dir: string) => {
      const prefix = dir.endsWith("/") ? dir : `${dir}/`;
      return [...files.keys()].filter((p) => p.startsWith(prefix));
    }),
    deleteFile: vi.fn(async (path: string) => {
      files.delete(path);
    }),
    rename: vi.fn(async (from: string, to: string) => {
      const v = files.get(from);
      if (v === undefined) throw new Error("ENOENT: " + from);
      files.delete(from);
      files.set(to, v);
    }),
    mkdir: vi.fn(async () => {}),
    listSubdirectories: vi.fn(async () => []),
  };
}

function basePlan(): RenameFilesPlan {
  return {
    id: "plan-1",
    task: "rename-files",
    status: "pending",
    creator: "app",
    mediaFolderPath: folder,
    files: [
      { from: `${folder}/old1.mkv`, to: `${folder}/S01E01.mkv` },
      { from: `${folder}/old2.mkv`, to: `${folder}/S01E02.mkv` },
    ],
  };
}

function baseMetadata(): MediaMetadata {
  return {
    mediaFolderPath: folder,
    type: "tvshow-folder",
    mediaFiles: [
      { absolutePath: `${folder}/old1.mkv`, seasonNumber: 1, episodeNumber: 1 },
      { absolutePath: `${folder}/old2.mkv`, seasonNumber: 1, episodeNumber: 2 },
    ],
  } as never;
}

function baseDeps(fs: ReturnType<typeof inMemoryFs>) {
  return {
    fs,
    appDataDir,
    normalizePosix: (p: string) => p,
    getMediaMetadata: async () => baseMetadata(),
    setMetadata: vi.fn(async (_mm: MediaMetadata) => {}),
  };
}

function seedFs(plan: RenameFilesPlan) {
  return inMemoryFs({
    [planFilePath(appDataDir, plan.id)]: JSON.stringify(plan),
    [`${folder}/old1.mkv`]: "v1",
    [`${folder}/old1.srt`]: "srt",
    [`${folder}/old2.mkv`]: "v2",
  });
}

describe("applySelectedRenameFilesPlanPipeline", () => {
  it("applies only the selected entries and leaves the original rejected", async () => {
    const plan = basePlan();
    const fs = seedFs(plan);
    const deps = baseDeps(fs);

    await applySelectedRenameFilesPlanPipeline(plan, [`${folder}/old1.mkv`], deps);

    expect(fs.raw.has(`${folder}/S01E01.mkv`)).toBe(true);
    expect(fs.raw.has(`${folder}/old1.mkv`)).toBe(false);
    expect(fs.raw.has(`${folder}/S01E01.srt`)).toBe(true);
    expect(fs.raw.has(`${folder}/old1.srt`)).toBe(false);
    expect(fs.raw.has(`${folder}/old2.mkv`)).toBe(true);
    expect(fs.raw.has(`${folder}/S01E02.mkv`)).toBe(false);

    const planFiles = [...fs.raw.keys()].filter((p) => p.endsWith(".plan.json"));
    expect(planFiles).toEqual([planFilePath(appDataDir, "plan-1")]);
    const rejected = JSON.parse(fs.raw.get(planFilePath(appDataDir, "plan-1"))!);
    expect(rejected.status).toBe("rejected");

    expect(deps.setMetadata).toHaveBeenCalledTimes(1);
    const mm = deps.setMetadata.mock.calls[0][0] as MediaMetadata;
    expect(mm.mediaFiles?.map((f) => f.absolutePath)).toEqual([
      `${folder}/S01E01.mkv`,
      `${folder}/old2.mkv`,
    ]);
  });

  it("throws SelectedFilesNotInPlanError and changes nothing for unknown files", async () => {
    const plan = basePlan();
    const fs = seedFs(plan);
    const deps = baseDeps(fs);
    const before = new Map(fs.raw);

    const error = await applySelectedRenameFilesPlanPipeline(plan, [`${folder}/nope.mkv`], deps).then(
      () => null,
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(SelectedFilesNotInPlanError);
    expect((error as SelectedFilesNotInPlanError).files).toEqual([`${folder}/nope.mkv`]);
    expect(fs.raw).toEqual(before);
    expect(deps.setMetadata).not.toHaveBeenCalled();
  });

  it("throws for an empty selection", async () => {
    const plan = basePlan();
    const fs = seedFs(plan);
    const deps = baseDeps(fs);

    await expect(
      applySelectedRenameFilesPlanPipeline(plan, [], deps),
    ).rejects.toThrow(/non-empty/);
  });

  it("matches selected files written with windows separators", async () => {
    const plan = basePlan();
    const fs = seedFs(plan);
    const deps = baseDeps(fs);
    const winPath = `${folder}/old1.mkv`.replaceAll("/", "\\");

    await expect(
      applySelectedRenameFilesPlanPipeline(plan, [winPath], deps),
    ).resolves.toBeUndefined();

    expect(fs.raw.has(`${folder}/S01E01.mkv`)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @smm/core exec vitest run src/pipeline/applySelectedRenameFilesPlan.test.ts`
Expected: FAIL — cannot resolve `./applySelectedRenameFilesPlan`

- [ ] **Step 3: Write the implementation**

Create `apps/core/src/pipeline/applySelectedRenameFilesPlan.ts`:

```ts
import type { RenameFilesPlan } from "@smm/types/RenameFilesPlan";
import type { ApplyPlanDeps } from "./applyPlan";
import { applyRenameFilesPlanPipeline } from "./applyRenameFilesPlan";
import { createRenameEpisodePlanPipeline } from "./createRenameEpisodePlan";
import { mediaFilePathEqual } from "./mediaFilePathEqual";
import { rejectPlan } from "./plans";

export class SelectedFilesNotInPlanError extends Error {
  readonly files: string[];

  constructor(files: string[]) {
    super(`Files not in plan: ${files.join(", ")}`);
    this.name = "SelectedFilesNotInPlanError";
    this.files = files;
  }
}

/**
 * UC3: apply only the selected "from" files of a pending rename plan.
 * Rejects the original plan (kept on disk), creates a subset plan, applies it.
 */
export async function applySelectedRenameFilesPlanPipeline(
  plan: RenameFilesPlan,
  selectedFiles: string[],
  deps: ApplyPlanDeps,
): Promise<void> {
  if (plan.task !== "rename-files") {
    throw new Error(`Unsupported plan task: ${plan.task}`);
  }
  if (selectedFiles.length === 0) {
    throw new Error("data.files must be a non-empty array");
  }

  const offenders = selectedFiles.filter(
    (file) => !plan.files.some((entry) => mediaFilePathEqual(entry.from, file)),
  );
  if (offenders.length > 0) {
    throw new SelectedFilesNotInPlanError(offenders);
  }

  const filtered = plan.files.filter((entry) =>
    selectedFiles.some((file) => mediaFilePathEqual(entry.from, file)),
  );

  await rejectPlan(deps.fs, deps.appDataDir, plan.id);
  const newPlan = await createRenameEpisodePlanPipeline(
    plan.mediaFolderPath,
    filtered,
    { creator: plan.creator },
    deps,
  );
  await applyRenameFilesPlanPipeline(newPlan, deps);
}
```

Note: passing `deps` (an `ApplyPlanDeps`) where `CreateRenameEpisodePlanDeps` is expected is fine — it has every required property (`createId` omitted → `randomUUID`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @smm/core exec vitest run src/pipeline/applySelectedRenameFilesPlan.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/pipeline/applySelectedRenameFilesPlan.ts apps/core/src/pipeline/applySelectedRenameFilesPlan.test.ts
git commit -m "$(cat <<'EOF'
feat(core): apply rename plan with selected files

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Core — dispatch `data` through `applyPlanPipeline` and `Core.applyPlan`

**Files:**
- Modify: `apps/core/src/pipeline/applyPlan.ts`
- Modify: `apps/core/src/Core.ts:561-569`
- Test: `apps/core/src/pipeline/applySelectedRenameFilesPlan.test.ts` (append a `describe` block)

- [ ] **Step 1: Write the failing dispatch tests**

Append to `apps/core/src/pipeline/applySelectedRenameFilesPlan.test.ts` (add `applyPlanPipeline` to the imports from the local pipeline):

```ts
import { applyPlanPipeline } from "./applyPlan";
```

```ts
describe("applyPlanPipeline dispatch with data", () => {
  it("routes data.files to the selected pipeline", async () => {
    const plan = basePlan();
    const fs = seedFs(plan);
    const deps = baseDeps(fs);

    await applyPlanPipeline(plan, deps, { files: [`${folder}/old1.mkv`] });

    expect(fs.raw.has(`${folder}/S01E01.mkv`)).toBe(true);
    expect(fs.raw.has(`${folder}/S01E02.mkv`)).toBe(false);
    const planFiles = [...fs.raw.keys()].filter((p) => p.endsWith(".plan.json"));
    expect(planFiles).toEqual([planFilePath(appDataDir, "plan-1")]);
  });

  it("applies everything when data is absent", async () => {
    const plan = basePlan();
    const fs = seedFs(plan);
    const deps = baseDeps(fs);

    await applyPlanPipeline(plan, deps);

    expect(fs.raw.has(`${folder}/S01E01.mkv`)).toBe(true);
    expect(fs.raw.has(`${folder}/S01E02.mkv`)).toBe(true);
    const planFiles = [...fs.raw.keys()].filter((p) => p.endsWith(".plan.json"));
    expect(planFiles).toEqual([]);
  });

  it("ignores data for recognize-media-file plans", async () => {
    const plan = {
      id: "rec-1",
      task: "recognize-media-file" as const,
      status: "pending" as const,
      creator: "app" as const,
      mediaFolderPath: folder,
      files: [{ season: 1, episode: 2, path: `${folder}/old1.mkv` }],
    };
    const fs = inMemoryFs({
      [planFilePath(appDataDir, "rec-1")]: JSON.stringify(plan),
      [`${folder}/old1.mkv`]: "v1",
    });
    const deps = baseDeps(fs);

    await applyPlanPipeline(plan, deps, { files: [`${folder}/nope.mkv`] });

    expect(deps.setMetadata).toHaveBeenCalledTimes(1);
    expect(fs.raw.has(planFilePath(appDataDir, "rec-1"))).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @smm/core exec vitest run src/pipeline/applySelectedRenameFilesPlan.test.ts`
Expected: FAIL — `applyPlanPipeline` doesn't accept a third argument / TS error "Expected 2 arguments"

- [ ] **Step 3: Implement the dispatch**

In `apps/core/src/pipeline/applyPlan.ts` — add the import and `ApplyPlanData`, change the signature and the `rename-files` branch:

```ts
import { applyRenameFilesPlanPipeline } from "./applyRenameFilesPlan";
import { applySelectedRenameFilesPlanPipeline } from "./applySelectedRenameFilesPlan";
```

```ts
export interface ApplyPlanData {
  files?: string[];
}

/** Dispatches apply by plan task (recognize-media-file or rename-files). */
export async function applyPlanPipeline(
  plan: Plan,
  deps: ApplyPlanDeps,
  data?: ApplyPlanData,
): Promise<void> {
  const task = plan.task;
  if (task === "recognize-media-file") {
    return applyRecognizeMediaFilePlanPipeline(plan, deps);
  }
  if (task === "rename-files") {
    if (Array.isArray(data?.files)) {
      return applySelectedRenameFilesPlanPipeline(plan, data.files, deps);
    }
    return applyRenameFilesPlanPipeline(plan, deps);
  }
  throw new Error(`Unsupported plan task: ${task}`);
}
```

In `apps/core/src/Core.ts` (~line 561) — extend the import from `./pipeline/applyPlan` with `type ApplyPlanData` and change the method:

```ts
async applyPlan(plan: Plan, data?: ApplyPlanData): Promise<void> {
  await applyPlanPipeline(plan, {
    fs: this.fs,
    appDataDir: this.getMetadataRoot(),
    normalizePosix: (p) => this.normalizePosix(p),
    setMetadata: (mm) => this.writeMetadata(mm),
    getMediaMetadata: (folder) => this.readMetadata(folder),
  }, data);
}
```

- [ ] **Step 4: Run tests and typecheck to verify they pass**

Run: `pnpm --filter @smm/core exec vitest run src/pipeline/applySelectedRenameFilesPlan.test.ts && pnpm --filter @smm/core typecheck`
Expected: PASS (7 tests), typecheck clean

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/pipeline/applyPlan.ts apps/core/src/Core.ts apps/core/src/pipeline/applySelectedRenameFilesPlan.test.ts
git commit -m "$(cat <<'EOF'
feat(core): dispatch applyPlan data to selected rename pipeline

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: CLI — `POST /api/apply-plan` reads `data`, ProblemDetails errors

**Files:**
- Modify: `apps/cli/src/route/RenameEpisodesPlan.test.ts`
- Modify: `apps/cli/src/route/RenameEpisodesPlan.ts` (apply-plan handler, ~line 172)

- [ ] **Step 1: Write the failing route tests**

In `apps/cli/src/route/RenameEpisodesPlan.test.ts`:

Add to the hoisted mocks and imports:

```ts
import { SelectedFilesNotInPlanError } from '@smm/core/pipeline/applySelectedRenameFilesPlan'

const mocks = vi.hoisted(() => ({
  createRenameEpisodePlan: vi.fn(),
  getPlan: vi.fn(),
  applyPlan: vi.fn(),
  broadcast: vi.fn(),
}))
```

In `beforeEach`, add `mocks.getPlan.mockReset()` and `mocks.applyPlan.mockReset()`.

Append a new describe block:

```ts
describe('POST /api/apply-plan', () => {
  let app: Hono

  beforeEach(() => {
    mocks.getPlan.mockReset()
    mocks.applyPlan.mockReset()
    app = new Hono()
    handleRenameEpisodesPlan(app)
  })

  async function post(body: unknown) {
    return app.request('/api/apply-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('applies with selected files when data.files is given', async () => {
    mocks.getPlan.mockResolvedValue(plan)
    mocks.applyPlan.mockResolvedValue(undefined)

    const response = await post({
      id: 'plan-1',
      data: { files: ['/media/Show/old.mkv'] },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: { id: 'plan-1' } })
    expect(mocks.getPlan).toHaveBeenCalledWith('plan-1')
    expect(mocks.applyPlan).toHaveBeenCalledWith(plan, {
      files: ['/media/Show/old.mkv'],
    })
    expect(mocks.broadcast).toHaveBeenCalledWith({
      clientId: undefined,
      event: 'mediaMetadataUpdated',
      data: { folderPath: '/media/Show' },
    })
  })

  it('applies with undefined data when data is absent', async () => {
    mocks.getPlan.mockResolvedValue(plan)
    mocks.applyPlan.mockResolvedValue(undefined)

    const response = await post({ id: 'plan-1' })

    expect(response.status).toBe(200)
    expect(mocks.applyPlan).toHaveBeenCalledWith(plan, undefined)
  })

  it('returns 400 ProblemDetails for malformed data.files', async () => {
    const response = await post({ id: 'plan-1', data: { files: [] } })

    expect(response.status).toBe(400)
    expect(response.headers.get('Content-Type')).toContain('application/problem+json')
    await expect(response.json()).resolves.toEqual({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: 'data.files must be a non-empty array of strings',
      instance: '/api/apply-plan',
    })
    expect(mocks.getPlan).not.toHaveBeenCalled()
  })

  it('returns 400 ProblemDetails when Core reports files not in plan', async () => {
    mocks.getPlan.mockResolvedValue(plan)
    mocks.applyPlan.mockRejectedValue(
      new SelectedFilesNotInPlanError(['/media/Show/nope.mkv']),
    )

    const response = await post({
      id: 'plan-1',
      data: { files: ['/media/Show/nope.mkv'] },
    })

    expect(response.status).toBe(400)
    expect(response.headers.get('Content-Type')).toContain('application/problem+json')
    await expect(response.json()).resolves.toEqual({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: 'Files not in plan: /media/Show/nope.mkv',
      instance: '/api/apply-plan',
    })
  })

  it('keeps the legacy Error Reason body for other Core errors', async () => {
    mocks.getPlan.mockRejectedValue(new Error('Plan not found: plan-1'))

    const response = await post({ id: 'plan-1' })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      error: 'Error Reason: Plan not found: plan-1',
    })
  })
})
```

(The `plan` fixture already exists at the top of the file: `id: 'plan-1'`, `task: 'rename-files'`, `mediaFolderPath: '/media/Show'`, `files: [{ from: '/media/Show/old.mkv', to: '/media/Show/S01E01.mkv' }]`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter cli exec vitest run src/route/RenameEpisodesPlan.test.ts`
Expected: FAIL — new `POST /api/apply-plan` describe block fails (route ignores `data`, never returns 400)

- [ ] **Step 3: Implement the route changes**

In `apps/cli/src/route/RenameEpisodesPlan.ts`:

Add imports:

```ts
import type { ProblemDetails } from '@smm/types'
import { SelectedFilesNotInPlanError } from '@smm/core/pipeline/applySelectedRenameFilesPlan'
```

Replace the `ApplyPlanRequestBody` interface:

```ts
export interface ApplyPlanRequestBody {
  id: string
  data?: { files?: string[] }
}
```

Add these helpers next to `readRenameFiles`:

```ts
type ApplyPlanDataSelection =
  | { kind: 'absent' }
  | { kind: 'selected'; files: string[] }
  | { kind: 'invalid' }

function readApplyPlanData(body: unknown): ApplyPlanDataSelection {
  if (typeof body !== 'object' || body === null || !('data' in body)) {
    return { kind: 'absent' }
  }
  const data = (body as Record<string, unknown>).data
  if (data === undefined || data === null) return { kind: 'absent' }
  if (typeof data !== 'object') return { kind: 'invalid' }
  const files = (data as Record<string, unknown>).files
  if (!Array.isArray(files) || files.length === 0) return { kind: 'invalid' }
  if (!files.every((file) => typeof file === 'string')) return { kind: 'invalid' }
  return { kind: 'selected', files: files as string[] }
}

function problemDetails(detail: string): ProblemDetails {
  return {
    type: 'about:blank',
    title: 'Bad Request',
    status: 400,
    detail,
    instance: '/api/apply-plan',
  }
}
```

Replace the `app.post('/api/apply-plan', ...)` handler body between `try {` and the final `catch` closing brace:

```ts
app.post('/api/apply-plan', async (c) => {
  try {
    let body: unknown = {}
    try {
      body = await c.req.json()
    } catch {
      /* empty */
    }

    const id = readStringField(body, 'id')
    if (!id?.trim()) {
      const err: ApplyPlanResponseBody = { error: 'Error Reason: id is required' }
      return c.json(err, 200)
    }

    const selection = readApplyPlanData(body)
    if (selection.kind === 'invalid') {
      const problem = problemDetails('data.files must be a non-empty array of strings')
      return c.json(problem, 400, { 'Content-Type': 'application/problem+json' })
    }

    const clientId = c.req.header('clientId')
    const plan = await getCore().getPlan(id)
    await getCore().applyPlan(
      plan,
      selection.kind === 'selected' ? { files: selection.files } : undefined,
    )

    if (plan.task === 'rename-files') {
      broadcast({
        clientId: clientId ?? undefined,
        event: 'mediaMetadataUpdated',
        data: { folderPath: Path.posix(plan.mediaFolderPath) },
      })
    }

    const ok: ApplyPlanResponseBody = { data: { id: plan.id } }
    return c.json(ok, 200)
  } catch (error) {
    logger.error({ error }, '[POST /api/apply-plan] route error')
    if (error instanceof SelectedFilesNotInPlanError) {
      const problem = problemDetails(error.message)
      return c.json(problem, 400, { 'Content-Type': 'application/problem+json' })
    }
    const err: ApplyPlanResponseBody = {
      error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
    return c.json(err, 200)
  }
})
```

- [ ] **Step 4: Run tests and typecheck to verify they pass**

Run: `pnpm --filter cli exec vitest run src/route/RenameEpisodesPlan.test.ts && pnpm --filter cli typecheck`
Expected: PASS (existing 4 + new 5), typecheck clean

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/route/RenameEpisodesPlan.ts apps/cli/src/route/RenameEpisodesPlan.test.ts
git commit -m "$(cat <<'EOF'
feat(cli): support selected files on apply-plan with ProblemDetails errors

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Full verification (AGENTS.md post-change + pre-commit)

**Files:** none (verification only)

- [ ] **Step 1: Build, typecheck, and unit tests (per AGENTS.md)**

```bash
pnpm build && pnpm typecheck && pnpm test:core && pnpm test:cli
```

Expected: all green. Fix any fallout before continuing (e.g., other `applyPlan` callers — none expected; signature change is additive/optional).

- [ ] **Step 2: No commit needed if nothing changed**

If Step 1 required fixes, commit them with an appropriate message; otherwise finish.
