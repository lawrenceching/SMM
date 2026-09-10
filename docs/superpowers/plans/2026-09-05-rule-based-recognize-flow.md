# Rule-Based Recognize Flow Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite rule-based recognize to mirror the rename flow: backend builds the pending plan via a new `POST /api/try-to-recognize-episodes`, the UI flow hook owns local `open`/`plan` state, and `apply-plan` gains selected-episodes support for `recognize-media-file`.

**Architecture:** 3 layers — `apps/core` (selected recognize apply pipeline), `apps/cli` (new route + 400 error mapping), `apps/ui` (api + mutation + flow hook rewrite + prompt wiring + context slim-down). Design doc: `docs/superpowers/specs/2026-09-05-rule-based-recognize-flow-design.md`.

**Tech Stack:** TypeScript, Hono (cli), TanStack Query + Vitest + Testing Library (ui), in-memory `FsPort` (core tests).

## Global Constraints

- **DO NOT run `git commit` at any point.** The user reviews all changes locally; every "Commit" step from the standard template is replaced by a verification step. Leave all work uncommitted.
- Reference flow implementation: `apps/ui/src/hooks/tv/useRuleBasedRenameFilesFlow.ts` and its test `useRuleBasedRenameFilesFlow.test.tsx` (hook-level mutation mocks via `vi.hoisted`).
- Error body pattern for non-validation route errors: `{ error: "Error Reason: ..." }` with HTTP 200; selection membership errors: RFC 9457 ProblemDetails with HTTP 400 (`Content-Type: application/problem+json`).
- Selection membership comparison: `mediaFilePathEqual` from `@smm/core/pipeline/mediaFilePathEqual`, with a pre-normalization `p.replaceAll("\\", "/")` (same as `applySelectedRenameFilesPlan.ts:36`).
- `apps/ui` typecheck MUST use `pnpm exec tsc -p tsconfig.app.json --noEmit` (the root `tsconfig.json` has `"files": []` and checks nothing).
- AI flows (`useAiBasedRecognizeFlow`, `useAiBasedRenameFilesFlow`, `handleAiRecognizeConfirm`) are out of scope and must keep working: do NOT delete `applyRecognizeMediaFilePlan` or `rebuildPlanWithSelectedEpisodes` from `TvShowPanelUtils.ts`.

---

### Task 1: Core — selected recognize apply pipeline

**Files:**
- Create: `apps/core/src/pipeline/applySelectedRecognizeFilesPlan.ts`
- Modify: `apps/core/src/pipeline/applyPlan.ts`
- Test: `apps/core/src/pipeline/applySelectedRecognizeFilesPlan.test.ts` (new)

**Interfaces:**
- Consumes: `ApplyPlanDeps` from `./applyPlan`; `deletePlan` from `./plans`; `updateMediaFileMetadatas` from `./updateMediaFileMetadatas` (signature: `(files, path, season, episode) => files`); `mediaFilePathEqual` from `./mediaFilePathEqual`.
- Produces: `class RecognizedFilesNotInPlanError extends Error { readonly files: string[] }` and `applySelectedRecognizeFilesPlanPipeline(plan: RecognizeMediaFilePlan, selectedFiles: string[], deps: ApplyPlanDeps): Promise<void>`. Task 2 imports the error class; `applyPlanPipeline` dispatch gains the `data.files` branch.

- [ ] **Step 1: Write the failing test**

Create `apps/core/src/pipeline/applySelectedRecognizeFilesPlan.test.ts`. Copy the `inMemoryFs` helper from `applySelectedRenameFilesPlan.test.ts:22-60` verbatim (it implements `FsPort` over a `Map` with `raw` exposure). Then add:

