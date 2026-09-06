# Recognize Single-Call Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用单次 `create-recognize-episode-plan` 调用替换 recognize 三步式工具（前端聊天 / MCP），同步引入 `metadata.write` 自动应用，随后删除 `promptStatus` 与 preparing 相关 UI 复杂度。

**Architecture:** 完全镜像 rename 先例 —— `apps/core` 纯管线（FsPort + writePlan，直写 pending）→ `core-routes` 工具构建器（`CreateRecognizeEpisodePlanToolExtra` gating，与 rename enforcement 同构）→ MCP handler / HTTP 路由 / 前端聊天工具三表面。迁移后 `preparing` 无生产者，UI 侧收紧。

**Tech Stack:** TypeScript + zod + Hono + @modelcontextprotocol/sdk + Vitest + React 19 + TanStack Query

**Design doc:** `docs/superpowers/specs/2026-09-07-recognize-single-call-migration-design.md`

## Global Constraints

- 行为约束（spec §4）：校验失败 → 工具返回 error、不产生 plan；`getUserConfig` reject → 视为未授予；applier reject → warn + 落回 pending 流（不硬报错）；ohos 依赖缺失 → 永远 pending。
- 校验语义（spec §2.2）：仅 文件存在性 + 批内去重（同 path / 同 (season,episode)），**不**校验 S,E 对 metadata。
- 新 plan 一律 `status: "pending"`、`creator: "ai"`（工具）/可选 `"app"`（管线与 HTTP）。
- 自动应用成功：广播 `mediaMetadataUpdated { folderPath }`、返回 `RECOGNIZE_PLAN_AUTO_APPLIED_MESSAGE`、**不**发 `RecognizeMediaFilePlanReady`。
- pending 流：广播 `RecognizeMediaFilePlanReady { taskId, planFilePath }`、返回 `END_PLAN_TASK_SUCCESS_MESSAGE`。
- 包管理器 pnpm；每个任务后跑对应包 `pnpm typecheck` + 测试；提交信息 conventional commits。
- e2e 规格改写（`MCP RecognizeTaskFlow` / `AiTool-RecognizeTool`）为**后续轮次**，不在本计划（spec §5）。
- 工作树中 `apps/ui/src/components/tv/TvShowPanel.tsx` 与 `docs/dev/*` 有用户未提交改动：**不要 stage 这些文件**（除非任务明确说明）。

---

### Task 1: types — 新 schema 与消息常量

**Files:**
- Create: `packages/types/ai-tools/createRecognizeEpisodePlan.ts`
- Modify: `packages/types/ai-tools/planTaskMessages.ts`

**Interfaces:**
- Produces: `CREATE_RECOGNIZE_EPISODE_PLAN = 'create-recognize-episode-plan'`、`CREATE_RECOGNIZE_EPISODE_PLAN_DESCRIPTION`、`createRecognizeEpisodePlanInputSchema`（`{ mediaFolderPath: string; files: Array<{season:number; episode:number; path:string}> }` min(1)）、`CreateRecognizeEpisodePlanInput`；`RECOGNIZE_PLAN_AUTO_APPLIED_MESSAGE`。Task 2/3/4/5/6 消费这些名字。

- [ ] **Step 1: 创建 schema 文件**

```ts
// packages/types/ai-tools/createRecognizeEpisodePlan.ts
import { z } from 'zod'

export const CREATE_RECOGNIZE_EPISODE_PLAN = 'create-recognize-episode-plan' as const

export const CREATE_RECOGNIZE_EPISODE_PLAN_DESCRIPTION =
  'Create a recognize-media-file plan that maps episode video files to season/episode numbers. ' +
  'Provide every mapping (season, episode, absolute file path) in one call. ' +
  'After success, tell the user to open SMM, review, and approve the plan.'

export const createRecognizeEpisodePlanInputSchema = z.object({
  mediaFolderPath: z
    .string()
    .describe('Absolute media folder path (POSIX or Windows)'),
  files: z
    .array(
      z.object({
        season: z.number().describe('The season number of the episode.'),
        episode: z.number().describe('The episode number.'),
        path: z
          .string()
          .describe('The absolute path of the media file (POSIX or Windows format).'),
      }),
    )
    .min(1),
})

export type CreateRecognizeEpisodePlanInput = z.infer<
  typeof createRecognizeEpisodePlanInputSchema
>
```

- [ ] **Step 2: planTaskMessages.ts 追加常量（文件末尾）**

```ts
/**
 * Returned to the AI when the recognize plan was applied automatically
 * because the user granted the `metadata.write` permission.
 */
export const RECOGNIZE_PLAN_AUTO_APPLIED_MESSAGE =
  "Recognize plan applied automatically (metadata.write permission granted). No user approval needed.";
```

- [ ] **Step 3: 验证**

Run: `pnpm typecheck:types`
Expected: 通过

- [ ] **Step 4: Commit**

```bash
git add packages/types/ai-tools/createRecognizeEpisodePlan.ts packages/types/ai-tools/planTaskMessages.ts
git commit -m "feat(types): add createRecognizeEpisodePlan schema and auto-applied message"
```

---

### Task 2: apps/core — createRecognizeEpisodePlanPipeline + Core 方法（TDD）

**Files:**
- Create: `apps/core/src/pipeline/createRecognizeEpisodePlan.ts`
- Test: `apps/core/src/pipeline/createRecognizeEpisodePlan.test.ts`
- Modify: `apps/core/src/Core.ts`（import + `createRecognizeEpisodePlan` 方法，镜像 `createRenameEpisodePlan` 于 :534）

**Interfaces:**
- Consumes: `writePlan`（`apps/core/src/pipeline/plans.ts:16`，签名 `writePlan(fs: FsPort, appDataDir: string, plan: Plan): Promise<void>`）、`planFilePath`（`apps/core/src/pipeline/paths.ts`）、`FsPort`（`../ports/FsPort`）。
- Produces: `createRecognizeEpisodePlanPipeline(mediaFolderPath, files, options, deps): Promise<RecognizeMediaFilePlan>`，`CreateRecognizeEpisodePlanOptions { creator?: "app"|"ai"; id?: string }`，`CreateRecognizeEpisodePlanDeps { fs: FsPort; appDataDir: string; normalizePosix: (p:string)=>string; createId?: () => string }`。Task 5 的 Core 方法与 Task 3 的工具 builder 依赖。

- [ ] **Step 1: 写失败测试**

