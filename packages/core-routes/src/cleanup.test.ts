import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanupStalePlans } from "./cleanup.ts";
import { createPlan, listPlanFiles, readPlanById, updatePlanContent } from "./tools/plans.ts";
import { defaultChatFs } from "./chatFs.ts";
import type { CoreRoutesLogger } from "./types.ts";

/**
 * The `cleanupStalePlans` wrapper is intentionally thin, but we test
 * it end-to-end against a real filesystem to confirm:
 *
 * 1. The default `ChatFs` (`defaultChatFs()`) flows through correctly.
 * 2. The return value matches the underlying `cleanPreparingPlans`
 *    semantics — only `preparing` plans are removed; `pending` and
 *    `rejected` plans are kept.
 * 3. The optional logger receives lifecycle events (start, per-file,
 *    summary) so operators can trace what was cleaned.
 */
describe("cleanupStalePlans", () => {
  let appDataDir: string;
  const fs = defaultChatFs();

  beforeAll(async () => {
    appDataDir = await mkdtemp(join(tmpdir(), "smm-cleanup-stale-plans-"));
  });

  afterAll(async () => {
    await rm(appDataDir, { recursive: true, force: true });
  });

  it("uses the default ChatFs when none is provided", async () => {
    const preparingId = (
      await createPlan(appDataDir, { task: "recognize-media-file", mediaFolderPath: "/media/a", creator: "ai" }, fs)
    ).id;
    const pendingId = (
      await createPlan(appDataDir, { task: "recognize-media-file", mediaFolderPath: "/media/b", creator: "ai" }, fs)
    ).id;
    await updatePlanContent(appDataDir, pendingId, { status: "pending" }, fs);

    expect((await listPlanFiles(appDataDir)).length).toBe(2);

    // No `fs` argument — should use the bundled `defaultChatFs()`.
    const removed = await cleanupStalePlans(appDataDir);
    expect(removed).toBe(1);

    expect(await readPlanById(appDataDir, preparingId, fs)).toBeNull();
    expect((await readPlanById(appDataDir, pendingId, fs))?.status).toBe("pending");
  });

  it("accepts an explicit ChatFs override", async () => {
    const overrideDir = await mkdtemp(join(tmpdir(), "smm-cleanup-override-"));
    try {
      const id = (
        await createPlan(overrideDir, { task: "recognize-media-file", mediaFolderPath: "/media/c", creator: "ai" }, fs)
      ).id;

      // `defaultChatFs()` reads from disk; passing the same fs we used
      // to create the plan keeps the test hermetic.
      const removed = await cleanupStalePlans(overrideDir, fs);
      expect(removed).toBe(1);
      expect(await readPlanById(overrideDir, id, fs)).toBeNull();
    } finally {
      await rm(overrideDir, { recursive: true, force: true });
    }
  });

  it("logs scan/enumeration at debug and a completion summary at info", async () => {
    const logDir = await mkdtemp(join(tmpdir(), "smm-cleanup-logging-"));
    try {
      const keepingId = (
        await createPlan(logDir, { task: "recognize-media-file", mediaFolderPath: "/media/keep", creator: "ai" }, fs)
      ).id;
      await updatePlanContent(logDir, keepingId, { status: "pending" }, fs);
      const removingId = (
        await createPlan(logDir, { task: "recognize-media-file", mediaFolderPath: "/media/drop", creator: "ai" }, fs)
      ).id;

      const info = vi.fn();
      const debug = vi.fn();
      const warn = vi.fn();
      const error = vi.fn();
      const testLogger: CoreRoutesLogger = { info, debug, warn, error };

      const removed = await cleanupStalePlans(logDir, fs, testLogger);
      expect(removed).toBe(1);

      const infoMessages = info.mock.calls.map((c) => c[1] ?? "");
      expect(infoMessages).toEqual(["clean up plan succeeded"]);

      const summaryCall = info.mock.calls.find(
        (c) => c[1] === "clean up plan succeeded",
      );
      expect(summaryCall?.[0]).toMatchObject({
        scanned: 2,
        removed: 1,
        failed: 0,
      });
      expect(typeof (summaryCall?.[0] as { durationMs: number }).durationMs).toBe(
        "number",
      );

      const debugMessages = debug.mock.calls.map((c) => c[1] ?? "");
      expect(debugMessages).toEqual(
        expect.arrayContaining([
          "[cleanup] plan cleanup: scanning for stale preparing plans",
          "[cleanup] plan cleanup: enumerated plan files",
          "[cleanup] plan cleanup: removed stale preparing plan",
          "[cleanup] plan cleanup: keeping plan (not preparing)",
        ]),
      );

      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();

      expect(await readPlanById(logDir, removingId, fs)).toBeNull();
      expect((await readPlanById(logDir, keepingId, fs))?.status).toBe("pending");
    } finally {
      await rm(logDir, { recursive: true, force: true });
    }
  });

  it("warns and continues when a plan file cannot be processed", async () => {
    const logDir = await mkdtemp(join(tmpdir(), "smm-cleanup-bad-file-"));
    try {
      // One valid preparing plan + one corrupt JSON file.
      const goodId = (
        await createPlan(logDir, { task: "recognize-media-file", mediaFolderPath: "/media/good", creator: "ai" }, fs)
      ).id;
      const plansPath = join(logDir, "plans");
      const corruptPath = join(plansPath, "corrupt.plan.json");
      const { writeFile } = await import("node:fs/promises");
      await writeFile(corruptPath, "{ this is not valid json", "utf-8");

      const warn = vi.fn();
      const testLogger: CoreRoutesLogger = {
        info: vi.fn(),
        debug: vi.fn(),
        warn,
        error: vi.fn(),
      };

      const removed = await cleanupStalePlans(logDir, fs, testLogger);
      expect(removed).toBe(1);

      // The good plan was still cleaned up; the bad one was logged.
      expect(await readPlanById(logDir, goodId, fs)).toBeNull();
      const warnMessages = warn.mock.calls.map((c) => c[1] ?? "");
      expect(warnMessages).toContain(
        "[cleanup] plan cleanup: failed to process plan file, skipping",
      );

      // The summary reports the failure count.
      const summaryCall = (testLogger.info as ReturnType<typeof vi.fn>).mock.calls.find(
        (c) => c[1] === "clean up plan succeeded",
      );
      expect(summaryCall?.[0]).toMatchObject({ scanned: 2, removed: 1, failed: 1 });
    } finally {
      await rm(logDir, { recursive: true, force: true });
    }
  });

  it("logs clean up plan failed because … and rethrows on unexpected errors", async () => {
    const error = vi.fn();
    const info = vi.fn();
    const debug = vi.fn().mockImplementation(() => {
      throw new Error("disk full");
    });
    const testLogger: CoreRoutesLogger = {
      info,
      debug,
      warn: vi.fn(),
      error,
    };

    await expect(cleanupStalePlans(appDataDir, fs, testLogger)).rejects.toThrow(
      "disk full",
    );
    expect(error).toHaveBeenCalledWith(
      { error: "disk full" },
      "clean up plan failed because disk full",
    );
    expect(info).not.toHaveBeenCalled();
  });

  it("prefixes debug and warn cleanup detail messages with [cleanup]", async () => {
    const logDir = await mkdtemp(join(tmpdir(), "smm-cleanup-prefix-"));
    try {
      const goodId = (
        await createPlan(logDir, { task: "recognize-media-file", mediaFolderPath: "/media/good", creator: "ai" }, fs)
      ).id;
      const plansPath = join(logDir, "plans");
      const corruptPath = join(plansPath, "corrupt.plan.json");
      const { writeFile } = await import("node:fs/promises");
      await writeFile(corruptPath, "{ not valid json", "utf-8");

      const info = vi.fn();
      const debug = vi.fn();
      const warn = vi.fn();
      const error = vi.fn();
      const testLogger: CoreRoutesLogger = { info, debug, warn, error };

      await cleanupStalePlans(logDir, fs, testLogger);
      void goodId;

      const detailMessages = [
        ...debug.mock.calls,
        ...warn.mock.calls,
      ]
        .map((c) => c[1] ?? "")
        .filter(Boolean);

      expect(detailMessages.length).toBeGreaterThan(0);
      for (const msg of detailMessages) {
        expect(msg.startsWith("[cleanup] ")).toBe(true);
      }

      expect(info.mock.calls.map((c) => c[1])).toEqual(["clean up plan succeeded"]);
    } finally {
      await rm(logDir, { recursive: true, force: true });
    }
  });
});
