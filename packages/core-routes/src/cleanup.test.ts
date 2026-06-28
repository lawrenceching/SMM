import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanupStalePlans } from "./cleanup.ts";
import { beginRecognizePlan, listPlanFiles, readPlanById, updatePlanContent } from "./tools/plans.ts";
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
    const preparingId = await beginRecognizePlan(appDataDir, "/media/a", fs);
    const pendingId = await beginRecognizePlan(appDataDir, "/media/b", fs);
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
      const id = await beginRecognizePlan(overrideDir, "/media/c", fs);

      // `defaultChatFs()` reads from disk; passing the same fs we used
      // to create the plan keeps the test hermetic.
      const removed = await cleanupStalePlans(overrideDir, fs);
      expect(removed).toBe(1);
      expect(await readPlanById(overrideDir, id, fs)).toBeNull();
    } finally {
      await rm(overrideDir, { recursive: true, force: true });
    }
  });

  it("logs start, per-file decisions, and a completion summary", async () => {
    const logDir = await mkdtemp(join(tmpdir(), "smm-cleanup-logging-"));
    try {
      const keepingId = await beginRecognizePlan(logDir, "/media/keep", fs);
      await updatePlanContent(logDir, keepingId, { status: "pending" }, fs);
      const removingId = await beginRecognizePlan(logDir, "/media/drop", fs);

      const info = vi.fn();
      const debug = vi.fn();
      const warn = vi.fn();
      const error = vi.fn();
      const testLogger: CoreRoutesLogger = { info, debug, warn, error };

      const removed = await cleanupStalePlans(logDir, fs, testLogger);
      expect(removed).toBe(1);

      // Lifecycle: scan start, enumeration, completion summary.
      const infoMessages = info.mock.calls.map((c) => c[1] ?? "");
      expect(infoMessages).toEqual(
        expect.arrayContaining([
          "[cleanup] plan cleanup: scanning for stale preparing plans",
          "[cleanup] plan cleanup: enumerated plan files",
          "[cleanup] plan cleanup: complete",
        ]),
      );

      // The completion summary carries the counts operators need.
      const summaryCall = info.mock.calls.find(
        (c) => c[1] === "[cleanup] plan cleanup: complete",
      );
      expect(summaryCall?.[0]).toMatchObject({
        scanned: 2,
        removed: 1,
        failed: 0,
      });
      expect(typeof (summaryCall?.[0] as { durationMs: number }).durationMs).toBe(
        "number",
      );

      // Per-file decisions show up at debug level.
      const debugMessages = debug.mock.calls.map((c) => c[1] ?? "");
      expect(debugMessages).toEqual(
        expect.arrayContaining([
          "[cleanup] plan cleanup: removed stale preparing plan",
          "[cleanup] plan cleanup: keeping plan (not preparing)",
        ]),
      );

      // No errors / warnings in the happy path.
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();

      // Sanity check: the cleanup really happened.
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
      const goodId = await beginRecognizePlan(logDir, "/media/good", fs);
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
        (c) => c[1] === "[cleanup] plan cleanup: complete",
      );
      expect(summaryCall?.[0]).toMatchObject({ scanned: 2, removed: 1, failed: 1 });
    } finally {
      await rm(logDir, { recursive: true, force: true });
    }
  });

  it("prefixes every emitted log message with [cleanup]", async () => {
    const logDir = await mkdtemp(join(tmpdir(), "smm-cleanup-prefix-"));
    try {
      const goodId = await beginRecognizePlan(logDir, "/media/good", fs);
      // Add a corrupt file so we exercise the warn path too.
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
      void goodId; // referenced for the side-effect of plan creation

      // Collect every msg string the function emitted across all levels.
      const allMessages = [
        ...info.mock.calls,
        ...debug.mock.calls,
        ...warn.mock.calls,
        ...error.mock.calls,
      ]
        .map((c) => c[1] ?? "")
        .filter(Boolean);

      // Every emitted message must start with the [cleanup] tag so
      // operators can `grep '[cleanup]'` the unified log stream.
      expect(allMessages.length).toBeGreaterThan(0);
      for (const msg of allMessages) {
        expect(msg.startsWith("[cleanup] ")).toBe(true);
      }
    } finally {
      await rm(logDir, { recursive: true, force: true });
    }
  });
});