```ts
// apps/core/src/pipeline/createRecognizeEpisodePlan.test.ts
import { describe, expect, it, vi } from "vitest";
import type { FsPort } from "../ports/FsPort";
import { createRecognizeEpisodePlanPipeline } from "./createRecognizeEpisodePlan";
import { planFilePath } from "./paths";

function inMemoryFs(seed: Record<string, string> = {}): FsPort {
  const files = new Map(Object.entries(seed));
  return {
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
    listFiles: vi.fn(async () => []),
    deleteFile: vi.fn(async () => {}),
    rename: vi.fn(async () => {}),
    mkdir: vi.fn(async () => {}),
    listSubdirectories: vi.fn(async () => []),
  };
}

describe("createRecognizeEpisodePlanPipeline", () => {
  const appDataDir = "/data";
  const folder = "/m/Show";

  it("writes a pending ai plan with posix paths", async () => {
    const fs = inMemoryFs({ "/m/Show/S01E01.mkv": "" });
    const plan = await createRecognizeEpisodePlanPipeline(
      folder,
      [{ season: 1, episode: 1, path: "/m/Show/S01E01.mkv" }],
      { creator: "ai", id: "fixed-id" },
      { fs, appDataDir, normalizePosix: (p) => p, createId: () => "fixed-id" },
    );
    expect(plan.status).toBe("pending");
    expect(plan.creator).toBe("ai");
    expect(plan.task).toBe("recognize-media-file");
    expect(plan.files[0]).toEqual({ season: 1, episode: 1, path: "/m/Show/S01E01.mkv" });
    expect(await fs.exists(planFilePath(appDataDir, "fixed-id"))).toBe(true);
  });

  it("rejects empty files", async () => {
    const fs = inMemoryFs();
    await expect(
      createRecognizeEpisodePlanPipeline(folder, [], undefined, {
        fs, appDataDir, normalizePosix: (p) => p,
      }),
    ).rejects.toThrow("No recognize entries in task");
  });

  it("rejects duplicate paths", async () => {
    const fs = inMemoryFs({ "/m/Show/S01E01.mkv": "" });
    await expect(
      createRecognizeEpisodePlanPipeline(
        folder,
        [
          { season: 1, episode: 1, path: "/m/Show/S01E01.mkv" },
          { season: 1, episode: 2, path: "/m/Show/S01E01.mkv" },
        ],
        undefined,
        { fs, appDataDir, normalizePosix: (p) => p },
      ),
    ).rejects.toThrow("Duplicate file path");
  });

  it("rejects duplicate season/episode pairs", async () => {
    const fs = inMemoryFs({
      "/m/Show/a.mkv": "",
      "/m/Show/b.mkv": "",
    });
    await expect(
      createRecognizeEpisodePlanPipeline(
        folder,
        [
          { season: 1, episode: 1, path: "/m/Show/a.mkv" },
          { season: 1, episode: 1, path: "/m/Show/b.mkv" },
        ],
        undefined,
        { fs, appDataDir, normalizePosix: (p) => p },
      ),
    ).rejects.toThrow("Duplicate season/episode");
  });

  it("rejects files that do not exist", async () => {
    const fs = inMemoryFs();
    await expect(
      createRecognizeEpisodePlanPipeline(
        folder,
        [{ season: 1, episode: 1, path: "/m/Show/missing.mkv" }],
        undefined,
        { fs, appDataDir, normalizePosix: (p) => p },
      ),
    ).rejects.toThrow('does not exist in the media folder');
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd apps/core && pnpm vitest run src/pipeline/createRecognizeEpisodePlan.test.ts`
Expected: FAIL — `Cannot find module './createRecognizeEpisodePlan'`

- [ ] **Step 3: 实现管线**

```ts
// apps/core/src/pipeline/createRecognizeEpisodePlan.ts
import { randomUUID } from "node:crypto";
import type { RecognizeMediaFilePlan } from "@smm/types/RecognizeMediaFilePlan";
import type { FsPort } from "../ports/FsPort";
import { writePlan } from "./plans";

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
): Promise<RecognizeMediaFilePlan> {
  const posixFolder = deps.normalizePosix(mediaFolderPath);

  if (files.length === 0) {
    throw new Error("No recognize entries in task");
  }

  const normalizedFiles = files.map((file) => ({
    season: file.season,
    episode: file.episode,
    path: deps.normalizePosix(file.path),
  }));

  const seenPaths = new Set<string>();
  const seenEpisodes = new Set<string>();
  for (const file of normalizedFiles) {
    if (seenPaths.has(file.path)) {
      throw new Error(`Duplicate file path in task: ${file.path}`);
    }
    seenPaths.add(file.path);

    const episodeKey = `${file.season}-${file.episode}`;
    if (seenEpisodes.has(episodeKey)) {
      throw new Error(
        `Duplicate season/episode in task: S${file.season}E${file.episode}`,
      );
    }
    seenEpisodes.add(episodeKey);

    if (!(await deps.fs.exists(file.path))) {
      throw new Error(
        `File "${file.path}" (S${file.season}E${file.episode}) does not exist in the media folder`,
      );
    }
  }

  const createId = deps.createId ?? randomUUID;
  const id = options?.id ?? createId();

  const plan: RecognizeMediaFilePlan = {
    id,
    task: "recognize-media-file",
    status: "pending",
    creator: options?.creator ?? "app",
    mediaFolderPath: posixFolder,
    files: normalizedFiles,
  };

  await writePlan(deps.fs, deps.appDataDir, plan);
  return plan;
}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd apps/core && pnpm vitest run src/pipeline/createRecognizeEpisodePlan.test.ts`
Expected: PASS（5 用例）

- [ ] **Step 5: Core 方法**

`apps/core/src/Core.ts` —— 在 import 区（:77-79 附近，已有 `createRenameEpisodePlanPipeline`）加入：

```ts
  createRecognizeEpisodePlanPipeline,
  type CreateRecognizeEpisodePlanOptions as CreateRecognizeEpisodePlanCoreOptions,
} from "./pipeline/createRecognizeEpisodePlan";
```

（与现有 rename import 合并整理为两个 import 语句即可。）在 `createRenameEpisodePlan` 方法（:534）后新增：

```ts
  async createRecognizeEpisodePlan(
    mediaFolderPath: string,
    files: Array<{ season: number; episode: number; path: string }>,
    options?: CreateRecognizeEpisodePlanCoreOptions,
  ): Promise<RecognizeMediaFilePlan> {
    return createRecognizeEpisodePlanPipeline(mediaFolderPath, files, options, {
      fs: this.fs,
      appDataDir: this.getMetadataRoot(),
      normalizePosix: (path) => this.normalizePosix(path),
    });
  }
```

（`RecognizeMediaFilePlan` 若 Core.ts 未导入则从 `@smm/types/RecognizeMediaFilePlan` 补充 type import；`createId` 不传，管线默认 randomUUID。）

- [ ] **Step 6: 验证并提交**

Run: `cd apps/core && pnpm typecheck && pnpm test`
Expected: 通过（含既有 477+ 测试）

```bash
git add apps/core/src/pipeline/createRecognizeEpisodePlan.ts apps/core/src/pipeline/createRecognizeEpisodePlan.test.ts apps/core/src/Core.ts
git commit -m "feat(core): add createRecognizeEpisodePlanPipeline and Core method"
```

---

### Task 3: core-routes — 工具构建器（TDD）

**Files:**
- Create: `packages/core-routes/src/tools/chatFsPort.ts`
- Create: `packages/core-routes/src/tools/createRecognizeEpisodePlan.ts`
- Test: `packages/core-routes/src/tools/createRecognizeEpisodePlan.test.ts`
- Modify: `packages/core-routes/src/tools/createRenameEpisodePlan.ts`（本地 `createFsPort`/`planPath` 改为从 `./chatFsPort` 导入；行为不变）

**Interfaces:**
- Consumes: Task 1 的 schema 与 `RECOGNIZE_PLAN_AUTO_APPLIED_MESSAGE`、Task 2 的管线（经 `@smm/core/createRecognizeEpisodePlan` 导出 —— 需在 `apps/core` 对外出口追加；见 Step 4）、`hasAiAgentPermission`/`AI_AGENT_PERMISSIONS`（`@smm/types`）、`RecognizeMediaFilePlanReady`/`MEDIA_METADATA_UPDATED_EVENT`（`@smm/types/event-types`）。
- Produces: `buildCreateRecognizeEpisodePlanTool(appDataDir, fs, broadcast?, logger?, abortSignal?, extra?: CreateRecognizeEpisodePlanToolExtra)`、`CreateRecognizeEpisodePlanToolExtra { getUserConfig?; applyRecognizeEpisodePlan?: (plan: RecognizeMediaFilePlan) => Promise<void> }`、`CREATE_RECOGNIZE_EPISODE_PLAN_TOOL_NAME`。Task 4/5 消费。

- [ ] **Step 1: 抽取共享 ChatFs→FsPort 适配器**

