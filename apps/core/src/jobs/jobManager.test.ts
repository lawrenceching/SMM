import { describe, expect, it } from "vitest";
import { JobAbortError } from "./jobAbortError";
import { JobManager } from "./jobManager";

function createImport(manager: JobManager) {
  return manager.create({
    kind: "import",
    folderPath: "/m/My.Show",
    type: "tvshow",
    status: "running",
    stage: "persistFolder",
    progress: 0,
  });
}

describe("JobManager", () => {
  it("creates a job with id and timestamps", () => {
    const manager = new JobManager();
    const handle = createImport(manager);

    expect(handle.id).toBeTruthy();
    const stored = manager.get(handle.id);
    expect(stored?.kind).toBe("import");
    expect(stored?.kind === "import" && stored.folderPath).toBe("/m/My.Show");
    expect(stored?.createdAt).toBeGreaterThan(0);
    expect(stored?.updatedAt).toBeGreaterThanOrEqual(stored!.createdAt);
  });

  it("update patches fields and bumps updatedAt", async () => {
    const manager = new JobManager();
    const handle = manager.create({
      kind: "import",
      folderPath: "/m",
      type: "movie",
      status: "running",
      stage: null,
      progress: 0,
    });
    const firstUpdatedAt = manager.get(handle.id)!.updatedAt;

    await new Promise((r) => setTimeout(r, 5));
    handle.update({ status: "succeeded", stage: null, progress: 100 });

    const updated = manager.get(handle.id);
    expect(updated?.status).toBe("succeeded");
    expect(updated?.kind === "import" && updated.progress).toBe(100);
    expect(updated?.updatedAt).toBeGreaterThan(firstUpdatedAt);
  });

  it("update on unknown id is a no-op", () => {
    const manager = new JobManager();
    expect(() => manager.update("nope", { status: "failed" })).not.toThrow();
  });

  it("get returns a snapshot (mutating it does not affect the store)", () => {
    const manager = new JobManager();
    const handle = manager.create({
      kind: "import",
      folderPath: "/m",
      type: "music",
      status: "running",
      stage: null,
      progress: 0,
    });
    const snapshot = manager.get(handle.id);
    snapshot!.status = "failed";
    expect(manager.get(handle.id)?.status).toBe("running");
  });

  it("appendLog is readable via getLog and is not on the get() snapshot", () => {
    const manager = new JobManager();
    const handle = createImport(manager);
    handle.appendLog("info", "persisted folder");
    const lines = manager.getLog(handle.id);
    expect(lines).toEqual([
      expect.objectContaining({ level: "info", message: "persisted folder" }),
    ]);
    expect(lines![0]!.ts).toBeGreaterThan(0);
    expect(manager.get(handle.id) as { logs?: unknown }).not.toHaveProperty("logs");
  });

  it("getLog returns a copy", () => {
    const manager = new JobManager();
    const handle = createImport(manager);
    handle.appendLog("info", "a");
    const lines = manager.getLog(handle.id)!;
    lines.push({ ts: 1, level: "error", message: "injected" });
    expect(manager.getLog(handle.id)).toHaveLength(1);
  });

  it("requestStop then throwIfAborted throws JobAbortError", () => {
    const manager = new JobManager();
    const handle = createImport(manager);
    handle.requestStop();
    expect(() => handle.throwIfAborted()).toThrow(JobAbortError);
  });

  it("throwIfAborted is a no-op before requestStop", () => {
    const manager = new JobManager();
    const handle = createImport(manager);
    expect(() => handle.throwIfAborted()).not.toThrow();
  });

  it("ignores appendLog and update after a terminal status", () => {
    const manager = new JobManager();
    const handle = createImport(manager);
    handle.appendLog("info", "before");
    handle.update({ status: "succeeded", progress: 100 });
    handle.appendLog("info", "after");
    handle.update({ status: "failed", error: "nope" });
    const job = manager.get(handle.id);
    expect(job?.status).toBe("succeeded");
    expect(job?.error).toBeUndefined();
    expect(manager.getLog(handle.id)?.map((l) => l.message)).toEqual(["before"]);
  });

  it("getLog returns undefined for unknown id", () => {
    expect(new JobManager().getLog("missing")).toBeUndefined();
  });
});
