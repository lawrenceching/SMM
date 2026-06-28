import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  appendRecognizedFile,
  beginRecognizePlan,
  defaultValidateRecognizedFiles,
  readRecognizePlan,
} from "./plans.ts";
import { defaultChatFs } from "../chatFs.ts";
import type { ChatFs } from "../chatTypes.ts";
import type {
  RecognizeMediaFilePlan,
  RecognizedFile,
} from "@smm/core/types/RecognizeMediaFilePlan";

/**
 * Tests for the recognise-media-file plan pipeline. They focus on the
 * filesystem-existence guard added to prevent the AI from silently
 * queueing non-existent files for the user to confirm later.
 *
 * `defaultValidateRecognizedFiles` is exercised twice:
 *
 * - Through a real filesystem (only on Linux/CI, where
 *   `@smm/core/path`'s POSIX→Windows conversion does not mutate the
 *   path) to prove the validator correctly accepts an existing file
 *   and rejects a missing one.
 * - Through an in-memory {@link ChatFs} that records plans in a Map
 *   to prove that {@link appendRecognizedFile} rejects the call when
 *   the validator reports the file is missing, and never mutates the
 *   plan in that case.
 */

function makeInMemoryFs(options: { exists: (p: string) => boolean }): ChatFs & {
  readonly plans: Map<string, RecognizeMediaFilePlan>;
} {
  const plans = new Map<string, RecognizeMediaFilePlan>();
  const jsonPath = (appDataDir: string, id: string) =>
    join(appDataDir, "plans", `${id}.plan.json`);
  return {
    plans,
    async readJson<T = unknown>(filePath: string): Promise<T | null> {
      for (const [id, plan] of plans) {
        if (filePath.endsWith(`${id}.plan.json`)) {
          return plan as T;
        }
      }
      // The plan file path encoding is opaque to tests; resolve via
      // basename match against the registered keys.
      const match = /([0-9a-f-]{36})\.plan\.json$/.exec(filePath);
      if (match) {
        const id = match[1];
        if (id && plans.has(id)) return plans.get(id) as T;
      }
      void jsonPath;
      return null;
    },
    async writeJson(filePath: string, value: unknown): Promise<void> {
      const match = /([0-9a-f-]{36})\.plan\.json$/.exec(filePath);
      if (!match || !match[1]) {
        throw new Error(`Cannot derive plan id from ${filePath}`);
      }
      plans.set(match[1], value as RecognizeMediaFilePlan);
    },
    async exists(filePath: string): Promise<boolean> {
      return options.exists(filePath);
    },
  };
}

describe("appendRecognizedFile with an in-memory filesystem (cross-platform)", () => {
  let appDataDir: string;
  const fs = makeInMemoryFs({ exists: () => false });

  beforeAll(async () => {
    appDataDir = await mkdtemp(join(tmpdir(), "smm-plans-inmem-fs-"));
  });

  afterAll(async () => {
    await rm(appDataDir, { recursive: true, force: true });
  });

  it("rejects non-existent files and does not mutate the plan", async () => {
    const taskId = await beginRecognizePlan(appDataDir, "/media/show", fs);
    await expect(
      appendRecognizedFile(
        appDataDir,
        taskId,
        { season: 2, episode: 3, path: "/media/show/Missing.mkv" },
        fs,
      ),
    ).rejects.toThrow(/does not exist in the media folder/);

    const after = await readRecognizePlan(appDataDir, taskId, fs);
    expect(after?.files ?? []).toEqual([]);
  });

  it("honours a custom validateFiles override (e.g. tests)", async () => {
    const taskId = await beginRecognizePlan(appDataDir, "/media/show", fs);

    await expect(
      appendRecognizedFile(
        appDataDir,
        taskId,
        { season: 1, episode: 1, path: "/media/show/Missing.mkv" },
        fs,
        { validateFiles: async () => undefined },
      ),
    ).resolves.toBeUndefined();
  });

  it("defaultValidateRecognizedFiles rejects when the filesystem says no", async () => {
    await expect(
      defaultValidateRecognizedFiles(
        [{ season: 1, episode: 1, path: "/media/show/S01E01.mkv" }],
        fs,
      ),
    ).rejects.toThrow(
      'File "/media/show/S01E01.mkv" (S1E1) does not exist in the media folder',
    );
  });

  it("defaultValidateRecognizedFiles rejects an empty path with a clear message", async () => {
    await expect(
      defaultValidateRecognizedFiles(
        [{ season: 1, episode: 3, path: "" }],
        fs,
      ),
    ).rejects.toThrow(/File path is empty for S1E3/);
  });

  it("exposes RecognizedFile typing through the default validator (acceptance)", async () => {
    const accepting = makeInMemoryFs({ exists: () => true });
    const sample: RecognizedFile = {
      season: 1,
      episode: 1,
      path: "/media/show/S01E01.mkv",
    };
    await expect(
      defaultValidateRecognizedFiles([sample], accepting),
    ).resolves.toBeUndefined();
  });
});