```ts
// packages/core-routes/src/tools/chatFsPort.ts
import { Path } from "@smm/utils/path";
import type { FsPort } from "@smm/core/FsPort";
import type { ChatFs } from "../chatTypes.ts";

function unsupportedFsOperation(name: string): never {
  throw new Error(`${name} is not supported by the plan filesystem adapter`);
}

export function createFsPort(fs: ChatFs): FsPort {
  return {
    async readTextFile(path: string): Promise<string> {
      const value = await fs.readJson(path);
      if (value === null) {
        throw new Error(`File not found: ${path}`);
      }
      return JSON.stringify(value);
    },
    async writeTextFile(path: string, content: string): Promise<void> {
      await fs.writeJson(path, JSON.parse(content) as unknown);
    },
    async writeBinaryFile(): Promise<void> {
      unsupportedFsOperation("writeBinaryFile");
    },
    exists: (path: string) => fs.exists(path),
    isFile: (path: string) => fs.exists(path),
    async listFiles(): Promise<string[]> {
      return unsupportedFsOperation("listFiles");
    },
    async listSubdirectories(): Promise<string[]> {
      return unsupportedFsOperation("listSubdirectories");
    },
    async deleteFile(): Promise<void> {
      unsupportedFsOperation("deleteFile");
    },
    async rename(): Promise<void> {
      unsupportedFsOperation("rename");
    },
    async mkdir(): Promise<void> {
      unsupportedFsOperation("mkdir");
    },
  };
}

export function planPath(appDataDir: string, planId: string): string {
  return new Path(appDataDir, `plans/${planId}.plan.json`).abs("posix");
}
```

然后修改 `createRenameEpisodePlan.ts`：删除本地 `createFsPort`（:30-67）与 `planPath`（:74-76），改为：

```ts
import { createFsPort, planPath } from "./chatFsPort.ts";
```

（`metadataPath` 保留在 rename 工具内。）

- [ ] **Step 2: 写失败测试**

```ts
// packages/core-routes/src/tools/createRecognizeEpisodePlan.test.ts
import { describe, expect, it, vi } from "vitest";
import { CREATE_RECOGNIZE_EPISODE_PLAN } from "@smm/types/ai-tools/createRecognizeEpisodePlan";
import { AI_AGENT_PERMISSIONS, type UserConfig } from "@smm/types";
import {
  END_PLAN_TASK_SUCCESS_MESSAGE,
  RECOGNIZE_PLAN_AUTO_APPLIED_MESSAGE,
} from "@smm/types/ai-tools/planTaskMessages";
import {
  MEDIA_METADATA_UPDATED_EVENT,
  RecognizeMediaFilePlanReady,
} from "@smm/types/event-types";
import type { ChatFs } from "../chatTypes.ts";
import { buildCreateRecognizeEpisodePlanTool } from "./createRecognizeEpisodePlan.ts";

function createMockFs(folder: string): ChatFs {
  const values = new Map<string, unknown>();
  return {
    async readJson<T = unknown>(path: string): Promise<T | null> {
      return (values.get(path) ?? null) as T | null;
    },
    writeJson: vi.fn(async (path: string, value: unknown) => {
      values.set(path, value);
    }),
    exists: vi.fn(async (path: string) => path === `${folder}/S01E01.mkv`),
  };
}

const FILES = [{ season: 1, episode: 1, path: "/media/show/S01E01.mkv" }];

function grantedConfig(): UserConfig {
  return {
    aiAgent: { permissions: [AI_AGENT_PERMISSIONS.metadataWrite] },
  } as unknown as UserConfig;
}

describe(`buildCreateRecognizeEpisodePlanTool (${CREATE_RECOGNIZE_EPISODE_PLAN})`, () => {
  it("pending flow: emits RecognizeMediaFilePlanReady and returns the success message", async () => {
    const broadcast = vi.fn();
    const tool = buildCreateRecognizeEpisodePlanTool(
      "/app-data",
      createMockFs("/media/show"),
      broadcast,
    );

    const result = await tool.execute({
      mediaFolderPath: "/media/show",
      files: FILES,
    });

    if (!("planId" in result)) {
      throw new Error(result.error);
    }
    expect(result.message).toBe(END_PLAN_TASK_SUCCESS_MESSAGE);
    expect(result.planId).toEqual(expect.any(String));
    expect(broadcast).toHaveBeenCalledWith({
      event: RecognizeMediaFilePlanReady.event,
      data: {
        taskId: result.planId,
        planFilePath: `/app-data/plans/${result.planId}.plan.json`,
      },
    });
  });

  it("auto-apply: granted permission + applier applies, emits mediaMetadataUpdated, no PlanReady", async () => {
    const broadcast = vi.fn();
    const applyRecognizeEpisodePlan = vi.fn(async () => {});
    const tool = buildCreateRecognizeEpisodePlanTool(
      "/app-data",
      createMockFs("/media/show"),
      broadcast,
      undefined,
      undefined,
      {
        getUserConfig: async () => grantedConfig(),
        applyRecognizeEpisodePlan,
      },
    );

    const result = await tool.execute({
      mediaFolderPath: "/media/show",
      files: FILES,
    });

    if (!("planId" in result)) {
      throw new Error(result.error);
    }
    expect(result.message).toBe(RECOGNIZE_PLAN_AUTO_APPLIED_MESSAGE);
    expect(applyRecognizeEpisodePlan).toHaveBeenCalledTimes(1);
    expect(broadcast).toHaveBeenCalledWith({
      event: MEDIA_METADATA_UPDATED_EVENT,
      data: { folderPath: "/media/show" },
    });
    expect(
      broadcast.mock.calls.some(
        (call) => call[0].event === RecognizeMediaFilePlanReady.event,
      ),
    ).toBe(false);
  });

  it("applier failure falls back to the pending flow", async () => {
    const broadcast = vi.fn();
    const tool = buildCreateRecognizeEpisodePlanTool(
      "/app-data",
      createMockFs("/media/show"),
      broadcast,
      undefined,
      undefined,
      {
        getUserConfig: async () => grantedConfig(),
        applyRecognizeEpisodePlan: vi.fn(async () => {
          throw new Error("disk locked");
        }),
      },
    );

    const result = await tool.execute({
      mediaFolderPath: "/media/show",
      files: FILES,
    });

    if (!("planId" in result)) {
      throw new Error(result.error);
    }
    expect(result.message).toBe(END_PLAN_TASK_SUCCESS_MESSAGE);
    expect(
      broadcast.mock.calls.some(
        (call) => call[0].event === RecognizeMediaFilePlanReady.event,
      ),
    ).toBe(true);
  });

  it("no permission → pending flow", async () => {
    const broadcast = vi.fn();
    const applyRecognizeEpisodePlan = vi.fn(async () => {});
    const tool = buildCreateRecognizeEpisodePlanTool(
      "/app-data",
      createMockFs("/media/show"),
      broadcast,
      undefined,
      undefined,
      {
        getUserConfig: async () => ({}) as UserConfig,
        applyRecognizeEpisodePlan,
      },
    );

    const result = await tool.execute({
      mediaFolderPath: "/media/show",
      files: FILES,
    });

    if (!("planId" in result)) {
      throw new Error(result.error);
    }
    expect(result.message).toBe(END_PLAN_TASK_SUCCESS_MESSAGE);
    expect(applyRecognizeEpisodePlan).not.toHaveBeenCalled();
  });

  it("absent deps → pending flow", async () => {
    const broadcast = vi.fn();
    const tool = buildCreateRecognizeEpisodePlanTool(
      "/app-data",
      createMockFs("/media/show"),
      broadcast,
    );
    const result = await tool.execute({
      mediaFolderPath: "/media/show",
      files: FILES,
    });
    if (!("planId" in result)) {
      throw new Error(result.error);
    }
    expect(result.message).toBe(END_PLAN_TASK_SUCCESS_MESSAGE);
  });

  it("getUserConfig rejection → pending flow", async () => {
    const broadcast = vi.fn();
    const applyRecognizeEpisodePlan = vi.fn(async () => {});
    const tool = buildCreateRecognizeEpisodePlanTool(
      "/app-data",
      createMockFs("/media/show"),
      broadcast,
      undefined,
      undefined,
      {
        getUserConfig: async () => {
          throw new Error("config unavailable");
        },
        applyRecognizeEpisodePlan,
      },
    );

    const result = await tool.execute({
      mediaFolderPath: "/media/show",
      files: FILES,
    });

    if (!("planId" in result)) {
      throw new Error(result.error);
    }
    expect(result.message).toBe(END_PLAN_TASK_SUCCESS_MESSAGE);
    expect(applyRecognizeEpisodePlan).not.toHaveBeenCalled();
  });

  it("validation failure returns an error payload and writes nothing", async () => {
    const broadcast = vi.fn();
    const tool = buildCreateRecognizeEpisodePlanTool(
      "/app-data",
      createMockFs("/media/show"),
      broadcast,
    );

    const result = await tool.execute({
      mediaFolderPath: "/media/show",
      files: [
        { season: 1, episode: 1, path: "/media/show/S01E01.mkv" },
        { season: 1, episode: 1, path: "/media/show/S01E02.mkv" },
      ],
    });

    expect(result.error).toContain("Duplicate season/episode");
  });
});
```

