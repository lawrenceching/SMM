# AI Rename Plan — metadata.write Enforcement + Browser-side Plan Pulling

This design document describes the high level design of a feature.
The design document is golden source and referenced by one or more features.

> **Status:** Pending implementation.

> **Source spec:** uncommitted diff in `docs/dev/rename-episodes.md` (MCP Tool and AI Tool section + Browser-side Pulling section).
> **Builds on:** [AI Agent Settings — Permissions Config](./2026-09-06-ai-agent-permissions-design.md) (Phase 1: `aiAgent.permissions` config + settings UI). This feature is the enforcement follow-up that Phase 1 deferred.

## 1. Background

Phase 1 added the `aiAgent.permissions` user config (`metadata.write`) and its settings UI, but nothing reads the permission yet. AI Assistant and MCP clients that create rename-episode plans always leave the plan pending and require the user to approve it in the SMM UI — even when the user has granted `metadata.write`.

This feature implements two things:

1. **Enforcement** — when `metadata.write` is granted, core-routes AI rename-plan tools apply the plan automatically; no UI approval. When not granted (or unknown), the plan stays pending and the UI shows the confirm prompt (existing behavior).
2. **Browser-side pulling** — a backgrounded browser may miss server-pushed events, so the UI refetches pending plans at two trigger points: sidebar folder select, and browser reactivation with a folder already selected.

**Scope (locked):**

- **In scope:** auto-apply gating in the core-routes tool builder (covers **MCP tool** + **backend AI chat tool**); fallback to pending on apply failure; browser-side pulling at the two trigger points.
- **Out of scope:** the frontend AI tool (`POST /api/create-rename-episode-plan`) and the debug route — they keep the manual-approval flow; ohos auto-apply wiring (ohos has no Core instance to apply with); any permission beyond `metadata.write`.

**Decisions (locked):**

