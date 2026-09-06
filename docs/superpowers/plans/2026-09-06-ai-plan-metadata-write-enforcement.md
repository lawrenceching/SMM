# AI Rename Plan metadata.write Enforcement + Plan Pulling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the user grants `aiAgent.permissions: ["metadata.write"]`, the core-routes AI rename-plan tools (MCP tool + backend AI chat tool) apply the plan automatically; otherwise — and on any failure — the plan stays pending for UI approval. The UI also refetches pending plans at two trigger points (sidebar folder select, browser reactivation).

**Architecture:** Permission check + apply runner are injected as optional deps into `buildCreateRenameEpisodePlanTool` (packages/core-routes); hosts with a Core instance (CLI) wire `getCore().applyPlan`, ohos omits it and keeps the pending flow. Pulling reuses the plans TanStack query: invalidate `PLANS_QUERY_ROOT` in the sidebar store action and from a new `visibilitychange` hook mounted in `useAiBasedRenameFilesFlow`.

**Tech Stack:** TypeScript, vitest (node + jsdom), React 18 + TanStack Query + zustand, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-06-ai-plan-metadata-write-enforcement-design.md`

**Environment notes:**
- Windows + bash shell. Run tests per package: `cd packages/types && pnpm test`, `cd packages/core-routes && pnpm test`, `cd apps/ui && pnpm test <path>`.
- **The working tree contains the user's unrelated uncommitted changes** (`apps/ui/src/components/tv/TvShowPanel.tsx` modified, `docs/dev/rename-episodes.md` modified, `docs/dev/user-config.md` untracked). NEVER stage, revert, or commit those files. Only `git add` the exact files listed in each commit step.
- Out of plan scope: extending `apps/e2e/test/specs/ai/AiTool-RenameTool.e2e.ts` (needs a running CLI stack + AI provider; flagged to the user at the end).

---

### Task 1: `hasAiAgentPermission` helper

**Files:**
- Modify: `packages/types/types.ts` (insert after the `AiAgentConfig` interface, ~line 67, before the `UserConfig` interface)
- Test: `packages/types/hasAiAgentPermission.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/types/hasAiAgentPermission.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  AI_AGENT_PERMISSIONS,
  hasAiAgentPermission,
  type UserConfig,
} from "./types";

function configWith(permissions: string[] | undefined): UserConfig {
  return { aiAgent: { permissions } } as unknown as UserConfig;
}