- [ ] **Step 3: 运行确认失败**

Run: `cd packages/core-routes && pnpm vitest run src/tools/createRecognizeEpisodePlan.test.ts`
Expected: FAIL — `Cannot find module './createRecognizeEpisodePlan.ts'`

- [ ] **Step 4: 实现 tool builder**

前置：`apps/core` 的对外出口需要暴露管线 —— 在 `apps/core/src/index.ts`（或 rename 管线的同款导出位置；rename 经 `@smm/core/createRenameEpisodePlan` 导出，见 `packages/core-routes/src/tools/createRenameEpisodePlan.ts:1`）找到 `createRenameEpisodePlan` 的 subpath export 配置（`apps/core/package.json` exports 字段 + 对应导出文件），按同样方式增加 `./createRecognizeEpisodePlan` 导出。以实际 exports 结构为准，镜像 rename 的每一处登记。

```ts
// packages/core-routes/src/tools/createRecognizeEpisodePlan.ts
import { createRecognizeEpisodePlanPipeline } from "@smm/core/createRecognizeEpisodePlan";
import type { FsPort } from "@smm/core/FsPort";
import { Path } from "@smm/utils/path";
import {
  AI_AGENT_PERMISSIONS,
  hasAiAgentPermission,
  type UserConfig,
} from "@smm/types";
import type { RecognizeMediaFilePlan } from "@smm/types/RecognizeMediaFilePlan";
import {
  CREATE_RECOGNIZE_EPISODE_PLAN,
  CREATE_RECOGNIZE_EPISODE_PLAN_DESCRIPTION,
  createRecognizeEpisodePlanInputSchema,
} from "@smm/types/ai-tools/createRecognizeEpisodePlan";
import {
  END_PLAN_TASK_SUCCESS_MESSAGE,
  RECOGNIZE_PLAN_AUTO_APPLIED_MESSAGE,
} from "@smm/types/ai-tools/planTaskMessages";
import {
  MEDIA_METADATA_UPDATED_EVENT,
  RecognizeMediaFilePlanReady,
  type RecognizeMediaFilePlanReadyRequestData,
} from "@smm/types/event-types";
import { formatToolError, toolOk } from "@smm/core/ai-tool/toolResult";
import type { ChatFs } from "../chatTypes.ts";
import type { CoreRoutesLogger } from "../types.ts";
import type { WebSocketMessage } from "../socketIO/types.ts";
import { defaultBroadcast } from "./broadcast.ts";
import { createFsPort, planPath } from "./chatFsPort.ts";

/**
 * Optional dependencies for the `metadata.write` auto-apply flow.
 * Auto-apply requires BOTH deps: without `getUserConfig` the tool
 * cannot verify the permission; without `applyRecognizeEpisodePlan`
 * (hosts without a Core instance, e.g. ohos) it cannot apply.
 */
export interface CreateRecognizeEpisodePlanToolExtra {
  /** Reads the current user config for the metadata.write permission check. */
  getUserConfig?: () => Promise<UserConfig>;
  /** Applies (merges metadata of) a created plan. Host Core runner, e.g. `Core.applyPlan`. */
  applyRecognizeEpisodePlan?: (plan: RecognizeMediaFilePlan) => Promise<void>;
}

export function buildCreateRecognizeEpisodePlanTool(
  appDataDir: string,
  fs: ChatFs,
  broadcast?: (message: WebSocketMessage) => void,
  logger?: CoreRoutesLogger,
  abortSignal?: AbortSignal,
  extra?: CreateRecognizeEpisodePlanToolExtra,
) {
  const emit = broadcast ?? defaultBroadcast;
  return {
    description: CREATE_RECOGNIZE_EPISODE_PLAN_DESCRIPTION,
    inputSchema: createRecognizeEpisodePlanInputSchema,
    execute: async (args: unknown) => {
      if (abortSignal?.aborted) {
        throw new Error("Request was aborted");
      }

      const parsed = createRecognizeEpisodePlanInputSchema.safeParse(args);
      if (!parsed.success) {
        return formatToolError(parsed.error);
      }

      try {
        const plan = await createRecognizeEpisodePlanPipeline(
          parsed.data.mediaFolderPath,
          parsed.data.files,
          { creator: "ai" },
          {
            fs: createFsPort(fs),
            appDataDir,
            normalizePosix: Path.posix,
          },
        );

        if (extra?.getUserConfig && extra.applyRecognizeEpisodePlan) {
          try {
            const userConfig = await extra.getUserConfig();
            if (
              hasAiAgentPermission(
                userConfig,
                AI_AGENT_PERMISSIONS.metadataWrite,
              )
            ) {
              await extra.applyRecognizeEpisodePlan(plan);
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
                `[tool][${CREATE_RECOGNIZE_EPISODE_PLAN}] Plan applied automatically`,
              );
              return toolOk({
                message: RECOGNIZE_PLAN_AUTO_APPLIED_MESSAGE,
                planId: plan.id,
              });
            }
          } catch (error) {
            logger?.warn(
              { planId: plan.id, error },
              `[tool][${CREATE_RECOGNIZE_EPISODE_PLAN}] Auto-apply failed, plan stays pending`,
            );
          }
        }

        const data: RecognizeMediaFilePlanReadyRequestData = {
          taskId: plan.id,
          planFilePath: planPath(appDataDir, plan.id),
        };
        emit({ event: RecognizeMediaFilePlanReady.event, data });
        logger?.info(
          {
            planId: plan.id,
            folderPath: plan.mediaFolderPath,
            fileCount: plan.files.length,
          },
          `[tool][${CREATE_RECOGNIZE_EPISODE_PLAN}] Plan created`,
        );

        return toolOk({
          message: END_PLAN_TASK_SUCCESS_MESSAGE,
          planId: plan.id,
        });
      } catch (error) {
        return formatToolError(error);
      }
    },
  };
}

export const CREATE_RECOGNIZE_EPISODE_PLAN_TOOL_NAME =
  CREATE_RECOGNIZE_EPISODE_PLAN;
```

注意：若 `@smm/types/event-types` 中 `RecognizeMediaFilePlanReadyRequestData` 的实际导出名不同，以 `packages/types/event-types.ts` 中的真实命名为准（`recognizeMediaFilesTask.ts:24` 现有 import 可对照）。

- [ ] **Step 5: 运行确认通过**

Run: `cd packages/core-routes && pnpm vitest run src/tools/createRecognizeEpisodePlan.test.ts src/tools/createRenameEpisodePlan.test.ts`
Expected: PASS（新 7 用例 + rename 既有用例全绿 —— 证明共享适配器重构无回归）