describe("appendRecognizedFile with a real filesystem (Linux/CI)", () => {
  let appDataDir: string;
  let existingFilePosix: string;
  const fs = defaultChatFs();

  beforeAll(async () => {
    appDataDir = await mkdtemp(join(tmpdir(), "smm-plans-real-fs-"));
    const subDir = join(appDataDir, "media", "Season 01");
    await mkdir(subDir, { recursive: true });
    const existingFilePlatform = join(subDir, "Episode.mkv");
    await writeFile(existingFilePlatform, "x", "utf-8");
    existingFilePosix = existingFilePlatform.split("\\").join("/");
  });

  afterAll(async () => {
    await rm(appDataDir, { recursive: true, force: true });
  });

  // `Path.toPlatformPath` is broken for POSIX inputs on Windows
  // (`@smm/core/path` incorrectly routes through the UNC branch). Skip
  // the real-fs round-trip there and let CI on Linux exercise it.
  it.skipIf(process.platform === "win32")(
    "adds the file when it exists on disk",
    async () => {
      const taskId = await beginRecognizePlan(appDataDir, "/media/show", fs);

      await expect(
        appendRecognizedFile(
          appDataDir,
          taskId,
          { season: 1, episode: 1, path: existingFilePosix },
          fs,
        ),
      ).resolves.toBeUndefined();

      const plan = await readRecognizePlan(appDataDir, taskId, fs);
      expect(plan?.files).toEqual([
        { season: 1, episode: 1, path: existingFilePosix },
      ]);
    },
  );
});