```ts
import { describe, expect, it, vi } from "vitest";
import type { MediaMetadata } from "@smm/types";
import type { RecognizeMediaFilePlan } from "@smm/types/RecognizeMediaFilePlan";
import { metadataCachePath, planFilePath } from "./paths";
import {
  applySelectedRecognizeFilesPlanPipeline,
  RecognizedFilesNotInPlanError,
} from "./applySelectedRecognizeFilesPlan";
import { applyPlanPipeline } from "./applyPlan";

const appDataDir = "/data";
const folder = "/m/Show";

// ... inMemoryFs helper copied from applySelectedRenameFilesPlan.test.ts ...

const plan: RecognizeMediaFilePlan = {
  id: "plan-r1",
  task: "recognize-media-file",
  status: "pending",
  creator: "app",
  mediaFolderPath: folder,
  files: [
    { season: 1, episode: 1, path: `${folder}/ep1.mkv` },
    { season: 1, episode: 2, path: `${folder}/ep2.mkv` },
  ],
};

function seedMetadata(mediaFiles: MediaMetadata["mediaFiles"]): Record<string, string> {
  return {
    // Runtime cast: MediaMetadata has required fields the pipeline never reads.
    [metadataCachePath(appDataDir, folder)]: JSON.stringify({
      mediaFolderPath: folder,
      type: "tvshow-folder",
      mediaFiles: mediaFiles ?? [],
    } as unknown as MediaMetadata),
    [planFilePath(appDataDir, plan.id)]: JSON.stringify(plan),
  };
}

describe("applySelectedRecognizeFilesPlanPipeline", () => {
  it("applies only the selected entries and deletes the plan", async () => {
    const fs = inMemoryFs(
      seedMetadata([{ absolutePath: `${folder}/ep1.mkv` }]),
    );
    await applySelectedRecognizeFilesPlanPipeline(plan, [`${folder}/ep2.mkv`], {
      fs,
      appDataDir,
      normalizePosix: (p) => p,
      getMediaMetadata: async (f) =>
        JSON.parse(fs.raw.get(metadataCachePath(appDataDir, f))!) as MediaMetadata,
      setMetadata: async (mm) => {
        fs.raw.set(metadataCachePath(appDataDir, folder), JSON.stringify(mm));
      },
    });

    const mm = JSON.parse(fs.raw.get(metadataCachePath(appDataDir, folder))!) as MediaMetadata;
    const ep2 = mm.mediaFiles?.find((f) => f.absolutePath === `${folder}/ep2.mkv`);
    expect(ep2?.seasonNumber).toBe(1);
    expect(ep2?.episodeNumber).toBe(2);
    expect(await fs.exists(planFilePath(appDataDir, plan.id))).toBe(false);
  });

  it("throws RecognizedFilesNotInPlanError with offenders and writes nothing", async () => {
    const fs = inMemoryFs(seedMetadata([]));
    await expect(
      applySelectedRecognizeFilesPlanPipeline(
        plan,
        [`${folder}/other.mkv`],
        {
          fs,
          appDataDir,
          normalizePosix: (p) => p,
          getMediaMetadata: async () => null,
          setMetadata: async () => {},
        },
      ),
    ).rejects.toMatchObject({
      name: "RecognizedFilesNotInPlanError",
      files: [`${folder}/other.mkv`],
    });
    expect(await fs.exists(planFilePath(appDataDir, plan.id))).toBe(true);
  });

  it("rejects an empty selection", async () => {
    const fs = inMemoryFs(seedMetadata([]));
    await expect(
      applySelectedRecognizeFilesPlanPipeline(plan, [], {
        fs,
        appDataDir,
        normalizePosix: (p) => p,
        getMediaMetadata: async () => null,
        setMetadata: async () => {},
      }),
    ).rejects.toThrow("data.files must be a non-empty array");
  });

  it("matches Windows-style separators in the selection", async () => {
    const fs = inMemoryFs(seedMetadata([]));
    await applySelectedRecognizeFilesPlanPipeline(plan, [`\\m\\Show\\ep1.mkv`], {
      fs,
      appDataDir,
      normalizePosix: (p) => p,
      getMediaMetadata: async () =>
        JSON.parse(fs.raw.get(metadataCachePath(appDataDir, folder))!) as MediaMetadata,
      setMetadata: async (mm) => {
        fs.raw.set(metadataCachePath(appDataDir, folder), JSON.stringify(mm));
      },
    });
    const mm = JSON.parse(fs.raw.get(metadataCachePath(appDataDir, folder))!) as MediaMetadata;
    expect(mm.mediaFiles?.find((f) => f.absolutePath === `${folder}/ep1.mkv`)?.episodeNumber).toBe(1);
    expect(await fs.exists(planFilePath(appDataDir, plan.id))).toBe(false);
  });
});

describe("applyPlanPipeline dispatch (recognize-media-file)", () => {
  it("routes data.files to the selected pipeline", async () => {
    const fs = inMemoryFs(seedMetadata([]));
    await applyPlanPipeline(plan, {
      fs,
      appDataDir,
      normalizePosix: (p) => p,
      getMediaMetadata: async () =>
        JSON.parse(fs.raw.get(metadataCachePath(appDataDir, folder))!) as MediaMetadata,
      setMetadata: async (mm) => {
        fs.raw.set(metadataCachePath(appDataDir, folder), JSON.stringify(mm));
      },
    }, { files: [`${folder}/ep1.mkv`] });
    const mm = JSON.parse(fs.raw.get(metadataCachePath(appDataDir, folder))!) as MediaMetadata;
    expect(mm.mediaFiles?.some((f) => f.absolutePath === `${folder}/ep1.mkv` && f.episodeNumber === 1)).toBe(true);
    expect(mm.mediaFiles?.find((f) => f.absolutePath === `${folder}/ep2.mkv`)).toBeUndefined();
  });

  it("keeps full merge when data is absent", async () => {
    const fs = inMemoryFs(seedMetadata([]));
    await applyPlanPipeline(plan, {
      fs,
      appDataDir,
      normalizePosix: (p) => p,
      getMediaMetadata: async () =>
        JSON.parse(fs.raw.get(metadataCachePath(appDataDir, folder))!) as MediaMetadata,
      setMetadata: async (mm) => {
        fs.raw.set(metadataCachePath(appDataDir, folder), JSON.stringify(mm));
      },
    });
    const mm = JSON.parse(fs.raw.get(metadataCachePath(appDataDir, folder))!) as MediaMetadata;
    expect(mm.mediaFiles?.length).toBe(2);
  });
});
```

Adapt assertions if `updateMediaFileMetadatas` merges differently than `seasonNumber`/`episodeNumber` on the media file (read `apps/core/src/pipeline/updateMediaFileMetadatas.ts:5` first and align the seed `mediaFiles` shape with `MediaMetadata["mediaFiles"]`).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/core && pnpm exec vitest run src/pipeline/applySelectedRecognizeFilesPlan.test.ts`
Expected: FAIL — `Cannot find module './applySelectedRecognizeFilesPlan'`

- [ ] **Step 3: Write the pipeline**

Create `apps/core/src/pipeline/applySelectedRecognizeFilesPlan.ts`:

```ts
import type { RecognizeMediaFilePlan } from "@smm/types/RecognizeMediaFilePlan";
import type { ApplyPlanDeps } from "./applyPlan";
import { mediaFilePathEqual } from "./mediaFilePathEqual";
import { updateMediaFileMetadatas } from "./updateMediaFileMetadatas";
import { deletePlan } from "./plans";

export class RecognizedFilesNotInPlanError extends Error {
  readonly files: string[];

  constructor(files: string[]) {
    super(`Files not in plan: ${files.join(", ")}`);
    this.name = "RecognizedFilesNotInPlanError";
    this.files = files;
  }
}

/**
 * Apply only the selected files of a pending recognize-media-file plan:
 * validate membership, merge the filtered entries into metadata, delete the plan.
 */