- [ ] **Step 6: 类型检查并提交**

Run: `pnpm typecheck:core && pnpm typecheck:core-routes`
Expected: 通过

```bash
git add packages/core-routes/src/tools/chatFsPort.ts packages/core-routes/src/tools/createRecognizeEpisodePlan.ts packages/core-routes/src/tools/createRecognizeEpisodePlan.test.ts packages/core-routes/src/tools/createRenameEpisodePlan.ts apps/core
git commit -m "feat(core-routes): add createRecognizeEpisodePlan tool builder with metadata.write gating"
```

---

### Task 4: core-routes — MCP 接线 + 三步式移除

**Files:**
- Create: `packages/core-routes/src/mcp/toolHandlers/createRecognizeEpisodePlan.ts`
- Modify: `packages/core-routes/src/mcp/types.ts`（`applyRenameEpisodePlan` 字段 :105 后新增 recognize 字段）
- Modify: `packages/core-routes/src/mcp/createServer.ts`（:6-8 imports、:116-122 注册块）
- Modify: `packages/core-routes/src/tools/index.ts`（imports :38-40/:68-71、`ChatTools` :100-102、`ChatToolsExtraDeps` :110-123、`createChatTools` :225-24x）
- Modify: `packages/core-routes/src/chat.ts`（:24-26 imports、:153-155 registry）
- Modify: `packages/core-routes/src/tools/plans.ts`（删除 recognize 三步式 helper）
- Modify: `packages/core-routes/src/tools/plans.test.ts`（fixture 重构）
- Delete: `packages/core-routes/src/mcp/toolHandlers/beginRecognizeTask.ts`、`addRecognizedFile.ts`、`endRecognizeTask.ts`、`packages/core-routes/src/tools/recognizeMediaFilesTask.ts`

**Interfaces:**
- Consumes: Task 3 的 `buildCreateRecognizeEpisodePlanTool` / `CreateRecognizeEpisodePlanToolExtra`。
- Produces: `registerCreateRecognizeEpisodePlanTool(server, config)`；`McpConfig.applyRecognizeEpisodePlan?: (plan: RecognizeMediaFilePlan) => Promise<void>`；`ChatToolsExtraDeps.applyRecognizeEpisodePlan?`。Task 5 消费。

- [ ] **Step 1: McpConfig 字段**

`packages/core-routes/src/mcp/types.ts`，在 `applyRenameEpisodePlan?: (plan: RenameFilesPlan) => Promise<void>;`（:105）后新增：

```ts
  /** Host Core runner for applying AI recognize plans (Bun cli / Electron). */
  applyRecognizeEpisodePlan?: (plan: RecognizeMediaFilePlan) => Promise<void>;
```

（`RecognizeMediaFilePlan` type import 若缺则从 `@smm/types/RecognizeMediaFilePlan` 补。）

- [ ] **Step 2: 新 MCP handler**

```ts
// packages/core-routes/src/mcp/toolHandlers/createRecognizeEpisodePlan.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CREATE_RECOGNIZE_EPISODE_PLAN,
  CREATE_RECOGNIZE_EPISODE_PLAN_DESCRIPTION,
  createRecognizeEpisodePlanInputSchema,
} from "@smm/types/ai-tools/createRecognizeEpisodePlan";
import { defaultChatFs } from "../../chatFs.ts";
import { buildCreateRecognizeEpisodePlanTool } from "../../tools/createRecognizeEpisodePlan.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  type McpToolResponse,
} from "../index.ts";
import type { McpConfig } from "../types.ts";

export function registerCreateRecognizeEpisodePlanTool(
  server: McpServer,
  config: McpConfig,
): void {
  const tool = buildCreateRecognizeEpisodePlanTool(
    config.appDataDir,
    config.fs ?? defaultChatFs(),
    config.broadcast,
    config.logger,
    undefined,
    {
      getUserConfig: config.getUserConfig,
      applyRecognizeEpisodePlan: config.applyRecognizeEpisodePlan,
    },
  );
  const description =
    config.toolDescriptions?.[CREATE_RECOGNIZE_EPISODE_PLAN] ??
    CREATE_RECOGNIZE_EPISODE_PLAN_DESCRIPTION;

  server.registerTool(
    CREATE_RECOGNIZE_EPISODE_PLAN,
    {
      description,
      inputSchema: createRecognizeEpisodePlanInputSchema,
    },
    async (args: unknown): Promise<McpToolResponse> => {
      const result = await tool.execute(args);
      if (result.error) {
        return createErrorResponse(result.error);
      }
      return createSuccessResponse(result);
    },
  );
}
```

- [ ] **Step 3: createServer.ts 注册替换**

imports（:6-8）：

```ts
import { registerCreateRecognizeEpisodePlanTool } from "./toolHandlers/createRecognizeEpisodePlan.ts";
```

（删除 `registerBeginRecognizeTaskTool` / `registerAddRecognizedFileTool` / `registerEndRecognizeTaskTool` 三行 import。）

注册块（:116-122）：

```ts
  // Episode-level rename plan.
  registerCreateRenameEpisodePlanTool(server, config);

  // Episode recognition plan (single call).
  registerCreateRecognizeEpisodePlanTool(server, config);
```

- [ ] **Step 4: git rm 三步式 handler 与工具实现**

```bash
git rm packages/core-routes/src/mcp/toolHandlers/beginRecognizeTask.ts packages/core-routes/src/mcp/toolHandlers/addRecognizedFile.ts packages/core-routes/src/mcp/toolHandlers/endRecognizeTask.ts packages/core-routes/src/tools/recognizeMediaFilesTask.ts
```

- [ ] **Step 5: tools/index.ts 与 chat.ts 注册表替换**

`tools/index.ts`：
1. imports：删除 `BEGIN_RECOGNIZE_TASK/ADD_RECOGNIZED_MEDIA_FILE/END_RECOGNIZE_TASK` 及 `recognizeMediaFilesTask.ts` 的 4 个 builder import（:38-40、:68-71），新增：
```ts
import {
  CREATE_RECOGNIZE_EPISODE_PLAN,
} from "@smm/types/ai-tools/createRecognizeEpisodePlan";
import { buildCreateRecognizeEpisodePlanTool } from "./createRecognizeEpisodePlan.ts";
```
（`CREATE_RENAME_EPISODE_PLAN` 及 rename builder import 已存在，保留；`RecognizeMediaFilePlan` type import 若缺则补。）
2. `ChatTools` 接口（:100-102）三行替换为：
```ts
  [CREATE_RECOGNIZE_EPISODE_PLAN]: ReturnType<
    typeof buildCreateRecognizeEpisodePlanTool
  >;
```
3. `ChatToolsExtraDeps`（:121-122 后）新增：
```ts
  /** Host Core runner for applying AI recognize plans (Bun cli / Electron). */
  applyRecognizeEpisodePlan?: (plan: RecognizeMediaFilePlan) => Promise<void>;
```
4. `createChatTools` 返回表（:225-24x，三个 recognize builder 调用）替换为：
```ts
    [CREATE_RECOGNIZE_EPISODE_PLAN]: buildCreateRecognizeEpisodePlanTool(
      config.appDataDir,
      fs,
      broadcast,
      logger,
      abortSignal,
      {
        getUserConfig: () => Promise.resolve(userConfig),
        applyRecognizeEpisodePlan: extra?.applyRecognizeEpisodePlan,
      },
    ),
```

`chat.ts`：imports（:24-26）三行替换为 `CREATE_RECOGNIZE_EPISODE_PLAN`；registry（:153-155）三行替换为：
```ts
      [CREATE_RECOGNIZE_EPISODE_PLAN]: tools[CREATE_RECOGNIZE_EPISODE_PLAN],
```

- [ ] **Step 6: tools/plans.ts 删除 recognize 三步式 helper**

