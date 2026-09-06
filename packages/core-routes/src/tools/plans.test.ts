import { mkdtemp, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readRecognizePlan } from "./plans.ts";
import { defaultChatFs } from "../chatFs.ts";
import type { ChatFs } from "../chatTypes.ts";
import type { AnyPlan } from "./plans.ts";

/**
 * Tests for the recognise-media-file plan storage helpers that are
 * still owned by core-routes (status updates, cancellation, cleanup).
 * Plan creation itself now goes through the single-call
 * `create-recognize-episode-plan` pipeline; tests seed plans directly
 * on the filesystem via {@link seedPreparingPlan}.
 */

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

function makeInMemoryFs(options: { exists: (p: string) => boolean }): ChatFs & {
  readonly plans: Map<string, AnyPlan>;
} {
  const plans = new Map<string, AnyPlan>();
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
      plans.set(match[1], value as AnyPlan);
    },
    async exists(filePath: string): Promise<boolean> {
      return options.exists(filePath);
    },
  };
}

describe("plan cancellation (rejected status)", () => {
  let appDataDir: string;
  const fs = makeInMemoryFs({ exists: () => false });

  beforeAll(async () => {
    appDataDir = await mkdtemp(join(tmpdir(), "smm-plans-cancel-"));
  });

  afterAll(async () => {
    await rm(appDataDir, { recursive: true, force: true });
  });

  it("updatePlanContent keeps the plan file when status is 'rejected' (no delete)", async () => {
    const { updatePlanContent } = await import("./plans.ts");
    const taskId = randomUUID();
    await seedPreparingPlan(appDataDir, taskId, fs);

    const updated = await updatePlanContent(
      appDataDir,
      taskId,
      { status: "rejected" },
      fs,
    );
    expect(updated?.status).toBe("rejected");

    // The plan file must still be on disk so a still-in-flight AI
    // workflow can detect the cancellation via the persisted status.
    const planAfter = await readRecognizePlan(appDataDir, taskId, fs);
    expect(planAfter?.status).toBe("rejected");
  });

  it("updatePlanContent still deletes the plan file when status is 'completed' (regression)", async () => {
    // This test needs the real filesystem because `deletePlan` uses
    // `unlink` from `node:fs/promises` (the `ChatFs` abstraction does
    // not expose unlink), so the in-memory fs cannot model deletion.
    const realFs = await import("../chatFs.ts").then((m) => m.defaultChatFs());
    const { readPlanById, updatePlanContent } = await import("./plans.ts");
    const realAppDataDir = await mkdtemp(join(tmpdir(), "smm-plans-cancel-real-"));
    try {
      const taskId = randomUUID();
      await seedPreparingPlan(realAppDataDir, taskId, realFs);
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
    const preparingId = randomUUID();
    const pendingId = randomUUID();
    const rejectedId = randomUUID();
    await seedPreparingPlan(appDataDir, preparingId, fs);
    await seedPreparingPlan(appDataDir, pendingId, fs);
    await seedPreparingPlan(appDataDir, rejectedId, fs);

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