export async function applySelectedRecognizeFilesPlanPipeline(
  plan: RecognizeMediaFilePlan,
  selectedFiles: string[],
  deps: ApplyPlanDeps,
): Promise<void> {
  if (plan.task !== "recognize-media-file") {
    throw new Error(`Unsupported plan task: ${plan.task}`);
  }
  if (selectedFiles.length === 0) {
    throw new Error("data.files must be a non-empty array");
  }

  // Normalize Windows separators first: mediaFilePathEqual's Path.posix
  // fallback can't parse paths like "\m\Show\ep1.mkv" (no drive letter).
  const toPosix = (p: string) => p.replaceAll("\\", "/");

  const offenders = selectedFiles.filter(
    (file) => !plan.files.some((entry) => mediaFilePathEqual(entry.path, toPosix(file))),
  );
  if (offenders.length > 0) {
    throw new RecognizedFilesNotInPlanError(offenders);
  }

  const filtered = plan.files.filter((entry) =>
    selectedFiles.some((file) => mediaFilePathEqual(entry.path, toPosix(file))),
  );

  const folder = deps.normalizePosix(plan.mediaFolderPath);
  const mm = await deps.getMediaMetadata(folder);
  if (!mm) {
    throw new Error(`Media metadata not found: ${plan.mediaFolderPath}`);
  }

  let mediaFiles = mm.mediaFiles ?? [];
  for (const file of filtered) {
    mediaFiles = updateMediaFileMetadatas(mediaFiles, file.path, file.season, file.episode);
  }

  await deps.setMetadata({ ...mm, mediaFiles });
  await deletePlan(deps.fs, deps.appDataDir, plan.id);
}
```

- [ ] **Step 4: Add the dispatch branch**

In `apps/core/src/pipeline/applyPlan.ts`, add the import and change the recognize branch (lines 27-29) to:

```ts
import { applySelectedRecognizeFilesPlanPipeline } from "./applySelectedRecognizeFilesPlan";
```

```ts
  if (task === "recognize-media-file") {
    if (Array.isArray(data?.files)) {
      return applySelectedRecognizeFilesPlanPipeline(plan, data.files, deps);
    }
    return applyRecognizeMediaFilePlanPipeline(plan, deps);
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/core && pnpm exec vitest run src/pipeline/applySelectedRecognizeFilesPlan.test.ts src/pipeline/applyPlan.test.ts src/pipeline/applySelectedRenameFilesPlan.test.ts`
Expected: PASS (including existing rename tests — rename dispatch unchanged)

- [ ] **Step 6: Verify no regressions (no commit)**

Run: `cd apps/core && pnpm test 2>&1 | tail -5 && pnpm typecheck`
Expected: all tests PASS, typecheck clean. **Do NOT commit** — leave changes local for user review.

---

### Task 2: CLI — try-to-recognize-episodes route + apply-plan 400 mapping

**Files:**
- Create: `apps/cli/src/route/TryToRecognizeEpisodes.ts`
- Modify: `apps/cli/src/route/RenameEpisodesPlan.ts:242-251` (apply-plan catch block)
- Modify: `apps/cli/server.ts:47,301` (import + mount)
- Test: `apps/cli/src/route/TryToRecognizeEpisodes.test.ts` (new), `apps/cli/src/route/RenameEpisodesPlan.test.ts` (extend)

**Interfaces:**
- Consumes: `getCore()` from `../core/getCore` (`tryToRecognizeEpisodes(path): Promise<RecognizeMediaFilePlan>`); `RecognizedFilesNotInPlanError` from Task 1.
- Produces: `handleTryToRecognizeEpisodes(app: Hono): void` serving `POST /api/try-to-recognize-episodes` with body `{ mediaFolderPath: string }` → `{ data: { plan } }` or `{ error }` (HTTP 200).

- [ ] **Step 1: Write the failing route test**

Create `apps/cli/src/route/TryToRecognizeEpisodes.test.ts`, mirroring `RenameEpisodesPlan.test.ts:1-46` mock setup:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

const mocks = vi.hoisted(() => ({
  tryToRecognizeEpisodes: vi.fn(),
}))

vi.mock('../core/getCore', () => ({
  getCore: () => mocks,
}))

import { handleTryToRecognizeEpisodes } from './TryToRecognizeEpisodes'

const plan = {
  id: 'plan-r1',
  task: 'recognize-media-file' as const,
  status: 'pending' as const,
  creator: 'app' as const,
  mediaFolderPath: '/media/Show',
  files: [{ season: 1, episode: 1, path: '/media/Show/S01E01.mkv' }],
}

describe('POST /api/try-to-recognize-episodes', () => {
  let app: Hono

  beforeEach(() => {
    mocks.tryToRecognizeEpisodes.mockReset()
    app = new Hono()
    handleTryToRecognizeEpisodes(app)
  })

  async function post(body: unknown) {
    return app.request('/api/try-to-recognize-episodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('returns the pending plan', async () => {
    mocks.tryToRecognizeEpisodes.mockResolvedValue(plan)

    const response = await post({ mediaFolderPath: '/media/Show' })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: { plan } })
    expect(mocks.tryToRecognizeEpisodes).toHaveBeenCalledWith('/media/Show')
  })

  it('requires mediaFolderPath', async () => {
    const response = await post({})
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      error: 'Error Reason: mediaFolderPath is required',
    })
    expect(mocks.tryToRecognizeEpisodes).not.toHaveBeenCalled()
  })

  it('maps pipeline errors to Error Reason', async () => {
    mocks.tryToRecognizeEpisodes.mockRejectedValue(new Error('Media metadata not found: /media/Show'))

    const response = await post({ mediaFolderPath: '/media/Show' })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      error: 'Error Reason: Media metadata not found: /media/Show',
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/cli && pnpm exec vitest run src/route/TryToRecognizeEpisodes.test.ts`
Expected: FAIL — `Cannot find module './TryToRecognizeEpisodes'`

- [ ] **Step 3: Implement the route**

Create `apps/cli/src/route/TryToRecognizeEpisodes.ts`:

```ts
import type { Hono } from 'hono'
import type { RecognizeMediaFilePlan } from '@smm/types/RecognizeMediaFilePlan'
import { getCore } from '../core/getCore'
import { logger } from '../../lib/logger'

export interface TryToRecognizeEpisodesRequestBody {
  mediaFolderPath: string
}

export interface TryToRecognizeEpisodesResponseBody {
  data?: { plan: RecognizeMediaFilePlan }
  error?: string
}

function readStringField(body: unknown, key: string): string | undefined {
  if (typeof body !== 'object' || body === null || !(key in body)) return undefined
  const value = (body as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : undefined
}

/**
 * Recognize-episodes plan HTTP surface matching docs/dev/recognize-episodes.md:
 * - POST /api/try-to-recognize-episodes → Core.tryToRecognizeEpisodes
 * (apply/reject reuse POST /api/apply-plan and /api/reject-plan in RenameEpisodesPlan.ts)
 */
export function handleTryToRecognizeEpisodes(app: Hono): void {
  app.post('/api/try-to-recognize-episodes', async (c) => {
    try {
      let body: unknown = {}
      try {
        body = await c.req.json()
      } catch {
        /* empty */
      }

      const mediaFolderPath = readStringField(body, 'mediaFolderPath')
      if (!mediaFolderPath?.trim()) {
        const err: TryToRecognizeEpisodesResponseBody = {
          error: 'Error Reason: mediaFolderPath is required',
        }
        return c.json(err, 200)
      }

      const plan = await getCore().tryToRecognizeEpisodes(mediaFolderPath)
      const ok: TryToRecognizeEpisodesResponseBody = { data: { plan } }
      return c.json(ok, 200)
    } catch (error) {
      logger.error({ error }, '[POST /api/try-to-recognize-episodes] route error')
      const err: TryToRecognizeEpisodesResponseBody = {
        error: `Error Reason: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
      return c.json(err, 200)
    }
  })
}
```

- [ ] **Step 4: Map the new error to 400 ProblemDetails in apply-plan**

In `apps/cli/src/route/RenameEpisodesPlan.ts`, add the import next to line 10:

```ts
import { RecognizedFilesNotInPlanError } from '@smm/core/pipeline/applySelectedRecognizeFilesPlan'
```

Change the apply-plan catch block (lines 242-245) from:

```ts
      if (error instanceof SelectedFilesNotInPlanError) {
        const problem = problemDetails(error.message)
        return c.json(problem, 400, { 'Content-Type': 'application/problem+json' })
      }