删除：`beginRecognizePlan`（:166-181）、`appendRecognizedFile`（:152 起的完整函数）、`RecognizePlanAppendDeps` 接口、`defaultValidateRecognizedFiles`（:131-150）。逐项 grep 确认仅剩死引用：

Run: `grep -n "beginRecognizePlan\|appendRecognizedFile\|defaultValidateRecognizedFiles\|RecognizePlanAppendDeps\|ensurePlansDirExists\|readRecognizePlan" packages/core-routes/src/tools/plans.ts`

保留规则：`readRecognizePlan`（plans.test.ts 仍用）、`updatePlanContent`/`cancelPlan`/`cleanPreparingPlans`/`readPlanById`/`createPlan`/`plansApi` 相关全部保留。`ensurePlansDirExists`/`PLAN_CANCELLED_BY_USER_MESSAGE`/`RecognizedFile`/`PlanStatus` 等 import 若仅剩死引用则一并清理；`readRecognizePlan` 如引用了被删符号则改写为直读（`fs.readJson` + task 断言）。

- [ ] **Step 7: plans.test.ts fixture 重构**

原 `beginRecognizePlan(appDataDir, "/media/show", fs)` 夹具（`appendRecognizedFile` 两个 describe 与 cancellation 测试中共 4 处）替换为直写 preparing plan：

```ts
async function seedPreparingPlan(
  appDataDir: string,
  planId: string,
  fs: ChatFs,
): Promise<void> {
  await fs.writeJson(
    `${appDataDir}/plans/${planId}.plan.json`,
    {
      id: planId,
      task: "recognize-media-file",
      status: "preparing",
      creator: "ai",
      mediaFolderPath: "/media/show",
      files: [],
    },
  );
}
```

删除 `appendRecognizedFile` 的两个 describe（:74-190 附近的 in-memory / real-fs 用例）与 "appendRecognizedFile throws the cancellation message" 用例；保留并改造 "plan cancellation" / `updatePlanContent` / `cleanPreparingPlans` 用例（fixture 换 `seedPreparingPlan`）。若 `cleanPreparingPlans` 用例依赖 begin 创建 preparing —— 同样换 `seedPreparingPlan`。

- [ ] **Step 8: 验证**

Run: `cd packages/core-routes && pnpm typecheck && pnpm test`
Expected: 通过（无 recognizeMediaFilesTask 残留引用；`grep -rn "recognizeMediaFilesTask\|BEGIN_RECOGNIZE_TASK\|ADD_RECOGNIZED_MEDIA_FILE\|END_RECOGNIZE_TASK" packages/core-routes/src --include="*.ts" | grep -v test` 零匹配）

- [ ] **Step 9: Commit**

```bash
git add -A packages/core-routes
git commit -m "refactor(core-routes): replace recognize begin/add/end tools with single-call createRecognizeEpisodePlan"
```

---

### Task 5: apps/cli — HTTP 路由 + wiring

**Files:**
- Create: `apps/cli/src/route/RecognizeEpisodesPlan.ts`
- Test: `apps/cli/src/route/RecognizeEpisodesPlan.test.ts`
- Modify: `apps/cli/server.ts`（:47-48/:301-303 区域）
- Modify: `apps/cli/src/mcp/mcp.ts`（:151 附近）、`apps/cli/src/route/chatRoute.ts`（:20 附近）
- Modify: `docs/api/index.md`

**Interfaces:**
- Consumes: `getCore().createRecognizeEpisodePlan`（Task 2）、`broadcast`（`@/utils/socketIO`）、`RecognizeMediaFilePlanReady`（`@smm/types/event-types`）。
- Produces: `POST /api/create-recognize-episode-plan`；MCP/chat 的 `applyRecognizeEpisodePlan` 注入。

- [ ] **Step 1: 新路由**

```ts
// apps/cli/src/route/RecognizeEpisodesPlan.ts
import type { Hono } from 'hono'
import { Path } from '@smm/utils/path'
import type { RecognizeMediaFilePlan } from '@smm/types/RecognizeMediaFilePlan'
import {
  RecognizeMediaFilePlanReady,
  type RecognizeMediaFilePlanReadyRequestData,
} from '@smm/types/event-types'
import { formatToolError } from '@smm/core/ai-tool/toolResult'
import { getCore } from '../core/getCore'
import { broadcast } from '@/utils/socketIO'
import { getAppDataDir } from '@/utils/config'
import { logger } from '../../lib/logger'

export interface CreateRecognizeEpisodePlanRequestBody {
  mediaFolderPath: string
  files: Array<{ season: number; episode: number; path: string }>
  creator?: 'ai' | 'app'
}

export interface CreateRecognizeEpisodePlanResponseBody {
  data?: { plan: RecognizeMediaFilePlan }
  error?: string
}

function readStringField(body: unknown, key: string): string | undefined {
  if (typeof body !== 'object' || body === null || !(key in body)) return undefined
  const value = (body as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : undefined
}

function readRecognizeFiles(
  body: unknown,
): Array<{ season: number; episode: number; path: string }> | undefined {
  if (typeof body !== 'object' || body === null || !('files' in body)) return undefined
  const files = (body as Record<string, unknown>).files
  if (!Array.isArray(files)) return undefined
  if (
    !files.every(
      (file) =>
        typeof file === 'object' &&
        file !== null &&
        typeof (file as Record<string, unknown>).season === 'number' &&
        typeof (file as Record<string, unknown>).episode === 'number' &&
        typeof (file as Record<string, unknown>).path === 'string',
    )
  ) {
    return undefined
  }
  return files as Array<{ season: number; episode: number; path: string }>
}

export async function createRecognizeEpisodePlanFromBody(
  body: unknown,
): Promise<CreateRecognizeEpisodePlanResponseBody> {
  const mediaFolderPath = readStringField(body, 'mediaFolderPath')
  if (!mediaFolderPath?.trim()) {
    return { error: 'Error Reason: mediaFolderPath is required' }
  }

  const files = readRecognizeFiles(body)
  if (!files) {
    return { error: 'Error Reason: files must be an array' }
  }

  const creator = readStringField(body, 'creator') === 'app' ? 'app' : 'ai'
  const plan = await getCore().createRecognizeEpisodePlan(mediaFolderPath, files, { creator })

  if (creator === 'ai') {
    const planFilePath = Path.posix(`${getAppDataDir()}/plans/${plan.id}.plan.json`)
    const data: RecognizeMediaFilePlanReadyRequestData = {
      taskId: plan.id,
      planFilePath,
    }
    broadcast({ event: RecognizeMediaFilePlanReady.event, data })
  }

  return { data: { plan } }
}

/**
 * Recognize-episodes plan HTTP surface (single call):
 * - POST /api/create-recognize-episode-plan → Core.createRecognizeEpisodePlan
 * (apply/reject reuse POST /api/apply-plan and /api/reject-plan in RenameEpisodesPlan.ts)
 */
export function handleRecognizeEpisodesPlan(app: Hono): void {
  app.post('/api/create-recognize-episode-plan', async (c) => {
    try {
      let body: unknown = {}
      try {
        body = await c.req.json()
      } catch {
        /* empty */
      }
      return c.json(await createRecognizeEpisodePlanFromBody(body), 200)
    } catch (error) {
      logger.error({ error }, '[POST /api/create-recognize-episode-plan] route error')
      const err: CreateRecognizeEpisodePlanResponseBody = formatToolError(error)
      return c.json(err, 200)
    }
  })
}
```

- [ ] **Step 2: 路由测试（镜像 RenameEpisodesPlan.test.ts 的 create 用例）**

