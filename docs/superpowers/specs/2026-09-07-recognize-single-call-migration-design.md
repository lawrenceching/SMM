# Recognize Single-Call Migration (createRecognizeEpisodePlan)

This design document describes the high level design of a feature.
The design document is golden source and referenced by one or more features.

> **Status:** Design approved by user (2026-09-07). Pending implementation.

> **Builds on:**
> [Create Rename Episode Plan](./2026-08-29-create-rename-episode-plan-design.md) — the rename single-call precedent this migration mirrors.
> [AI Rename Plan — metadata.write Enforcement](./2026-09-06-ai-plan-metadata-write-enforcement-design.md) — the auto-apply gating pattern reused here.

## 1. Background

AI/MCP episode recognition still uses the legacy three-step tool flow
(`begin-recognize-task` → `add-recognized-media-file` ×N → `end-recognize-task`),
while rename already migrated to a single `create-rename-episode-plan` call
(2026-08-29; the recognize tools were explicitly out of scope there).

The three-step flow costs N+2 agent round-trips, keeps a `preparing` plan
status alive (surfaced by the UI as a "generating" prompt state), and maintains
three tool implementations plus an in-memory draft store across the frontend
chat, MCP (cli), and MCP (ohos) surfaces.

This migration replaces the three-step flow with one
`create-recognize-episode-plan` call per surface, mirrors the rename
enforcement (`metadata.write` auto-apply), and — once no producer of
`preparing` AI plans remains — deletes the UI `promptStatus` machinery that
only existed to service the `preparing` window.

**Goals (all confirmed by user):**

1. One tool call per recognition task (agent passes all `file → season/episode`
   mappings at once).
2. Architecture cleanup: delete the three-step tools and the draft store.
3. `metadata.write` auto-apply, same gating semantics as rename.
4. UI simplification: remove `promptStatus` from both AI episode flow hooks and
   the generating branches from the AI prompt components.

## 2. Architecture

### 2.1 Project Level

| Package / App | Change |
|---|---|
| `apps/core` | New `pipeline/createRecognizeEpisodePlan.ts` (pure pipeline, mirrors `createRenameEpisodePlan`) |
| `packages/types` | New `ai-tools/createRecognizeEpisodePlan.ts` schema; delete `ai-tools/recognizeMediaFileTask.ts`; add `RECOGNIZE_PLAN_AUTO_APPLIED_MESSAGE` in `ai-tools/planTaskMessages.ts` |
| `packages/core-routes` | New tool builder `tools/createRecognizeEpisodePlan.ts` + MCP handler; HTTP route `POST /api/create-recognize-episode-plan`; delete `tools/recognizeMediaFilesTask.ts`, the three MCP handlers, and the recognize-specific helpers in `tools/plans.ts`; `McpConfig` gains optional `applyRecognizeEpisodePlan` |
| `apps/cli` | Wire `applyRecognizeEpisodePlan: (plan) => getCore().applyPlan(plan)` in `buildMcpConfig()` and the chat extras (same two places as rename) |
| `apps/ui` | New `ai/tools/CreateRecognizeEpisodePlan.tsx`; delete the three step tools and the plan-draft store; remove `promptStatus` / generating branches / `cleanup*Plan` draft calls |

### 2.2 App Level

#### Core pipeline

```ts
// apps/core/src/pipeline/createRecognizeEpisodePlan.ts
export interface CreateRecognizeEpisodePlanOptions {
  creator?: "app" | "ai";
  id?: string;
}

export interface CreateRecognizeEpisodePlanDeps {
  fs: FsPort;
  appDataDir: string;
  normalizePosix: (path: string) => string;
  createId?: () => string;
}

export async function createRecognizeEpisodePlanPipeline(
  mediaFolderPath: string,
  files: Array<{ season: number; episode: number; path: string }>,
  options: CreateRecognizeEpisodePlanOptions | undefined,
  deps: CreateRecognizeEpisodePlanDeps,
): Promise<RecognizeMediaFilePlan>
```