```

to:

```ts
      if (
        error instanceof SelectedFilesNotInPlanError ||
        error instanceof RecognizedFilesNotInPlanError
      ) {
        const problem = problemDetails(error.message)
        return c.json(problem, 400, { 'Content-Type': 'application/problem+json' })
      }
```

- [ ] **Step 5: Extend the apply-plan route test**

In `apps/cli/src/route/RenameEpisodesPlan.test.ts`, extend the `vi.mock('@smm/core/pipeline/applySelectedRenameFilesPlan')` style: the error classes are real imports (not mocked — see line 3), so simply add a test inside the apply-plan `describe` block:

```ts
  it('maps RecognizedFilesNotInPlanError to 400 problem+json', async () => {
    const { RecognizedFilesNotInPlanError } = await import('@smm/core/pipeline/applySelectedRecognizeFilesPlan')
    mocks.applyPlan.mockRejectedValue(
      new RecognizedFilesNotInPlanError(['/media/Show/ghost.mkv']),
    )
    mocks.getPlan.mockResolvedValue({
      ...plan,
      task: 'recognize-media-file' as const,
      files: [{ season: 1, episode: 1, path: '/media/Show/S01E01.mkv' }],
    })

    const response = await post({ id: 'plan-1', data: { files: ['/media/Show/ghost.mkv'] } })
    expect(response.status).toBe(400)
    expect(response.headers.get('Content-Type')).toContain('application/problem+json')
    const body = await response.json()
    expect(body.detail).toBe('Files not in plan: /media/Show/ghost.mkv')
  })
```

Adjust `post`/`plan` names to the actual helpers used in the apply-plan `describe` block of that file (read the file section around the existing `SelectedFilesNotInPlanError` test and mirror it exactly).

- [ ] **Step 6: Mount the route in server.ts**

In `apps/cli/server.ts`, add after line 47:

```ts
import { handleTryToRecognizeEpisodes } from './src/route/TryToRecognizeEpisodes';
```

and after line 301 (`handleRenameEpisodesPlan(this.app);`):

```ts
    handleTryToRecognizeEpisodes(this.app);
```

- [ ] **Step 7: Run tests to verify they pass (no commit)**

Run: `cd apps/cli && pnpm exec vitest run src/route/TryToRecognizeEpisodes.test.ts src/route/RenameEpisodesPlan.test.ts && pnpm typecheck`
Expected: PASS, typecheck clean. **Do NOT commit.**

---

### Task 3: UI — api client + mutation hook

**Files:**
- Create: `apps/ui/src/api/tryToRecognizeEpisodes.ts`
- Create: `apps/ui/src/hooks/plans/useTryToRecognizeEpisodesMutation.ts`

**Interfaces:**
- Consumes: `apiFetch` from `@/lib/apiFetch`; `RecognizeMediaFilePlan` from `@smm/types/RecognizeMediaFilePlan`; `plansQueryKey` / `normalizeMediaFolderPathForQuery`.
- Produces: `tryToRecognizeEpisodes(request: TryToRecognizeEpisodesRequest, signal?): Promise<TryToRecognizeEpisodesResponseBody>` and `useTryToRecognizeEpisodesMutation(): useMutation<RecognizeMediaFilePlan, Error, { mediaFolderPath: string }>`. Task 4 imports the hook.

- [ ] **Step 1: Create the api client**

Create `apps/ui/src/api/tryToRecognizeEpisodes.ts`, mirroring `apps/ui/src/api/tryToRenameEpisodes.ts`:

```ts
import type { RecognizeMediaFilePlan } from '@smm/types/RecognizeMediaFilePlan'
import { apiFetch } from '@/lib/apiFetch'

export interface TryToRecognizeEpisodesRequest {
  mediaFolderPath: string
}

export interface TryToRecognizeEpisodesResponseBody {
  data?: { plan: RecognizeMediaFilePlan }
  error?: string
}