先读 `apps/cli/src/route/RenameEpisodesPlan.test.ts:27-60` 的 app/依赖组织方式，按同款写 `RecognizeEpisodesPlan.test.ts`：mock `../core/getCore`（`getCore: () => ({ createRecognizeEpisodePlan: vi.fn(async () => plan) })`）与 `@/utils/socketIO`（`broadcast: vi.fn()`），断言：ai creator → 200 + `data.plan` + broadcast `RecognizeMediaFilePlanReady`；缺 `mediaFolderPath`/`files` → error 文案；creator=app → 不 broadcast。

- [ ] **Step 3: server.ts 挂载**

:47-48 附近加：

```ts
import { handleRecognizeEpisodesPlan } from './src/route/RecognizeEpisodesPlan';
```

:303 后加：

```ts
    handleRecognizeEpisodesPlan(this.app);
```

- [ ] **Step 4: MCP / chat 自动应用注入**

`apps/cli/src/mcp/mcp.ts` :151 `applyRenameEpisodePlan` 行后：

```ts
    applyRecognizeEpisodePlan: (plan) => getCore().applyPlan(plan),
```

`apps/cli/src/route/chatRoute.ts` :20 同样追加一行。

- [ ] **Step 5: docs/api/index.md**

在 rename 的 `POST /api/create-rename-episode-plan` 条目旁按同格式新增 `POST /api/create-recognize-episode-plan`（请求体 `{ mediaFolderPath, files: [{season,episode,path}], creator? }`，响应 `{ data: { plan } }`）。

- [ ] **Step 6: 检查 ai-tool-registry 测试**

Run: `grep -n "Recognize" apps/cli/src/test/ai-tool-registry.test.ts`
若该测试枚举 chat/MCP 工具名，将 `begin-recognize-task`/`add-recognized-media-file`/`end-recognize-task` 三项替换为 `create-recognize-episode-plan` 一项。

- [ ] **Step 7: 验证并提交**

Run: `cd apps/cli && pnpm typecheck && pnpm test`
Expected: 通过

```bash
git add apps/cli/src/route/RecognizeEpisodesPlan.ts apps/cli/src/route/RecognizeEpisodesPlan.test.ts apps/cli/server.ts apps/cli/src/mcp/mcp.ts apps/cli/src/route/chatRoute.ts docs/api/index.md apps/cli/src/test/ai-tool-registry.test.ts
git commit -m "feat(cli): add create-recognize-episode-plan route and metadata.write auto-apply wiring"
```

---

### Task 6: apps/ui — 前端工具替换 + 三步式/draft 删除

**Files:**
- Create: `apps/ui/src/api/createRecognizeEpisodePlan.ts`
- Create: `apps/ui/src/ai/tools/CreateRecognizeEpisodePlan.tsx`
- Modify: `apps/ui/src/ai/tools/index.ts`、`apps/ui/src/ai/Assistant.tsx`（:28-30 imports + 使用处）、`apps/ui/src/ai/Assistant.registry.test.ts`（:33-35）
- Modify: `apps/ui/src/hooks/plans/index.ts`（删 `useCreatePlanMutation` 导出）
- Modify: `apps/ui/src/hooks/tv/useAiBasedRecognizeEpisodeFlow.ts` + `.test.ts`、`useAiBasedRenameEpisodeFlow.ts` + `.test.ts`（去 `cleanup*Plan`）
- Delete: `apps/ui/src/ai/tools/{BeginRecognizeTask,AddRecognizedMediaFile,EndRecognizeTask}.tsx`、`apps/ui/src/ai/plan/{aiPlanDrafts,recognizePlanService,cleanupRenamePlan}.ts`、`apps/ui/src/hooks/plans/useCreatePlanMutation.ts`

**Interfaces:**
- Consumes: Task 5 的 HTTP 路由。
- Produces: `createRecognizeEpisodePlanApi(request, signal?)`；`CreateRecognizeEpisodePlanTool`。

- [ ] **Step 1: api wrapper**

```ts
// apps/ui/src/api/createRecognizeEpisodePlan.ts
import type { PlanCreator } from '@smm/types/planCommon'
import type { RecognizeMediaFilePlan } from '@smm/types/RecognizeMediaFilePlan'
import { apiFetch } from '@/lib/apiFetch'

export interface CreateRecognizeEpisodePlanRequest {
  mediaFolderPath: string
  files: Array<{ season: number; episode: number; path: string }>
  creator: PlanCreator
}

export interface CreateRecognizeEpisodePlanResponseBody {
  data?: { plan: RecognizeMediaFilePlan }
  error?: string
}

export async function createRecognizeEpisodePlanApi(
  request: CreateRecognizeEpisodePlanRequest,
  signal?: AbortSignal,
): Promise<CreateRecognizeEpisodePlanResponseBody> {
  const resp = await apiFetch('/api/create-recognize-episode-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  })

  if (!resp.ok) {
    throw new Error(`HTTP Layer Error: ${resp.status} ${resp.statusText}`)
  }

  return (await resp.json()) as CreateRecognizeEpisodePlanResponseBody
}
```

- [ ] **Step 2: 前端工具**

```tsx
// apps/ui/src/ai/tools/CreateRecognizeEpisodePlan.tsx
import { makeAssistantTool, tool } from '@assistant-ui/react'
import {
  CREATE_RECOGNIZE_EPISODE_PLAN,
  CREATE_RECOGNIZE_EPISODE_PLAN_DESCRIPTION,
  createRecognizeEpisodePlanInputSchema,
} from '@smm/types/ai-tools/createRecognizeEpisodePlan'
import { END_PLAN_TASK_SUCCESS_MESSAGE } from '@smm/types/ai-tools/planTaskMessages'
import { formatToolError, toolOk } from '@smm/core/ai-tool/toolResult'
import { createRecognizeEpisodePlanApi } from '@/api/createRecognizeEpisodePlan'
import { PLANS_QUERY_ROOT } from '@/hooks/plans'
import { queryClient } from '@/lib/queryClient'

const createRecognizeEpisodePlan = tool({
  description: CREATE_RECOGNIZE_EPISODE_PLAN_DESCRIPTION,
  parameters: createRecognizeEpisodePlanInputSchema,
  execute: async ({ mediaFolderPath, files }) => {
    try {
      const resp = await createRecognizeEpisodePlanApi({
        mediaFolderPath,
        files,
        creator: 'ai',
      })
      if (resp.error || !resp.data) {
        return { error: resp.error ?? 'Error Reason: Plan creation returned no data' }
      }

      await queryClient.invalidateQueries({ queryKey: [PLANS_QUERY_ROOT] })
      return toolOk({
        message: END_PLAN_TASK_SUCCESS_MESSAGE,
        taskId: resp.data.plan.id,
      })
    } catch (error) {
      return formatToolError(error)
    }
  },
})

export const CreateRecognizeEpisodePlanTool = makeAssistantTool({
  ...createRecognizeEpisodePlan,
  toolName: CREATE_RECOGNIZE_EPISODE_PLAN,
})
```

- [ ] **Step 3: 删除与注册表更新**

```bash
git rm apps/ui/src/ai/tools/BeginRecognizeTask.tsx apps/ui/src/ai/tools/AddRecognizedMediaFile.tsx apps/ui/src/ai/tools/EndRecognizeTask.tsx apps/ui/src/ai/plan/aiPlanDrafts.ts apps/ui/src/ai/plan/recognizePlanService.ts apps/ui/src/ai/plan/cleanupRenamePlan.ts apps/ui/src/hooks/plans/useCreatePlanMutation.ts
```

`ai/tools/index.ts`：三行 recognize 导出与 `cleanupRecognizePlan` 导出替换为 `export { CreateRecognizeEpisodePlanTool } from './CreateRecognizeEpisodePlan'`。`hooks/plans/index.ts`：删除 `useCreatePlanMutation` 导出行。`Assistant.tsx`：import 区三行换 `CreateRecognizeEpisodePlanTool`，并在该文件内工具使用处（grep `BeginRecognizeTaskTool` 找到全部出现点）同步替换。`Assistant.registry.test.ts`：`:33-35` 三项换 `'CreateRecognizeEpisodePlanTool'`。