describe("plan cancellation (rejected status)", () => {
  let appDataDir: string;
  const fs = makeInMemoryFs({ exists: () => false });

  beforeAll(async () => {
    appDataDir = await mkdtemp(join(tmpdir(), "smm-plans-cancel-"));
  });

  afterAll(async () => {
    await rm(appDataDir, { recursive: true, force: true });
  });

  it("appendRecognizedFile throws the cancellation message when the plan is rejected", async () => {
    const taskId = await beginRecognizePlan(appDataDir, "/media/show", fs);
    // Mark the plan as rejected (simulating the user clicking Cancel).
    fs.plans.set(taskId, {
      ...(fs.plans.get(taskId) as RecognizeMediaFilePlan),
      status: "rejected",
    });

    await expect(
      appendRecognizedFile(
        appDataDir,
        taskId,
        { season: 1, episode: 1, path: "/media/show/Ep.mkv" },
        fs,
      ),
    ).rejects.toThrow("该任务已被用户取消, 请停止后续操作");
  });

  it("appendRenamePlanEntry throws the cancellation message when the plan is rejected", async () => {
    const {
      appendRenamePlanEntry,
      beginRenamePlan,
      readRenamePlan,
    } = await import("./plans.ts");
    const { PLAN_CANCELLED_BY_USER_MESSAGE } = await import(
      "@smm/core/types/ai-tools/planTaskMessages"
    );
    const taskId = await beginRenamePlan(appDataDir, "/media/show", fs);
    fs.plans.set(taskId, {
      ...(fs.plans.get(taskId) as unknown as { status: string }),
      status: "rejected",
    });

    await expect(
      appendRenamePlanEntry(
        appDataDir,
        taskId,
        "/media/show/a.mp4",
        "/media/show/b.mp4",
        fs,
        {},
      ),
    ).rejects.toThrow(PLAN_CANCELLED_BY_USER_MESSAGE);
    void readRenamePlan;
  });

  it("updatePlanContent keeps the plan file when status is 'rejected' (no delete)", async () => {
    const { readRenamePlan, updatePlanContent } = await import(
      "./plans.ts"
    );
    const taskId = await beginRecognizePlan(appDataDir, "/media/show", fs);

    const updated = await updatePlanContent(
      appDataDir,
      taskId,
      { status: "rejected" },
      fs,
    );
    expect(updated?.status).toBe("rejected");

    // The plan file must still be on disk so subsequent MCP tool
    // calls (add-*-file / end-*-task) can detect the cancellation.
    const planAfter = await readRecognizePlan(appDataDir, taskId, fs);
    expect(planAfter?.status).toBe("rejected");
    void readRenamePlan;
  });

  it("updatePlanContent still deletes the plan file when status is 'completed' (regression)", async () => {
    // This test needs the real filesystem because `deletePlan` uses
    // `unlink` from `node:fs/promises` (the `ChatFs` abstraction does
    // not expose unlink), so the in-memory fs cannot model deletion.
    const realFs = await import("../chatFs.ts").then((m) => m.defaultChatFs());
    const { readPlanById, updatePlanContent } = await import("./plans.ts");
    const realAppDataDir = await mkdtemp(join(tmpdir(), "smm-plans-cancel-real-"));
    try {
      const taskId = await beginRecognizePlan(realAppDataDir, "/media/show", realFs);
      await updatePlanContent(
        realAppDataDir,
        taskId,
        { status: "completed" },
        realFs,
      );
      const planAfter = await readPlanById(realAppDataDir, taskId, realFs);
      expect(planAfter).toBeNull();
    } finally {
      await rm(realAppDataDir, { recursive: true, force: true });
    }
  });
});

describe("cleanPreparingPlans (real filesystem)", () => {
  let appDataDir: string;
  const fs = defaultChatFs();

  beforeAll(async () => {
    appDataDir = await mkdtemp(join(tmpdir(), "smm-plans-cleanup-"));
  });

  afterAll(async () => {
    await rm(appDataDir, { recursive: true, force: true });
  });

  it("removes only `preparing` plans and leaves `pending`/`rejected` alone", async () => {
    const { cleanPreparingPlans, listPlanFiles, readPlanById, updatePlanContent } =
      await import("./plans.ts");

    // Three plans in different states.
    const preparingId = await beginRecognizePlan(appDataDir, "/media/show-a", fs);
    const pendingId = await beginRecognizePlan(appDataDir, "/media/show-b", fs);
    const rejectedId = await beginRecognizePlan(appDataDir, "/media/show-c", fs);

    await updatePlanContent(appDataDir, pendingId, { status: "pending" }, fs);
    await updatePlanContent(appDataDir, rejectedId, { status: "rejected" }, fs);
    // `preparingId` stays in its default `preparing` status.

    const before = await listPlanFiles(appDataDir);
    expect(before).toHaveLength(3);

    const removed = await cleanPreparingPlans(appDataDir, fs);
    expect(removed).toBe(1);

    // Only the preparing plan was deleted; pending + rejected remain.
    expect(await readPlanById(appDataDir, preparingId, fs)).toBeNull();
    expect((await readPlanById(appDataDir, pendingId, fs))?.status).toBe("pending");
    expect((await readPlanById(appDataDir, rejectedId, fs))?.status).toBe("rejected");

    const after = await listPlanFiles(appDataDir);
    expect(after).toHaveLength(2);
  });

  it("is a no-op when no plans exist", async () => {
    const { cleanPreparingPlans, listPlanFiles } = await import("./plans.ts");
    const emptyDir = await mkdtemp(join(tmpdir(), "smm-plans-empty-"));
    try {
      expect(await listPlanFiles(emptyDir)).toEqual([]);
      expect(await cleanPreparingPlans(emptyDir, fs)).toBe(0);
    } finally {
      await rm(emptyDir, { recursive: true, force: true });
    }
  });
});