/** POST /api/try-to-recognize-episodes — build a pending recognize-media-file plan. */
export async function tryToRecognizeEpisodes(
  request: TryToRecognizeEpisodesRequest,
  signal?: AbortSignal,
): Promise<TryToRecognizeEpisodesResponseBody> {
  const resp = await apiFetch('/api/try-to-recognize-episodes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  })

  if (!resp.ok) {
    throw new Error(`Failed to try-to-recognize-episodes: ${resp.statusText}`)
  }

  return (await resp.json()) as TryToRecognizeEpisodesResponseBody
}
```

- [ ] **Step 2: Create the mutation hook**

Create `apps/ui/src/hooks/plans/useTryToRecognizeEpisodesMutation.ts`, mirroring `useTryToRenameEpisodesMutation.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { tryToRecognizeEpisodes } from "@/api/tryToRecognizeEpisodes"
import type { Plan } from "@/api/getPlans"
import { normalizeMediaFolderPathForQuery } from "@/lib/mediaMetadataQueryKeys"
import { plansQueryKey } from "./plansQueryKeys"

export interface TryToRecognizeEpisodesVariables {
  mediaFolderPath: string
}

/**
 * POST /api/try-to-recognize-episodes — build a pending recognize-media-file
 * plan and add it to the plans cache.
 */
export function useTryToRecognizeEpisodesMutation() {
  const queryClient = useQueryClient()

  return useMutation<RecognizeMediaFilePlan, Error, TryToRecognizeEpisodesVariables>({
    mutationFn: async ({ mediaFolderPath }): Promise<RecognizeMediaFilePlan> => {
      const resp = await tryToRecognizeEpisodes({ mediaFolderPath })
      if (resp.error || !resp.data?.plan) {
        throw new Error(resp.error ?? "Failed to create recognize plan")
      }
      return resp.data.plan as RecognizeMediaFilePlan
    },
    onSuccess: (plan, { mediaFolderPath }) => {
      const key = plansQueryKey(normalizeMediaFolderPathForQuery(mediaFolderPath))
      queryClient.setQueryData<Plan[]>(key, (prev) => {
        const rest = (prev ?? []).filter((p) => p.id !== plan.id)
        return [...rest, plan]
      })
    },
  })
}
```

Add `import type { RecognizeMediaFilePlan } from "@smm/types/RecognizeMediaFilePlan"` at the top.

- [ ] **Step 3: Verify (no commit)**

Run: `cd apps/ui && pnpm exec tsc -p tsconfig.app.json --noEmit`
Expected: clean (pre-existing TvShowPanel errors unrelated to these two new files are acceptable at this point; the new files themselves must produce zero errors). **Do NOT commit.**

---

### Task 4: UI — rewrite useRuleBasedRecognizeFlow (TDD)

**Files:**
- Modify: `apps/ui/src/hooks/tv/useRuleBasedRecognizeFlow.ts` (full rewrite, 344 → ~150 lines)
- Test: `apps/ui/src/hooks/tv/useRuleBasedRecognizeFlow.test.tsx` (rewrite)

**Interfaces:**
- Consumes: `useTryToRecognizeEpisodesMutation` (Task 3), `useApplyPlanMutation` / `useRejectPlanMutation` (`ApplyPlanVariables { id, mediaFolderPath, files? }`, `RejectPlanVariables { id, mediaFolderPath }`), `isRuleBasedRecognizePlanComplete` / `isRuleBasedRecognizePlanFullyUnchanged` from `@/lib/isRuleBasedRecognizePlanComplete` (signature: `(files: RecognizedFile[], mediaMetadata: MediaMetadata) => boolean`).
- Produces: `useRuleBasedRecognizeFlow({ mediaMetadata })` returning `{ plan: RecognizeMediaFilePlan | undefined, open: boolean, loading: boolean, tvShowTitle: string, tvShowTmdbId: number, notAllEpisodesRecognized: boolean, allPlanFilesUnchanged: boolean, confirm(selectedEpisodeFiles?: string[]): Promise<void>, cancel(): Promise<void>, start(): void }`. Task 5 consumes all of these.

- [ ] **Step 1: Write the failing tests**

Rewrite `apps/ui/src/hooks/tv/useRuleBasedRecognizeFlow.test.tsx`, mirroring `useRuleBasedRenameFilesFlow.test.tsx` exactly (same hoisted-mock setup, QueryClient wrapper, `mediaMetadata` fixture builder):

```tsx
import { describe, expect, it, vi, beforeEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useRuleBasedRecognizeFlow } from "./useRuleBasedRecognizeFlow"
import type { MediaMetadata } from "@smm/types"
import type { RecognizeMediaFilePlan } from "@smm/types/RecognizeMediaFilePlan"

const {
  toastErrorMock,
  toastSuccessMock,
  tryToRecognizeMutationMock,
  rejectPlanMutationMock,
  applyPlanMutationMock,
} = vi.hoisted(() => {
  const makeMutation = () => ({
    mutateAsync: vi.fn(),
    mutate: vi.fn(),
    reset: vi.fn(),
    isPending: false,
  })
  return {
    toastErrorMock: vi.fn(),
    toastSuccessMock: vi.fn(),
    tryToRecognizeMutationMock: makeMutation(),
    rejectPlanMutationMock: makeMutation(),
    applyPlanMutationMock: makeMutation(),
  }
})

vi.mock("sonner", () => ({
  toast: { error: toastErrorMock, success: toastSuccessMock },
}))

vi.mock("@/hooks/plans/useTryToRecognizeEpisodesMutation", () => ({
  useTryToRecognizeEpisodesMutation: () => tryToRecognizeMutationMock,
}))

vi.mock("@/hooks/plans/useRejectPlanMutation", () => ({
  useRejectPlanMutation: () => rejectPlanMutationMock,
}))

vi.mock("@/hooks/plans/useApplyPlanMutation", () => ({
  useApplyPlanMutation: () => applyPlanMutationMock,
}))

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}))

describe("useRuleBasedRecognizeFlow", () => {
  const mediaFolderPath = "/storage/Users/currentUser/Download/Anime/show"
  const pendingPlan: RecognizeMediaFilePlan = {
    id: "plan-1",
    task: "recognize-media-file",
    status: "pending",
    creator: "app",
    mediaFolderPath,
    files: [
      { season: 1, episode: 1, path: `${mediaFolderPath}/S01E01.mkv` },
      { season: 1, episode: 2, path: `${mediaFolderPath}/S01E02.mkv` },
    ],
  }

  const mediaMetadata = {
    mediaFolderPath,
    type: "tvshow-folder",
    tvShow: {
      id: "123",
      name: "Test Show",
      seasons: [
        {
          season: 1,
          name: "Season 1",
          episodes: [
            { episode: 1, name: "E1" },
            { episode: 2, name: "E2" },
          ],
        },
      ],
    },
    mediaFiles: [{ absolutePath: `${mediaFolderPath}/S01E01.mkv`, seasonNumber: 1, episodeNumber: 1 }],
  } as unknown as MediaMetadata

  let queryClient: QueryClient

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  const renderFlow = () =>
    renderHook(() => useRuleBasedRecognizeFlow({ mediaMetadata }), { wrapper })

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    vi.clearAllMocks()
    tryToRecognizeMutationMock.mutateAsync.mockResolvedValue(pendingPlan)
    rejectPlanMutationMock.mutateAsync.mockResolvedValue(null)
    applyPlanMutationMock.mutateAsync.mockResolvedValue(null)
    tryToRecognizeMutationMock.isPending = false
  })

  it("Start to recognize: open=true, mutation called, loading=true while pending", async () => {
    let resolveTryToRecognize: (plan: RecognizeMediaFilePlan) => void = () => {}
    tryToRecognizeMutationMock.mutateAsync.mockImplementation(
      () => new Promise<RecognizeMediaFilePlan>((resolve) => { resolveTryToRecognize = resolve }),
    )
    tryToRecognizeMutationMock.isPending = true

    const { result } = renderFlow()

    act(() => {
      result.current.start()
    })

    expect(result.current.open).toBe(true)
    expect(tryToRecognizeMutationMock.mutateAsync).toHaveBeenCalledWith({ mediaFolderPath })
    expect(result.current.loading).toBe(true)

    await act(async () => {
      tryToRecognizeMutationMock.isPending = false
      resolveTryToRecognize(pendingPlan)
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.plan).toEqual(pendingPlan)
  })

  it("Start to recognize and then cancel", async () => {
    const { result } = renderFlow()

    await act(async () => {
      await result.current.start()
    })

    await act(async () => {
      await result.current.cancel()
    })

    expect(result.current.open).toBe(false)
    expect(rejectPlanMutationMock.mutateAsync).toHaveBeenCalledWith({
      id: "plan-1",
      mediaFolderPath,
    })
    expect(tryToRecognizeMutationMock.reset).toHaveBeenCalled()
    expect(rejectPlanMutationMock.reset).toHaveBeenCalled()
    expect(applyPlanMutationMock.reset).toHaveBeenCalled()
    expect(result.current.plan).toBeUndefined()
  })

  it("Start to recognize and then confirm without selection", async () => {
    const { result } = renderFlow()

    await act(async () => {
      await result.current.start()
    })

    await act(async () => {
      await result.current.confirm()
    })

    expect(applyPlanMutationMock.mutateAsync).toHaveBeenCalledWith({
      id: "plan-1",
      mediaFolderPath,
      files: undefined,
    })
    expect(result.current.open).toBe(false)
    expect(result.current.plan).toBeUndefined()
    expect(toastErrorMock).not.toHaveBeenCalled()
  })

  it("Confirm with selected files passes them to apply-plan", async () => {
    const { result } = renderFlow()

    await act(async () => {
      await result.current.start()
    })

    await act(async () => {
      await result.current.confirm([`${mediaFolderPath}/S01E01.mkv`])
    })

    expect(applyPlanMutationMock.mutateAsync).toHaveBeenCalledWith({
      id: "plan-1",
      mediaFolderPath,
      files: [`${mediaFolderPath}/S01E01.mkv`],
    })
    expect(result.current.open).toBe(false)
  })

  it("Confirm failure keeps the prompt open and toasts", async () => {
    applyPlanMutationMock.mutateAsync.mockRejectedValue(new Error("boom"))

    const { result } = renderFlow()

    await act(async () => {
      await result.current.start()
    })

    await act(async () => {
      await result.current.confirm()
    })

    expect(toastErrorMock).toHaveBeenCalledWith("Recognition failed. Please try again.")
    expect(result.current.open).toBe(true)
    expect(result.current.plan).toEqual(pendingPlan)
  })

  it("Empty recognition result: prompt closed, no-recognized-files toast, plan rejected", async () => {
    tryToRecognizeMutationMock.mutateAsync.mockResolvedValue({
      ...pendingPlan,
      files: [],
    })

    const { result } = renderFlow()

    act(() => {
      result.current.start()
    })

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Unable to recognize any episodes. Consider using AI to recognize instead.",
      )
    })
    expect(rejectPlanMutationMock.mutateAsync).toHaveBeenCalledWith({
      id: "plan-1",
      mediaFolderPath,
    })
    expect(result.current.open).toBe(false)
    expect(result.current.plan).toBeUndefined()
  })

  it("Start failure: toast and prompt closed", async () => {
    tryToRecognizeMutationMock.mutateAsync.mockRejectedValue(new Error("boom"))

    const { result } = renderFlow()

    act(() => {
      result.current.start()
    })

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Recognition failed. Please try again.")
    })
    expect(result.current.open).toBe(false)
    expect(result.current.plan).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/ui && pnpm exec vitest run src/hooks/tv/useRuleBasedRecognizeFlow.test.tsx`
Expected: FAIL — the old hook requires `plans`/`uiStatus`/`beforeConfirm` options and has no `start`/`confirm`/`cancel` shape matching the tests.

- [ ] **Step 3: Rewrite the hook**

Replace `apps/ui/src/hooks/tv/useRuleBasedRecognizeFlow.ts` entirely:

```ts
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"
import { useApplyPlanMutation } from "@/hooks/plans/useApplyPlanMutation"
import { useRejectPlanMutation } from "@/hooks/plans/useRejectPlanMutation"
import { useTryToRecognizeEpisodesMutation } from "@/hooks/plans/useTryToRecognizeEpisodesMutation"
import {
  isRuleBasedRecognizePlanComplete,
  isRuleBasedRecognizePlanFullyUnchanged,
} from "@/lib/isRuleBasedRecognizePlanComplete"
import { useTranslation } from "@/lib/i18n"
import type { MediaMetadata } from "@smm/types"
import type { RecognizeMediaFilePlan } from "@smm/types/RecognizeMediaFilePlan"