- [ ] **Step 4: flow hooks 去 cleanup**

`useAiBasedRenameEpisodeFlow.ts`：删 `import { cleanupRenamePlan } from "@/ai/plan/cleanupRenamePlan"`；confirm 中 `await cleanupRenamePlan(plan.id)` 删除；cancel 中同删；错误文案保留。`useAiBasedRenameEpisodeFlow.test.ts`：删 `cleanupRenamePlan` mock/hoisted/断言（confirm 用例断言只保留 `applyPlanMutateAsync`；cancel 用例只保留 `updatePlanMutateAsync`）。`useAiBasedRecognizeEpisodeFlow.ts`/`.test.ts` 同法（删 `cleanupRecognizePlan`）。

- [ ] **Step 5: 验证**

Run: `cd apps/ui && pnpm typecheck && pnpm vitest run`
Expected: 通过；`grep -rn "BeginRecognizeTask\|AddRecognizedMediaFile\|EndRecognizeTask\|aiPlanDrafts\|recognizePlanService\|cleanupRenamePlan\|cleanupRecognizePlan\|useCreatePlanMutation" apps/ui/src --include="*.ts" --include="*.tsx" | grep -v test` 零匹配

- [ ] **Step 6: Commit**

```bash
git add -A apps/ui
git commit -m "refactor(ui): replace recognize 3-step chat tools with single-call createRecognizeEpisodePlan"
```

---

### Task 7: apps/ui — promptStatus 删除与 UI 收紧

**Files:**
- Modify: `apps/ui/src/hooks/tv/useAiBasedRenameEpisodeFlow.ts`、`useAiBasedRecognizeEpisodeFlow.ts` 及两个 `.test.ts`
- Modify: `apps/ui/src/components/tv/AiBasedRenameEpisodePrompt.tsx`、`AiBasedRecognizeEpisodePrompt.tsx`
- Modify: `apps/ui/src/components/tv/plans/selectActiveAppPlan.ts` + `selectActiveAppPlan.test.ts`
- Modify: `apps/ui/public/locales/{en,zh-CN,zh-HK,zh-TW}/components.json`（删 `toolbar.aiGenerating`、`toolbar.aiRecognizing`）

**Interfaces:**
- Produces: flow hook 返回值去掉 `promptStatus`；`promptProps = { isOpen, onConfirm, onCancel }`；prompt 组件 props 删 `status`。Task 8 验证依赖。

- [ ] **Step 1: 先改测试（RED）**

两个 hook 测试：删除 `"maps a preparing plan to the generating prompt status"` 用例；将 promptStatus 相关断言改为 `expect(result.current.promptStatus).toBeUndefined()`（rename 用例）/删除（recognize 用例的 `promptStatus` 断言删掉）；`promptProps` 断言去掉 `status`。运行：

Run: `cd apps/ui && pnpm vitest run src/hooks/tv/useAiBasedRenameEpisodeFlow.test.ts src/hooks/tv/useAiBasedRecognizeEpisodeFlow.test.ts`
Expected: FAIL（promptStatus 仍存在 / promptProps 仍含 status）

- [ ] **Step 2: hook 实现（GREEN）**

两个 hook：删 `const promptStatus: ... = plan?.status === "preparing" ? "generating" : "wait-for-ack"`；`promptProps` memo 去掉 `status` 字段与对应类型字段；返回对象删 `promptStatus`。

- [ ] **Step 3: prompt 组件**

`AiBasedRenameEpisodePrompt.tsx` 全量替换为：

```tsx
import { FloatingPrompt, type FloatingPromptProps } from "../FloatingPrompt"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"

export interface AiBasedRenameEpisodePromptProps extends Omit<FloatingPromptProps, 'mode' | 'status' | 'children'> {
}

/**
 * AiBasedRenameEpisodePrompt component built on top of FloatingPrompt.
 * Used to confirm AI episode renaming operations.
 */
export function AiBasedRenameEpisodePrompt({
  onConfirm,
  onCancel,
  isOpen = false,
  className,
  confirmLabel,
  cancelLabel,
  isConfirmButtonDisabled,
  isConfirmDisabled,
  ...promptProps
}: AiBasedRenameEpisodePromptProps) {
  const { t } = useTranslation('components')

  return (
    <FloatingPrompt
      {...promptProps}
      isOpen={isOpen}
      onConfirm={onConfirm}
      onCancel={onCancel}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      isConfirmButtonDisabled={isConfirmButtonDisabled}
      isConfirmDisabled={isConfirmDisabled}
      mode="ai"
      className={cn(className)}
    >
      <div className="flex items-center gap-2" data-testid="ai-based-rename-status">
        <span className="text-sm">
          {t('toolbar.aiReview', { defaultValue: 'Review AI-generated file names' })}
        </span>
      </div>
    </FloatingPrompt>
  )
}
```

（`AiBasedRecognizeEpisodePrompt.tsx` 同法：删 status prop/generating 分支/`Loader2` import/`isConfirmButtonDisabledFinal` 的 generating 项，文案用 `toolbar.aiReviewEpisodes`，testid 保持 `ai-based-recognize-status`。）

- [ ] **Step 4: selectActiveAiPlan 收紧**

`selectActiveAppPlan.ts`：`selectActiveAiPlan` 改为仅匹配 `pending`（`selectActiveAppPlan` 保持不变）：

```ts
export function selectActiveAiPlan<T extends Plan>(
  plans: Plan[],
  mediaFolderPath: string | undefined,
  task: PlanTask,
): T | undefined {
  if (!mediaFolderPath) return undefined

  return plans.find(
    (p) =>
      p.task === task &&
      p.creator === "ai" &&
      p.status === "pending" &&
      mediaFolderPathEqual(p.mediaFolderPath, mediaFolderPath),
  ) as T | undefined
}
```

同步更新 `selectActiveAppPlan.test.ts` 中 AI 相关 preparing 期望（改为不 surfaced）。

- [ ] **Step 5: locale**

四个 `apps/ui/public/locales/*/components.json` 删除 `toolbar.aiGenerating` 与 `toolbar.aiRecognizing` 两个键（保留 `aiReview`/`aiReviewEpisodes`）。若 `TvShowPanel.locale.test.ts` 校验键集合，按其断言方式同步。

- [ ] **Step 6: 验证**

Run: `cd apps/ui && pnpm typecheck && pnpm vitest run`
Expected: 全绿

- [ ] **Step 7: Commit**

```bash
git add apps/ui/src/hooks/tv apps/ui/src/components/tv apps/ui/public/locales
git commit -m "refactor(ui): remove promptStatus and preparing UI after single-call recognize migration"
```

**注意**：`apps/ui/src/components/tv/TvShowPanel.tsx` 有用户本地改动，本任务**不触碰**该文件。

---

### Task 8: 收尾验证

**Files:** 无新增（修复并入本任务提交）

- [ ] **Step 1: 残留引用 grep**

Run: `grep -rn "recognizeMediaFilesTask\|BEGIN_RECOGNIZE_TASK\|ADD_RECOGNIZED_MEDIA_FILE\|END_RECOGNIZE_TASK\|begin-recognize-task\|add-recognized-media-file\|end-recognize-task\|promptStatus" apps packages --include="*.ts" --include="*.tsx" | grep -v "\.superpowers\|docs/\|node_modules"`
Expected: 零匹配（e2e 规格文件除外 —— 属后续轮次）

- [ ] **Step 2: 全量门禁**

Run: `pnpm build && pnpm typecheck && pnpm test`
Expected: 全部通过

- [ ] **Step 3:（如有修复）Commit**

```bash
git add -A && git commit -m "chore: fixups for recognize single-call migration"
```