Validation order:

1. `files` non-empty (else throw `No recognize entries in task`).
2. Normalize every `path` via `deps.normalizePosix`.
3. Batch dedup: the same normalized `path` twice, or the same
   `(season, episode)` pair twice → throw.
4. Per-entry existence via `deps.fs.exists(...)` → throw with the existing
   message shape (`File "…" (S#E#) does not exist in the media folder`).
5. Persist via `writePlan(deps.fs, deps.appDataDir, plan)` with
   `status: "pending"`, `creator: options.creator ?? "app"`.

Deliberately NOT validated: whether `season/episode` exists in media metadata.
Recognize exists to let the AI build that mapping; the user gives the final
verdict in the confirm prompt (same semantics as today's `add` step, which
only checks file existence).

#### Tool builder (core-routes)

```ts
// packages/core-routes/src/tools/createRecognizeEpisodePlan.ts
export interface CreateRecognizeEpisodePlanToolExtra {
  getUserConfig?: () => Promise<UserConfig>;
  applyRecognizeEpisodePlan?: (plan: RecognizeMediaFilePlan) => Promise<void>;
}
```

`execute` (mirrors the rename tool):

1. Call the pipeline → pending plan on disk.
2. If **both** extra deps are present **and**
   `hasAiAgentPermission(await getUserConfig(), AI_AGENT_PERMISSIONS.metadataWrite)`
   (config read failure counts as not granted): call
   `applyRecognizeEpisodePlan(plan)`.
   - Success → emit `mediaMetadataUpdated` with `{ folderPath: plan.mediaFolderPath }`,
     return `toolOk({ message: RECOGNIZE_PLAN_AUTO_APPLIED_MESSAGE, planId })`.
     **No** `RecognizeMediaFilePlanReady` — nothing is pending.
   - Failure → warn log, fall through to the pending flow.
3. Pending flow → emit `RecognizeMediaFilePlanReady { taskId, planFilePath }`,
   return `toolOk({ message: END_PLAN_TASK_SUCCESS_MESSAGE, taskId })`.

#### HTTP route

`POST /api/create-recognize-episode-plan` (core-routes routes + cli mount),
calling the pipeline directly — the manual-approval flow by construction, no
gating (same rule as the rename frontend/debug surfaces). Documented in
`docs/api/index.md`.

#### MCP + chat wiring

| Surface | `applyRecognizeEpisodePlan` |
|---|---|
| `McpConfig` (core-routes `mcp/types.ts`) | new optional field |
| cli `buildMcpConfig()` | `(plan) => getCore().applyPlan(plan)` |
| cli chat extras | `(plan) => getCore().applyPlan(plan)` |
| ohos MCP | omit — no Core instance; always pending flow (documented degradation, identical to rename) |

`Core.applyPlan(plan)` already handles `recognize-media-file`
(merge `mediaFiles` → `setMetadata` → delete plan file).

#### Frontend chat tool

`apps/ui/src/ai/tools/CreateRecognizeEpisodePlan.tsx` — single call to
`POST /api/create-recognize-episode-plan`, then invalidate the plans query and
return `END_PLAN_TASK_SUCCESS_MESSAGE` + `taskId` (byte-for-byte the pattern of
`CreateRenameEpisodePlan.tsx`).

### 2.3 Key Design

* **`preparing` loses its last producer.** After this migration no code path
  creates an `ai` recognize plan in `preparing`. The status value itself stays
  in `PlanStatus` (plan files from older sessions may still carry it);
  `cleanPreparingPlans` remains the startup janitor for those leftovers.
* **`selectActiveAiPlan` tightens to `pending` only.** With no producer,
  matching `preparing` would only resurface stale files that the janitor is
  about to delete. `selectActiveAppPlan` is untouched (rule-based plans are
  born `pending` anyway).