export interface UseRuleBasedRecognizeFlowOptions {
  mediaMetadata: MediaMetadata | undefined
}

/**
 * Rule-based recognize flow aligned with docs/dev/recognize-episodes.md:
 * try-to-recognize-episodes → apply-plan (data.files for selected episodes) / reject-plan.
 */
export function useRuleBasedRecognizeFlow({
  mediaMetadata,
}: UseRuleBasedRecognizeFlowOptions) {
  const { t } = useTranslation(["components"])

  const [open, setOpen] = useState(false)
  const [plan, setPlan] = useState<RecognizeMediaFilePlan | undefined>(undefined)

  const mediaFolderPath = mediaMetadata?.mediaFolderPath
  const rejectPlanMutation = useRejectPlanMutation()
  const applyPlanMutation = useApplyPlanMutation()
  const tryToRecognizeMutation = useTryToRecognizeEpisodesMutation()

  const loading =
    rejectPlanMutation.isPending ||
    applyPlanMutation.isPending ||
    tryToRecognizeMutation.isPending

  const recognizeFailedMessage = t("toast.recognizeFailed", {
    defaultValue: "Recognition failed. Please try again.",
  })
  const noRecognizedFilesMessage = t("toast.noRecognizedFiles", {
    defaultValue:
      "Unable to recognize any episodes. Consider using AI to recognize instead.",
  })

  const reset = useCallback(() => {
    rejectPlanMutation.reset()
    applyPlanMutation.reset()
    tryToRecognizeMutation.reset()
  }, [rejectPlanMutation, applyPlanMutation, tryToRecognizeMutation])

  const confirm = useCallback(
    async (selectedEpisodeFiles?: string[]) => {
      if (plan === undefined) {
        console.error("Plan was confirmed but the plan is undefined")
        return
      }

      if (!mediaMetadata || !mediaFolderPath) {
        console.warn("[recognize] user confirmed but media metadata missing", { plan })
        toast.error("No media metadata available")
        return
      }

      try {
        console.log("[recognize] POST /api/apply-plan", {
          id: plan.id,
          selectedCount: selectedEpisodeFiles?.length,
        })
        await applyPlanMutation.mutateAsync({
          id: plan.id,
          mediaFolderPath,
          files: selectedEpisodeFiles,
        })

        setOpen(false)
        setPlan(undefined)
        toast.success(t("toolbar.recognizeEpisodesSuccess"))
        console.log("[recognize] recognize completed successfully", { id: plan.id })
      } catch (error) {
        console.error("[recognize] unexpected error while applying recognize", { id: plan.id, error })
        toast.error(recognizeFailedMessage)
      }
    },
    [mediaFolderPath, plan, mediaMetadata, applyPlanMutation, recognizeFailedMessage, t],
  )

  const cancel = useCallback(async () => {
    if (mediaFolderPath === undefined) {
      console.error("Media folder path is undefined")
      return
    }

    setOpen(false)

    if (plan && plan.status === "pending") {
      rejectPlanMutation.mutateAsync({ id: plan.id, mediaFolderPath }) // fire and forget
    }

    setPlan(undefined)
    reset()
  }, [mediaFolderPath, rejectPlanMutation, plan, reset])

  /** Opens RuleBasedRecognizePrompt by calling try-to-recognize-episodes. */
  const start = useCallback(() => {
    if (!mediaFolderPath) {
      console.warn("[recognize] cannot start — media folder path missing")
      toast.error("No media folder path available")
      return
    }
    reset()
    setOpen(true)
    void tryToRecognizeMutation.mutateAsync({ mediaFolderPath })
      .then((resp) => {
        if (!resp.files || resp.files.length === 0) {
          console.log("[recognize] no files recognized", { mediaFolderPath })
          toast.error(noRecognizedFilesMessage)
          rejectPlanMutation.mutateAsync({ id: resp.id, mediaFolderPath }) // fire and forget
          setOpen(false)
          return
        }
        console.log("[recognize] recognize preview ready", {
          id: resp.id,
          matchedCount: resp.files.length,
        })
        setPlan(resp)
      })
      .catch((error) => {
        console.error("[recognize] failed to create recognize plan", { mediaFolderPath, error })
        toast.error(recognizeFailedMessage)
        setOpen(false)
      })
  }, [
    mediaFolderPath,
    reset,
    tryToRecognizeMutation,
    rejectPlanMutation,
    noRecognizedFilesMessage,
    recognizeFailedMessage,
  ])

  const tvShowTitle = mediaMetadata?.tvShow?.name ?? ""
  const tvShowTmdbId = parseInt(mediaMetadata?.tvShow?.id ?? "0", 10)

  const notAllEpisodesRecognized = useMemo(() => {
    if (!plan || plan.files.length === 0 || !mediaMetadata) {
      return false
    }
    return !isRuleBasedRecognizePlanComplete(plan.files, mediaMetadata)
  }, [plan, mediaMetadata])

  const allPlanFilesUnchanged = useMemo(() => {
    if (!plan || plan.files.length === 0 || !mediaMetadata) {
      return false
    }
    return isRuleBasedRecognizePlanFullyUnchanged(plan.files, mediaMetadata)
  }, [plan, mediaMetadata])

  return {
    plan,
    open,
    loading,
    tvShowTitle,
    tvShowTmdbId,
    notAllEpisodesRecognized,
    allPlanFilesUnchanged,
    confirm,
    cancel,
    start,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/ui && pnpm exec vitest run src/hooks/tv/useRuleBasedRecognizeFlow.test.tsx`
Expected: 7 PASS

- [ ] **Step 5: Verify (no commit)**

Run: `cd apps/ui && pnpm exec vitest run src/hooks/tv/useRuleBasedRecognizeFlow.test.tsx src/hooks/tv/useRuleBasedRenameFilesFlow.test.tsx`
Expected: all PASS. **Do NOT commit.** (TvShowPanel will still fail typecheck until Task 5 — expected.)

---

### Task 5: UI — TvShowPanel wiring, context slim-down, dead code

**Files:**
- Modify: `apps/ui/src/components/tv/TvShowPanel.tsx`
- Modify: `apps/ui/src/components/tv/TvShowPanelPrompts.tsx`
- Modify: `apps/ui/src/components/tv/plans/TvShowAppPlanPromptContext.tsx`
- Modify: `apps/ui/src/components/tv/TvShowPanelUtils.ts` (remove `buildTemporaryRecognitionPlanAsync` only)

**Interfaces:**
- Consumes: everything `useRuleBasedRecognizeFlow` returns (Task 4); `RuleBasedRecognizePrompt` props (`isOpen`, `isLoading`, `tvShowTitle`, `tvShowTmdbId`, `notAllEpisodesRecognized`, `allPlanFilesUnchanged`, `isConfirmButtonDisabled`, `onConfirm`, `onCancel`).
- Produces: `TvShowAppPlanPromptContextValue` with ONLY: `aiRenamePlan`, `aiRenamePromptStatus`, `aiRecognizePlan`, `aiRecognizePromptStatus`, `onAiRenameConfirm`, `onAiRenameCancel`, `onAiRecognizeConfirm`, `onAiRecognizeCancel`. The `RenameToolbarOption` export stays in the context file (still imported by `useRuleBasedRenameFilesFlow.ts:8`).

- [ ] **Step 1: Slim the context interface**

Replace the interface in `TvShowAppPlanPromptContext.tsx` with:

```tsx
export interface TvShowAppPlanPromptContextValue {
  aiRenamePlan: UIRenameFilesPlan | undefined
  aiRenamePromptStatus: "generating" | "wait-for-ack"
  aiRecognizePlan: UIRecognizeMediaFilePlan | undefined
  aiRecognizePromptStatus: "generating" | "wait-for-ack"

  onAiRenameConfirm: () => void | Promise<void>
  onAiRenameCancel: () => void | Promise<void>
  onAiRecognizeConfirm: () => void | Promise<void>
  onAiRecognizeCancel: () => void | Promise<void>
}
```

Keep `RenameToolbarOption` and the provider/hook unchanged. Remove the now-unused `UIRecognizeMediaFilePlan` import ONLY if `aiRecognizePlan` no longer references it (it does reference it — keep the import).

- [ ] **Step 2: Clean up TvShowPanelPrompts.tsx**

Delete:
- the commented-out `RuleBasedRenameFilePrompt` block (lines 82-103) and its import (line 2)
- the `RuleBasedRecognizePrompt` render block (lines 127-145) and its import (line 5)
- from the `useTvShowAppPlanPrompts()` destructure: `appRenamePlan`, `appRecognizePlan`, `renameToolbarOptions`, `selectedNamingRule`, `setSelectedNamingRule`, `onAppRenameNamingRuleSelected`, `onAppRenameConfirm`, `onAppRenameCancel`, `onAppRecognizeConfirm`, `onAppRecognizeCancel`, `tvShowTitle`, `tvShowTmdbId`, `isRuleBasedRecognizeLoading`, `notAllEpisodesRecognized`, `allPlanFilesUnchanged`, `allRenamePlanFilesUnchanged`
- the now-unused `UIRecognizeMediaFilePlan` import (line 8)

Keep: `UseNfoPrompt` block, `AiBasedRenameFilePrompt`, `AiBasedRecognizePrompt`, `useTvShowPromptsStore` usage.

- [ ] **Step 3: Wire the prompt into TvShowPanel.tsx**

Make these changes:

1. Fix the rename flow call (lines 248-254) to match the current hook signature:

```tsx
  const renameFlow = useRuleBasedRenameFilesFlow({
    mediaMetadata,
  })
```

2. Fix the recognize flow call (lines 264-269):

```tsx
  const recognizeFlow = useRuleBasedRecognizeFlow({
    mediaMetadata,
  })
```

3. Add the import (next to line 52's `RuleBasedRenameFilePrompt` import):

```tsx
import { RuleBasedRecognizePrompt } from "./RuleBasedRecognizePrompt"
```

4. Add a props memo after `ruleBasedRenameFilePromptProps` (lines 360-384), same checked-episodes → paths mapping:

```tsx
  const ruleBasedRecognizePromptProps = useMemo(() => {
    return {
      isOpen: recognizeFlow.open,
      isLoading: recognizeFlow.loading,
      tvShowTitle: recognizeFlow.tvShowTitle,
      tvShowTmdbId: recognizeFlow.tvShowTmdbId,
      notAllEpisodesRecognized: recognizeFlow.notAllEpisodesRecognized,
      allPlanFilesUnchanged: recognizeFlow.allPlanFilesUnchanged,
      isConfirmButtonDisabled: recognizeFlow.loading || recognizeFlow.allPlanFilesUnchanged,
      onConfirm: async () => {
        const episodes = mediaFileTableSeasonData.flatMap((s) => s.episodes)
        const selectedFiles = episodes
          .filter((e) =>
            selectedEpisodes.some((s) => s.season === e.season && s.episode === e.episode),
          )
          .flatMap((e) => e.path)
          .filter((path): path is string => path !== undefined)
        await recognizeFlow.confirm(selectedFiles)
      },
      onCancel: () => {
        void recognizeFlow.cancel()
      },
    }
  }, [recognizeFlow, mediaFileTableSeasonData, selectedEpisodes])
```

5. Render it next to the rename prompt (after line 392's `{<RuleBasedRenameFilePrompt {...ruleBasedRenameFilePromptProps}/>)`:

```tsx
      {
        <RuleBasedRecognizePrompt {...ruleBasedRecognizePromptProps} />
      }
```

6. Slim `appPlanPromptValue` (lines 317-344) to:

```tsx
  const appPlanPromptValue = useMemo((): TvShowAppPlanPromptContextValue => {
    return {
      aiRenamePlan: aiRenameFlow.plan,
      aiRenamePromptStatus: aiRenameFlow.promptStatus,
      aiRecognizePlan: aiRecognizeFlow.plan,
      aiRecognizePromptStatus: aiRecognizeFlow.promptStatus,
      onAiRenameConfirm: aiRenameFlow.onConfirm,
      onAiRenameCancel: aiRenameFlow.onCancel,
      onAiRecognizeConfirm: aiRecognizeFlow.onConfirm,
      onAiRecognizeCancel: aiRecognizeFlow.onCancel,
    }
  }, [renameFlow, aiRenameFlow, aiRecognizeFlow, recognizeFlow])
```

(`renameFlow`/`recognizeFlow` can be dropped from the dep array since no field references them anymore — remove them.)

7. Remove the fix-ups that existed only for the old flows: `renameFlow.cancel(plan?.id ?? '')` inside `ruleBasedRenameFilePromptProps.onCancel` becomes `() => { void renameFlow.cancel() }`; delete the unused imports flagged by typecheck (expected: `MediaFileTableEpisodeData` line 30, `RenameRuleName` line 53, `import type { string } from "zod"` line 54). Keep `recognizeBeforeConfirm` (line 161-165) — `aiRecognizeFlow` still uses it.

- [ ] **Step 4: Remove dead code from TvShowPanelUtils.ts**

Verify first, then delete:

Run: `cd apps/ui && grep -rn "buildTemporaryRecognitionPlanAsync" src/ --include="*.ts*" | grep -v TvShowPanelUtils.ts`
Expected: only the removed `useRuleBasedRecognizeFlow` reference (gone after Task 4). If any other reference remains, STOP and keep the function.

Delete `buildTemporaryRecognitionPlanAsync` from `TvShowPanelUtils.ts` (lines ~950-984) and the `recognizeEpisodesAsync` import (line 28) if it becomes unused. Do NOT delete `applyRecognizeMediaFilePlan` or `rebuildPlanWithSelectedEpisodes` (`handleAiRecognizeConfirm.ts` and `aiRecognizeFlow` use them).

- [ ] **Step 5: Verify (no commit)**

Run: `cd apps/ui && pnpm exec tsc -p tsconfig.app.json --noEmit && pnpm exec vitest run src/hooks/tv/ src/components/tv/`
Expected: typecheck clean (MoviePanel pre-existing errors from the rename refactor may remain — list them in the final report if so); all tv hook/component tests PASS. **Do NOT commit.**

---

### Task 6: Docs + full verification

**Files:**
- Modify: `docs/api/index.md`
- Modify: `docs/dev/recognize-episodes.md` (only if its Web UI section needs the selected-files note)

**Interfaces:**
- Consumes: everything from Tasks 1-5.
- Produces: documentation matching the implemented HTTP surface.

- [ ] **Step 1: Update docs/api/index.md**

Add a new section after `## CLI: try-to-recognize / try-to-rename / apply` (around line 112):

```markdown
## RecognizeEpisodes (Web UI)
Source Code: apps/cli/src/route/TryToRecognizeEpisodes.ts + apps/core Core.tryToRecognizeEpisodes
HTTP: `POST /api/try-to-recognize-episodes` — rule-based episode recognition via Layer 2 `Core.tryToRecognizeEpisodes(path)` → pending `RecognizeMediaFilePlan` persisted under `{appDataDir}/plans/`. Request body: `{ mediaFolderPath: string }`. Response: `{ data: { plan } }` or `{ error }` (HTTP 200). Apply/reject reuse `POST /api/apply-plan` / `POST /api/reject-plan`; `apply-plan` honors `data.files` for `recognize-media-file` plans (applies only the selected `plan.files[].path` entries; unknown paths → 400 ProblemDetails). Product doc: [docs/dev/recognize-episodes.md](../dev/recognize-episodes.md).
```

- [ ] **Step 2: Update docs/dev/recognize-episodes.md**

The Web UI sequence diagram already shows `POST /api/try-to-recognize-episodes` → `POST /api/apply-plan`. Add one sentence after the diagram: "The Web UI may uncheck episodes before confirming; `apply-plan` then carries `data: { files }` with the selected `plan.files[].path` entries (same selection semantics as rename UC3)." Also remove the `Browser->>User: show RuleBasedRecognizePrompt` wording only if it contradicts the final UI flow — otherwise leave the diagram untouched.

- [ ] **Step 3: Full verification**

```bash
cd apps/core && pnpm test && pnpm typecheck
cd apps/cli && pnpm test && pnpm typecheck
cd apps/ui && pnpm test
cd apps/ui && pnpm exec tsc -p tsconfig.app.json --noEmit
```

Expected: all tests PASS; core/cli typecheck clean; ui typecheck clean (or only pre-existing MoviePanel rename-refactor errors — report them, do not fix here).

- [ ] **Step 4: Stop — hand off for review**

Run `git status --short` and `git diff --stat`. Present the change summary to the user. **Do NOT commit — the user reviews and commits locally.**