describe("hasAiAgentPermission", () => {
  it("returns false for undefined config", () => {
    expect(
      hasAiAgentPermission(undefined, AI_AGENT_PERMISSIONS.metadataWrite),
    ).toBe(false);
  });

  it("returns false when aiAgent is missing", () => {
    expect(
      hasAiAgentPermission({} as UserConfig, AI_AGENT_PERMISSIONS.metadataWrite),
    ).toBe(false);
  });

  it("returns false when permissions are missing", () => {
    expect(
      hasAiAgentPermission(
        configWith(undefined),
        AI_AGENT_PERMISSIONS.metadataWrite,
      ),
    ).toBe(false);
  });

  it("returns false when permissions are empty", () => {
    expect(
      hasAiAgentPermission(
        configWith([]),
        AI_AGENT_PERMISSIONS.metadataWrite,
      ),
    ).toBe(false);
  });

  it("returns true when the permission is granted", () => {
    expect(
      hasAiAgentPermission(
        configWith([AI_AGENT_PERMISSIONS.metadataWrite]),
        AI_AGENT_PERMISSIONS.metadataWrite,
      ),
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/types && pnpm test hasAiAgentPermission.test.ts`
Expected: FAIL — `hasAiAgentPermission` is not exported by `./types`.

- [ ] **Step 3: Implement the helper**

In `packages/types/types.ts`, insert immediately after the closing brace of `export interface AiAgentConfig { ... }` (the block containing `permissions?: AiAgentPermission[]`, ending near line 67), before the `UserConfig` interface:

```ts
/**
 * Whether the user config grants the given AI Agent permission.
 * Missing config or permissions means nothing is granted.
 */
export function hasAiAgentPermission(
  userConfig: UserConfig | undefined,
  permission: AiAgentPermission,
): boolean {
  return userConfig?.aiAgent?.permissions?.includes(permission) ?? false;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/types && pnpm test hasAiAgentPermission.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/types/types.ts packages/types/hasAiAgentPermission.test.ts
git commit -m "feat(types): add hasAiAgentPermission helper"
```

---

### Task 2: Auto-apply message constant + tool builder flow

**Files:**
- Modify: `packages/types/ai-tools/planTaskMessages.ts` (append constant)
- Modify: `packages/core-routes/src/tools/createRenameEpisodePlan.ts` (imports, `CreateRenameEpisodePlanToolExtra`, 6th param, execute flow)
- Test: `packages/core-routes/src/tools/createRenameEpisodePlan.test.ts` (extend)

- [ ] **Step 1: Write the failing tests**

In `packages/core-routes/src/tools/createRenameEpisodePlan.test.ts`, extend the imports at the top and add a new `describe` block inside the top-level `describe` (after the existing `"prefers injected broadcast over defaultBroadcast"` test, before its closing `});`):

```ts
import { AI_AGENT_PERMISSIONS, type UserConfig } from "@smm/types";
import {
  END_PLAN_TASK_SUCCESS_MESSAGE,
  RENAME_PLAN_AUTO_APPLIED_MESSAGE,
} from "@smm/types/ai-tools/planTaskMessages";
import {
  MEDIA_METADATA_UPDATED_EVENT,
  RenameFilesPlanReady,
} from "@smm/types/event-types";
```

(`END_PLAN_TASK_SUCCESS_MESSAGE` and `RenameFilesPlanReady` are already imported — merge, don't duplicate.)

```ts
  describe("auto-apply (metadata.write)", () => {
    const folder = "/media/show";
    const args = {
      mediaFolderPath: folder,
      files: [
        {
          from: `${folder}/S01E01.mkv`,
          to: `${folder}/Show - S01E01.mkv`,
        },
      ],
    };

    function grantedConfig(): UserConfig {
      return {
        aiAgent: { permissions: [AI_AGENT_PERMISSIONS.metadataWrite] },
      } as unknown as UserConfig;
    }

    function expectPendingPlanId(result: unknown): { planId: string } {
      if (!("planId" in result)) {
        throw new Error((result as { error: string }).error);
      }
      return result as { planId: string };
    }

    it("applies the plan and reports auto-apply when permission is granted", async () => {
      const broadcast = vi.fn();
      const applyRenameEpisodePlan = vi.fn(async () => {});
      const tool = buildCreateRenameEpisodePlanTool(
        "/app-data",
        createMockFs(folder),
        broadcast,
        undefined,
        undefined,
        {
          getUserConfig: async () => grantedConfig(),
          applyRenameEpisodePlan,
        },
      );

      const result = expectPendingPlanId(await tool.execute(args));

      expect(result.planId).toEqual(expect.any(String));
      expect(applyRenameEpisodePlan).toHaveBeenCalledTimes(1);
      expect(broadcast).toHaveBeenCalledWith({
        event: MEDIA_METADATA_UPDATED_EVENT,
        data: { folderPath: folder },
      });
      expect(broadcast).not.toHaveBeenCalledWith(
        expect.objectContaining({ event: RenameFilesPlanReady.event }),
      );
    });

    it("falls back to a pending plan when the apply runner fails", async () => {
      const broadcast = vi.fn();
      const tool = buildCreateRenameEpisodePlanTool(
        "/app-data",
        createMockFs(folder),
        broadcast,
        undefined,
        undefined,
        {
          getUserConfig: async () => grantedConfig(),
          applyRenameEpisodePlan: vi.fn(async () => {
            throw new Error("EBUSY: resource busy");
          }),
        },
      );

      const result = expectPendingPlanId(await tool.execute(args));

      expect(result.planId).toEqual(expect.any(String));
      expect(broadcast).toHaveBeenCalledWith({
        event: RenameFilesPlanReady.event,
        data: {
          taskId: result.planId,
          planFilePath: `/app-data/plans/${result.planId}.plan.json`,
        },
      });
    });

    it("keeps the plan pending when the permission is not granted", async () => {
      const broadcast = vi.fn();
      const applyRenameEpisodePlan = vi.fn(async () => {});
      const tool = buildCreateRenameEpisodePlanTool(
        "/app-data",
        createMockFs(folder),
        broadcast,
        undefined,
        undefined,
        {
          getUserConfig: async () =>
            ({ aiAgent: { permissions: [] } }) as unknown as UserConfig,
          applyRenameEpisodePlan,
        },
      );

      const result = expectPendingPlanId(await tool.execute(args));

      expect(result.planId).toEqual(expect.any(String));
      expect(applyRenameEpisodePlan).not.toHaveBeenCalled();
      expect(broadcast).toHaveBeenCalledWith(
        expect.objectContaining({ event: RenameFilesPlanReady.event }),
      );
    });

    it("keeps the plan pending when reading user config fails", async () => {
      const broadcast = vi.fn();
      const applyRenameEpisodePlan = vi.fn(async () => {});
      const tool = buildCreateRenameEpisodePlanTool(
        "/app-data",
        createMockFs(folder),
        broadcast,
        undefined,
        undefined,
        {
          getUserConfig: async () => {
            throw new Error("config read failed");
          },
          applyRenameEpisodePlan,
        },
      );

      const result = expectPendingPlanId(await tool.execute(args));

      expect(result.planId).toEqual(expect.any(String));
      expect(applyRenameEpisodePlan).not.toHaveBeenCalled();
      expect(broadcast).toHaveBeenCalledWith(
        expect.objectContaining({ event: RenameFilesPlanReady.event }),
      );
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/core-routes && pnpm test createRenameEpisodePlan.test.ts`
Expected: FAIL — `RENAME_PLAN_AUTO_APPLIED_MESSAGE` is not exported; the 6th argument is a TS error / auto-apply expectations fail.

- [ ] **Step 3: Add the message constant**

In `packages/types/ai-tools/planTaskMessages.ts`, append at the end:

```ts
/**
 * Returned to the AI when the rename plan was applied automatically
 * because the user granted the `metadata.write` permission.
 */
export const RENAME_PLAN_AUTO_APPLIED_MESSAGE =
  "Rename plan applied automatically (metadata.write permission granted). No user approval needed.";
```

- [ ] **Step 4: Implement the tool builder flow**

In `packages/core-routes/src/tools/createRenameEpisodePlan.ts`:

(a) Update imports — add `hasAiAgentPermission` / `AI_AGENT_PERMISSIONS` / `UserConfig` / `RenameFilesPlan` / `MEDIA_METADATA_UPDATED_EVENT` / `RENAME_PLAN_AUTO_APPLIED_MESSAGE` (merge with existing import statements):

```ts
import {
  AI_AGENT_PERMISSIONS,
  hasAiAgentPermission,
  type UserConfig,
} from "@smm/types";
import type { RenameFilesPlan } from "@smm/types/RenameFilesPlan";
import { END_PLAN_TASK_SUCCESS_MESSAGE, RENAME_PLAN_AUTO_APPLIED_MESSAGE } from "@smm/types/ai-tools/planTaskMessages";
import {
  MEDIA_METADATA_UPDATED_EVENT,
  RenameFilesPlanReady,
  type RenameFilesPlanReadyRequestData,
} from "@smm/types/event-types";
```

(b) Add the extra-deps interface (above `buildCreateRenameEpisodePlanTool`):

```ts
/**
 * Optional dependencies for the `metadata.write` auto-apply flow.
 * Auto-apply requires BOTH deps: without `getUserConfig` the tool
 * cannot verify the permission; without `applyRenameEpisodePlan`
 * (hosts without a Core instance, e.g. ohos) it cannot apply.
 */
export interface CreateRenameEpisodePlanToolExtra {
  /** Reads the current user config for the metadata.write permission check. */
  getUserConfig?: () => Promise<UserConfig>;
  /** Applies (renames) a created plan. Host Core runner, e.g. `Core.applyPlan`. */
  applyRenameEpisodePlan?: (plan: RenameFilesPlan) => Promise<void>;
}
```

(c) Add the 6th parameter and restructure `execute`. The section after the pipeline call changes from emit-pending-return to:

```ts
export function buildCreateRenameEpisodePlanTool(
  appDataDir: string,
  fs: ChatFs,
  broadcast?: (message: WebSocketMessage) => void,
  logger?: CoreRoutesLogger,
  abortSignal?: AbortSignal,
  extra?: CreateRenameEpisodePlanToolExtra,
) {
```

and inside `execute`, replace everything after the `const plan = await createRenameEpisodePlanPipeline(...)` statement with:

```ts
        if (extra?.getUserConfig && extra.applyRenameEpisodePlan) {
          try {
            const userConfig = await extra.getUserConfig();
            if (
              hasAiAgentPermission(
                userConfig,
                AI_AGENT_PERMISSIONS.metadataWrite,
              )
            ) {
              await extra.applyRenameEpisodePlan(plan);
              emit({
                event: MEDIA_METADATA_UPDATED_EVENT,
                data: { folderPath: plan.mediaFolderPath },
              });
              logger?.info(
                {
                  planId: plan.id,
                  folderPath: plan.mediaFolderPath,
                  fileCount: plan.files.length,
                },
                `[tool][${CREATE_RENAME_EPISODE_PLAN}] Plan applied automatically`,
              );
              return toolOk({
                message: RENAME_PLAN_AUTO_APPLIED_MESSAGE,
                planId: plan.id,
              });
            }
          } catch (error) {
            logger?.warn(
              { planId: plan.id, error },
              `[tool][${CREATE_RENAME_EPISODE_PLAN}] Auto-apply failed, plan stays pending`,
            );
          }
        }

        const data: RenameFilesPlanReadyRequestData = {
          taskId: plan.id,
          planFilePath: planPath(appDataDir, plan.id),
        };
        emit({ event: RenameFilesPlanReady.event, data });
        logger?.info(
          {
            planId: plan.id,
            folderPath: plan.mediaFolderPath,
            fileCount: plan.files.length,
          },
          `[tool][${CREATE_RENAME_EPISODE_PLAN}] Plan created`,
        );

        return toolOk({
          message: END_PLAN_TASK_SUCCESS_MESSAGE,
          planId: plan.id,
        });
```

The pending flow (emit + log + return) keeps its existing code verbatim — only the auto-apply block is inserted above it. The outer `try`/`catch → formatToolError` stays as-is.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/core-routes && pnpm test createRenameEpisodePlan.test.ts`
Expected: PASS (2 existing + 4 new tests).

- [ ] **Step 6: Commit**

```bash
git add packages/types/ai-tools/planTaskMessages.ts packages/core-routes/src/tools/createRenameEpisodePlan.ts packages/core-routes/src/tools/createRenameEpisodePlan.test.ts
git commit -m "feat(core-routes): auto-apply ai rename plans when metadata.write granted"
```

---

### Task 3: Wiring — MCP config, MCP handler, chat tools registry, CLI

**Files:**
- Modify: `packages/core-routes/src/mcp/types.ts` (new optional `McpConfig` field)
- Modify: `packages/core-routes/src/mcp/toolHandlers/createRenameEpisodePlan.ts` (pass extra)
- Modify: `packages/core-routes/src/tools/index.ts` (`ChatToolsExtraDeps` field + registry pass-through)
- Modify: `apps/cli/src/mcp/mcp.ts` (`buildMcpConfig` applier)
- Modify: `apps/cli/src/route/chatRoute.ts` (`doChat` extras applier)

No unit tests — pure wiring, verified by typecheck (Task 2's builder tests cover the behavior).

- [ ] **Step 1: Add `applyRenameEpisodePlan` to `McpConfig`**

In `packages/core-routes/src/mcp/types.ts`, add to the imports at the top:

```ts
import type { RenameFilesPlan } from "@smm/types/RenameFilesPlan";
```

Then insert after the `renameEpisodeFile?` field (the one returning `{ succeeded; failed }`):

```ts
  /**
   * Optional runner for `create-rename-episode-plan` auto-apply.
   * Hosts that expose Core (e.g. Bun cli) inject `Core.applyPlan`.
   * When omitted (e.g. ohos has no Core instance), AI rename plans
   * always stay pending for user approval, even when the user granted
   * the `metadata.write` permission.
   */
  applyRenameEpisodePlan?: (plan: RenameFilesPlan) => Promise<void>;
```

- [ ] **Step 2: Pass the extra deps from the MCP handler**

In `packages/core-routes/src/mcp/toolHandlers/createRenameEpisodePlan.ts`, change the `buildCreateRenameEpisodePlanTool` call to:

```ts
  const tool = buildCreateRenameEpisodePlanTool(
    config.appDataDir,
    config.fs ?? defaultChatFs(),
    config.broadcast,
    config.logger,
    undefined,
    {
      getUserConfig: config.getUserConfig,
      applyRenameEpisodePlan: config.applyRenameEpisodePlan,
    },
  );
```

- [ ] **Step 3: Add the field to `ChatToolsExtraDeps` and pass it in the registry**

In `packages/core-routes/src/tools/index.ts`:

(a) Add to the imports:

```ts
import type { RenameFilesPlan } from "@smm/types/RenameFilesPlan";
```

(b) In `export interface ChatToolsExtraDeps`, add:

```ts
  /** Host Core runner for applying AI rename plans (Bun cli / Electron). */
  applyRenameEpisodePlan?: (plan: RenameFilesPlan) => Promise<void>;
```

(c) In `createChatTools`, change the `CREATE_RENAME_EPISODE_PLAN` entry to:

```ts
    [CREATE_RENAME_EPISODE_PLAN]: buildCreateRenameEpisodePlanTool(
      config.appDataDir,
      fs,
      broadcast,
      logger,
      abortSignal,
      {
        getUserConfig: () => Promise.resolve(userConfig),
        applyRenameEpisodePlan: extra?.applyRenameEpisodePlan,
      },
    ),
```

- [ ] **Step 4: Wire the CLI MCP server**

In `apps/cli/src/mcp/mcp.ts`, inside `buildMcpConfig()`'s returned object, add after the `renameEpisodeFile:` line:

```ts
    applyRenameEpisodePlan: (plan) => getCore().applyPlan(plan),
```

- [ ] **Step 5: Wire the CLI chat route**

In `apps/cli/src/route/chatRoute.ts`, inside the `doChat(chatConfig, c.req.raw, { ... })` extras object, add after the `renameEpisodeFile:` line:

```ts
        applyRenameEpisodePlan: (plan) => getCore().applyPlan(plan),
```

- [ ] **Step 6: Typecheck**

Run: `cd packages/core-routes && pnpm typecheck && cd ../../apps/cli && pnpm typecheck`
Expected: both exit 0. (`Plan = RecognizeMediaFilePlan | RenameFilesPlan` makes `getCore().applyPlan(plan)` accept the narrower `RenameFilesPlan` argument.)

- [ ] **Step 7: Commit**

```bash
git add packages/core-routes/src/mcp/types.ts packages/core-routes/src/mcp/toolHandlers/createRenameEpisodePlan.ts packages/core-routes/src/tools/index.ts apps/cli/src/mcp/mcp.ts apps/cli/src/route/chatRoute.ts
git commit -m "feat: wire applyRenameEpisodePlan into mcp and chat tools"
```

---

### Task 4: Pulling trigger 1 — sidebar folder select

**Files:**
- Modify: `apps/ui/src/stores/uiMediaFolderStore.ts` (imports + one line in `applyFolderClick`)
- Test: `apps/ui/src/stores/uiMediaFolderStore.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `apps/ui/src/stores/uiMediaFolderStore.test.ts`:

```ts
/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";

const invalidateQueries = vi.fn();
vi.mock("@/lib/queryClient", () => ({
  queryClient: {
    invalidateQueries: (...args: unknown[]) => invalidateQueries(...args),
  },
}));

import { useUIMediaFolderStore } from "./uiMediaFolderStore";
import { PLANS_QUERY_ROOT } from "@/hooks/plans/plansQueryKeys";

describe("uiMediaFolderStore.applyFolderClick pulls pending plans", () => {
  beforeEach(() => {
    invalidateQueries.mockClear();
    useUIMediaFolderStore.setState({
      folders: [],
      selectedFolder: "",
      selectedFolders: [],
    });
  });

  it("invalidates the plans query on single click", () => {
    useUIMediaFolderStore.getState().applyFolderClick("/media/show", false);

    expect(useUIMediaFolderStore.getState().selectedFolder).toBe("/media/show");
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [PLANS_QUERY_ROOT],
    });
  });

  it("invalidates the plans query when re-selecting the same folder", () => {
    useUIMediaFolderStore.setState({
      selectedFolder: "/media/show",
      selectedFolders: ["/media/show"],
    });

    useUIMediaFolderStore.getState().applyFolderClick("/media/show", false);

    expect(invalidateQueries).toHaveBeenCalledTimes(1);
  });

  it("invalidates the plans query on multi-select click too", () => {
    useUIMediaFolderStore.getState().applyFolderClick("/media/show", true);

    expect(invalidateQueries).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/ui && pnpm test src/stores/uiMediaFolderStore.test.ts`
Expected: FAIL — `invalidateQueries` never called.

- [ ] **Step 3: Implement**

In `apps/ui/src/stores/uiMediaFolderStore.ts`, add to the imports:

```ts
import { queryClient } from "@/lib/queryClient"
import { PLANS_QUERY_ROOT } from "@/hooks/plans/plansQueryKeys"
```

(Import from `plansQueryKeys` directly, not the `@/hooks/plans` barrel — the barrel pulls in query hooks and the API client, which would create a heavy import cycle from a zustand store module.)

Then add one line as the first statement inside `applyFolderClick`'s `set((state) => { ... })` callback, right after the `console.log`:

```ts
  applyFolderClick: (rawPath, multi) =>
    set((state) => {
      const path = rawPath
      console.log(`[sidebar] folder click path=${path} multi=${multi}`)
      // Browser-side pulling: folder select refetches pending plans
      // (e.g. AI plans created while the browser was backgrounded).
      void queryClient.invalidateQueries({ queryKey: [PLANS_QUERY_ROOT] })
      if (!multi) {
        return { selectedFolder: path, selectedFolders: [path] }
      }
      const next = new Set(state.selectedFolders)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return {
        selectedFolder: path,
        selectedFolders: [...next],
      }
    }),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/ui && pnpm test src/stores/uiMediaFolderStore.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/ui/src/stores/uiMediaFolderStore.ts apps/ui/src/stores/uiMediaFolderStore.test.ts
git commit -m "feat(ui): pull pending plans on sidebar folder select"
```

---

### Task 5: Pulling trigger 2 — `usePlansPullOnVisible` hook

**Files:**
- Create: `apps/ui/src/hooks/plans/usePlansPullOnVisible.ts`
- Modify: `apps/ui/src/hooks/plans/index.ts` (export)
- Modify: `apps/ui/src/hooks/tv/useAiBasedRenameFilesFlow.ts` (mount)
- Test: `apps/ui/src/hooks/plans/usePlansPullOnVisible.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `apps/ui/src/hooks/plans/usePlansPullOnVisible.test.ts`:

```ts
/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

const invalidateQueries = vi.fn();
vi.mock("@/lib/queryClient", () => ({
  queryClient: {
    invalidateQueries: (...args: unknown[]) => invalidateQueries(...args),
  },
}));

import { usePlansPullOnVisible } from "./usePlansPullOnVisible";
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore";
import { PLANS_QUERY_ROOT } from "./plansQueryKeys";

function fireVisibilityChange(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    value: state,
    configurable: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("usePlansPullOnVisible", () => {
  beforeEach(() => {
    invalidateQueries.mockClear();
    useUIMediaFolderStore.setState({
      selectedFolder: "/media/show",
      selectedFolders: ["/media/show"],
    });
  });

  afterEach(() => {
    fireVisibilityChange("visible");
  });

  it("invalidates the plans query when the browser becomes visible", () => {
    renderHook(() => usePlansPullOnVisible());

    fireVisibilityChange("visible");

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [PLANS_QUERY_ROOT],
    });
  });

  it("does not invalidate when the browser becomes hidden", () => {
    renderHook(() => usePlansPullOnVisible());

    fireVisibilityChange("hidden");

    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it("does not invalidate when no folder is selected", () => {
    useUIMediaFolderStore.setState({ selectedFolder: "", selectedFolders: [] });

    renderHook(() => usePlansPullOnVisible());

    fireVisibilityChange("visible");

    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it("removes the listener on unmount", () => {
    const { unmount } = renderHook(() => usePlansPullOnVisible());
    unmount();

    fireVisibilityChange("visible");

    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/ui && pnpm test src/hooks/plans/usePlansPullOnVisible.test.ts`
Expected: FAIL — `./usePlansPullOnVisible` does not exist (import error).

- [ ] **Step 3: Implement the hook**

Create `apps/ui/src/hooks/plans/usePlansPullOnVisible.ts`:

```ts
import { useEffect } from "react"
import { queryClient } from "@/lib/queryClient"
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore"
import { PLANS_QUERY_ROOT } from "./plansQueryKeys"

/**
 * Browser-side pulling: a backgrounded browser may pause its JS and
 * miss server-pushed events, so refetch pending plans when the
 * browser becomes visible and a media folder is already selected.
 */
export function usePlansPullOnVisible() {
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return
      if (!useUIMediaFolderStore.getState().selectedFolder) return
      void queryClient.invalidateQueries({ queryKey: [PLANS_QUERY_ROOT] })
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange)
  }, [])
}
```

Then in `apps/ui/src/hooks/plans/index.ts`, add:

```ts
export { usePlansPullOnVisible } from "./usePlansPullOnVisible"
```

- [ ] **Step 4: Mount the hook**

In `apps/ui/src/hooks/tv/useAiBasedRenameFilesFlow.ts`, extend the existing import (line 6):

```ts
import {
  toUpdatePlanPatch,
  usePlansPullOnVisible,
  useUpdatePlanMutation,
} from "@/hooks/plans"
```

And add the call right after `useTvShowWebSocketEvents({...})` (line 87-89), before the `return`:

```ts
  usePlansPullOnVisible()
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/ui && pnpm test src/hooks/plans/usePlansPullOnVisible.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/ui/src/hooks/plans/usePlansPullOnVisible.ts apps/ui/src/hooks/plans/usePlansPullOnVisible.test.ts apps/ui/src/hooks/plans/index.ts apps/ui/src/hooks/tv/useAiBasedRenameFilesFlow.ts
git commit -m "feat(ui): pull pending plans on browser reactivate"
```

---

### Task 6: Full verification + spec status

**Files:**
- Modify: `docs/superpowers/specs/2026-09-06-ai-plan-metadata-write-enforcement-design.md` (status banner)

- [ ] **Step 1: Run all affected test suites**

Run:
```bash
cd packages/types && pnpm test && cd ../../packages/core-routes && pnpm test && cd ../../apps/ui && pnpm test
```
Expected: PASS — types (5 new), core-routes (2 existing + 4 new), apps/ui (no regressions; 3 + 4 new).

- [ ] **Step 2: Typecheck everything**

Run: `pnpm -r typecheck` (from the repo root)
Expected: exit 0.

- [ ] **Step 3: Lint changed UI files**

Run: `cd apps/ui && pnpm lint`
Expected: no new errors introduced by the changed/created files.

- [ ] **Step 4: Flip the spec status banner**

In `docs/superpowers/specs/2026-09-06-ai-plan-metadata-write-enforcement-design.md`, replace:

```markdown
> **Status:** Pending implementation.
```

with:

```markdown
> **Status:** Implemented (2026-09-06). Commit range: `<first-task-sha>`..`<last-commit-sha>`.
```

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-09-06-ai-plan-metadata-write-enforcement-design.md
git commit -m "docs: mark ai rename plan enforcement design implemented"
```

- [ ] **Step 6: Report e2e deferral**

State in the task report that extending `apps/e2e/test/specs/ai/AiTool-RenameTool.e2e.ts` (per the spec's testing table) was NOT done — it needs a running CLI stack + AI provider. The user decides whether to run it manually or schedule a follow-up.