* **`promptStatus` is deleted, not hardcoded.** Both AI episode flow hooks stop
  returning it; `promptProps` carries only `isOpen/onConfirm/onCancel`. The AI
  prompt components lose the `status` prop, the generating branch, the spinner,
  and the confirm-disable-during-generating logic. Locale keys
  `toolbar.aiGenerating` / `toolbar.aiRecognizing` are removed from all four
  languages (`aiReview` / `aiReviewEpisodes` stay).
* **Draft store dies with the flow.** `aiPlanDrafts` / `recognizePlanService` /
  `cleanupRenamePlan` / `cleanupRecognizePlan` exist only to service
  accumulate-between-steps semantics. The flow hooks' `confirm`/`cancel` drop
  their `cleanup*Plan` calls; `useCreatePlanMutation` (dead optimistic-create
  export from the same era) is removed as well.
* **Single write, single validation pass.** Unlike the three-step flow (N
  `updatePlan` writes + per-entry checks), the whole batch is validated once
  and the plan is written once, already `pending`.

## 3. Deletion List

| Location | Item |
|---|---|
| `packages/types` | `ai-tools/recognizeMediaFileTask.ts` |
| `packages/core-routes` | `tools/recognizeMediaFilesTask.ts`; MCP handlers `beginRecognizeTask.ts` / `addRecognizedFile.ts` / `endRecognizeTask.ts`; `tools/plans.ts`: `beginRecognizePlan`, `appendRecognizedFile`, `defaultValidateRecognizedFiles` (+ `RecognizePlanAppendDeps`) |
| `packages/core-routes` (kept) | `updatePlanContent`, `cancelPlan`, `cleanPreparingPlans`, `readPlanById`, `readRenamePlan`, `plansApi` |
| `apps/ui` | `ai/tools/BeginRecognizeTask.tsx`, `AddRecognizedMediaFile.tsx`, `EndRecognizeTask.tsx`; `ai/plan/aiPlanDrafts.ts`, `recognizePlanService.ts`, `cleanupRenamePlan.ts`; `hooks/plans/useCreatePlanMutation.ts` |

## 4. Error Handling

| Failure | Behavior |
|---|---|
| Pipeline validation fails (empty / dup / missing file) | Tool returns error to the agent; no plan is written; agent can correct and retry |
| `getUserConfig()` rejects | Treated as not granted → pending flow |
| `applyRecognizeEpisodePlan` rejects (locked file, etc.) | Warn log → pending flow (plan already on disk); never a hard error to the agent |
| Deps absent (ohos) | Always pending flow |
| Permission absent/empty | Pending flow |

## 5. Testing

| Area | Test |
|---|---|
| `apps/core` pipeline | empty files → throw; duplicate path / duplicate (season, episode) → throw; missing file → throw; happy path writes `pending` plan with normalized paths |
| core-routes tool builder | granted + applier → applies, emits `mediaMetadataUpdated`, returns auto-applied message, no PlanReady; applier rejects → pending flow + PlanReady; permission missing → pending; deps absent → pending; `getUserConfig` rejects → pending |
| core-routes `plans.test.ts` | rework: fixtures that used `beginRecognizePlan` build `preparing` plans via `writePlan` directly; delete `appendRecognizedFile` tests |
| `apps/cli` | `applyRecognizeEpisodePlan` wired in both MCP config and chat extras |
| `apps/ui` | flow hook tests: drop `promptStatus`/cleanup assertions; `selectActiveAppPlan.test`: `preparing` no longer surfaces for AI; locale files: key parity after `aiGenerating`/`aiRecognizing` removal |
| e2e (follow-up round) | rewrite `MCP RecognizeTaskFlow` and `AiTool-RecognizeTool` specs to the single-call tool |

## 6. References

* [Create Rename Episode Plan](./2026-08-29-create-rename-episode-plan-design.md)
* [AI Rename Plan — metadata.write Enforcement + Browser-side Plan Pulling](./2026-09-06-ai-plan-metadata-write-enforcement-design.md)
* [Recognize Episodes](../../dev/recognize-episodes.md)
* [Manage Plan](../../dev/manage-plan.md)