- Gating seam: tool-builder dependency injection (Approach A) — optional `getUserConfig` + `applyRenameEpisodePlan` deps on `buildCreateRenameEpisodePlanTool`. Not pipeline-level (would leak auto-apply into the frontend HTTP route) and not per-server (duplicated, message logic splits).
- Auto-apply requires **both** deps present **and** permission granted. Any missing piece → pending flow (safe default, consistent with Phase 1's `permissions: []`).
- Apply failure → **fall back to pending** (plan stays on disk, `RenameFilesPlanReady` emitted, agent message asks user to review in UI). Never a hard error to the agent, never a rejected plan.
- One spec + one plan for gating and pulling.
- Permission is checked at plan-creation time. MCP path reads config fresh per tool call; chat path uses the per-request `UserConfig` snapshot (a permission granted mid-chat-request is not retroactive within that request).

## 2. Architecture

### 2.1 Project Level

| Package / App | Change |
|---|---|
| `packages/types` | `hasAiAgentPermission()` helper; `RENAME_PLAN_AUTO_APPLIED_MESSAGE` in `planTaskMessages.ts` |
| `packages/core-routes` | `buildCreateRenameEpisodePlanTool` gains optional `extra` deps + auto-apply flow; `McpConfig.applyRenameEpisodePlan`; `ChatToolsExtraDeps.applyRenameEpisodePlan`; MCP handler wiring |
| `apps/cli` | Wire `applyRenameEpisodePlan: (plan) => getCore().applyPlan(plan)` in `buildMcpConfig()` and `handleChatRequest()` |
| `apps/ui` | `applyFolderClick` invalidates plans query; new `usePlansPullOnVisible` hook |

### 2.2 Permission helper (`packages/types/types.ts`)

```ts
export function hasAiAgentPermission(
  userConfig: UserConfig | undefined,
  permission: AiAgentPermission,
): boolean {
  return userConfig?.aiAgent?.permissions?.includes(permission) ?? false;
}
```

Undefined config, missing `aiAgent`, or empty/missing permissions → `false`.

### 2.3 Tool builder flow (`packages/core-routes/src/tools/createRenameEpisodePlan.ts`)

`buildCreateRenameEpisodePlanTool` gains an optional 6th parameter:

```ts
export interface CreateRenameEpisodePlanToolExtra {
  /** Reads current user config; used for the metadata.write permission check. */
  getUserConfig?: () => Promise<UserConfig>;
  /** Applies (renames) a created plan. Hosts without a Core instance omit it. */
  applyRenameEpisodePlan?: (plan: RenameFilesPlan) => Promise<void>;
}
```

`RenameFilesPlan` comes from `@smm/types/RenameFilesPlan`.

After the plan is created by `createRenameEpisodePlanPipeline` (unchanged), `execute` becomes:

1. If `getUserConfig` **and** `applyRenameEpisodePlan` are present → `hasAiAgentPermission(await getUserConfig(), AI_AGENT_PERMISSIONS.metadataWrite)`. If the config read rejects, treat as not granted.
2. Permission granted → `await applyRenameEpisodePlan(plan)`:
   - **Success** → emit `mediaMetadataUpdated` with `data: { folderPath: plan.mediaFolderPath }` (same event the manual apply route broadcasts; `MediaMetadataUpdatedEventData.folderPath` is optional), log at info, return `toolOk({ message: RENAME_PLAN_AUTO_APPLIED_MESSAGE, planId: plan.id })`. **Do not** emit `RenameFilesPlanReady` — nothing is pending.
   - **Failure** → log at warn, fall through to the pending flow.
3. Pending flow (unchanged): emit `RenameFilesPlanReady`, return `toolOk({ message: END_PLAN_TASK_SUCCESS_MESSAGE, planId: plan.id })`.

**New message constant** (`packages/types/ai-tools/planTaskMessages.ts`):

```ts
/**
 * Returned to the AI when the rename plan was applied automatically
 * because the user granted the `metadata.write` permission.
 */
export const RENAME_PLAN_AUTO_APPLIED_MESSAGE =
  "Rename plan applied automatically (metadata.write permission granted). No user approval needed.";
```

**Why not invalidate plans on auto-apply success:** the UI never learned about the plan (no `RenameFilesPlanReady`), so there is normally nothing to refresh. The tiny race (a plans fetch landing between create and apply, milliseconds apart) leaves a stale pending entry that the pulling triggers clean up.

### 2.4 Wiring

Both surfaces follow the existing host-injection patterns:

| Surface | `getUserConfig` | `applyRenameEpisodePlan` |
|---|---|---|
| MCP tool — `McpConfig` (packages/core-routes/src/mcp/types.ts) | already a required field | **new optional field** `applyRenameEpisodePlan?: (plan: RenameFilesPlan) => Promise<void>` |
| MCP handler — `registerCreateRenameEpisodePlanTool` (packages/core-routes/src/mcp/toolHandlers/createRenameEpisodePlan.ts) | pass `config.getUserConfig` | pass `config.applyRenameEpisodePlan` |
| Backend AI tools — `ChatToolsExtraDeps` (packages/core-routes/src/tools/index.ts) | registry's per-request snapshot: `getUserConfig: () => Promise.resolve(userConfig)` | **new optional field** `applyRenameEpisodePlan?`, passed through from `extra` |
| CLI MCP — `buildMcpConfig()` (apps/cli/src/mcp/mcp.ts) | existing | add `applyRenameEpisodePlan: (plan) => getCore().applyPlan(plan)` — same pattern as `renameEpisodeFile` etc. |
| CLI chat — `handleChatRequest()` (apps/cli/src/route/chatRoute.ts) | existing (via `doChat` → `createChatTools`) | add `applyRenameEpisodePlan: (plan) => getCore().applyPlan(plan)` to the extras object |
| ohos MCP / ohos chat | existing | **omit** — no Core instance; pending flow always, even with permission granted (documented degradation) |

`Core.applyPlan(plan)` signature (apps/core/src/Core.ts): `applyPlan(plan: Plan, data?: ApplyPlanData): Promise<void>` — full plan apply is exactly the first argument.

**Untouched surfaces:** `apps/ui/src/ai/tools/CreateRenameEpisodePlan.tsx` (frontend AI tool via `POST /api/create-rename-episode-plan`) and `POST /debug/createRenameEpisodePlan` — both call the pipeline directly, never the tool builder, so they keep the manual-approval flow by construction.

### 2.5 Browser-side pulling (apps/ui)

The AI rename prompt derives from the plans query (`usePlansQuery` → `AiBasedRenameFilePrompt` via `TvShowAppPlanPromptContext`), so pulling reduces to refetching that query at the two trigger points.

**Trigger 1 — sidebar folder select.** `applyFolderClick` in `apps/ui/src/stores/uiMediaFolderStore.ts` calls:

```ts
void queryClient.invalidateQueries({ queryKey: [PLANS_QUERY_ROOT] })
```

`queryClient` is imported from `@/lib/queryClient` (module singleton, same pattern as `useTvShowWebSocketEvents.ts`). Folder *switches* already refetch via query-key change; doing it in the store action additionally covers re-selecting the same folder.

**Trigger 2 — browser reactivates.** New hook `apps/ui/src/hooks/plans/usePlansPullOnVisible.ts`:

```ts
export function usePlansPullOnVisible() {
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (!useUIMediaFolderStore.getState().selectedFolder) return;
      void queryClient.invalidateQueries({ queryKey: [PLANS_QUERY_ROOT] });
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);
}
```

Mounted next to the existing `useTvShowWebSocketEvents()` call in the TV panel. No new event types, no server changes.

## 3. Error Handling

| Failure | Behavior |
|---|---|
| `getUserConfig()` rejects | Treat as not granted → pending flow |
| `applyRenameEpisodePlan` rejects (file locked, target exists, ...) | Warn log → pending flow (plan already on disk, stays pending) |
| Deps absent (ohos) | Pending flow, unchanged behavior |
| Permission absent/empty | Pending flow (Phase 1 default) |

The plan file written by the pipeline before the apply attempt is the pending-flow artifact; the fallback needs no cleanup — the plan is exactly what the pending flow would have produced.

## 4. Testing

| Area | Test |
|---|---|
| `hasAiAgentPermission` | packages/types: undefined config / missing aiAgent / empty / granted / other-permission-only → correct boolean |
| Tool builder (packages/core-routes, extend `createRenameEpisodePlan.test.ts`) | permission granted + applier → applies, emits `mediaMetadataUpdated`, returns `RENAME_PLAN_AUTO_APPLIED_MESSAGE`, no `RenameFilesPlanReady`; applier rejects → pending flow + `RenameFilesPlanReady`; permission missing → pending; deps absent → pending; `getUserConfig` rejects → pending |
| Pulling hook (apps/ui, jsdom) | visibilitychange to `visible` with folder selected → invalidates plans query; hidden or no folder → no invalidation |
| `applyFolderClick` (apps/ui) | invalidates plans query on folder click |
| E2E | extend `apps/e2e/test/specs/ai/AiTool-RenameTool.e2e.ts` per `docs/dev/rename-episodes.md` testing table |

## 5. References

[AI Agent Settings — Permissions Config](./2026-09-06-ai-agent-permissions-design.md)

[Rename Episodes](../../dev/rename-episodes.md)

[Manage Plan](../../dev/manage-plan.md)
