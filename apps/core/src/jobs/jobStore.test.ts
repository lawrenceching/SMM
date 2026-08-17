import { describe, expect, it } from "vitest";
import { JobStore } from "./jobStore";

describe("JobStore", () => {
  it("creates a job with id and timestamps", () => {
    const store = new JobStore();
    const job = store.create({
      folderPath: "/m/My.Show",
      type: "tvshow",
      status: "running",
      stage: "config",
      progress: 0,
    });

    expect(job.id).toBeTruthy();
    expect(job.createdAt).toBeGreaterThan(0);
    expect(job.updatedAt).toBeGreaterThanOrEqual(job.createdAt);
    expect(store.get(job.id)?.folderPath).toBe("/m/My.Show");
  });

  it("update patches fields and bumps updatedAt", async () => {
    const store = new JobStore();
    const job = store.create({ folderPath: "/m", type: "movie", status: "running", stage: null, progress: 0 });
    const firstUpdatedAt = job.updatedAt;

    await new Promise((r) => setTimeout(r, 5));
    store.update(job.id, { status: "succeeded", stage: null, progress: 100 });

    const updated = store.get(job.id);
    expect(updated?.status).toBe("succeeded");
    expect(updated?.progress).toBe(100);
    expect(updated?.updatedAt).toBeGreaterThan(firstUpdatedAt);
  });

  it("update on unknown id is a no-op", () => {
    const store = new JobStore();
    expect(() => store.update("nope", { status: "failed" })).not.toThrow();
  });

  it("get returns a snapshot (mutating it does not affect the store)", () => {
    const store = new JobStore();
    const job = store.create({ folderPath: "/m", type: "music", status: "running", stage: null, progress: 0 });
    const snapshot = store.get(job.id);
    snapshot!.status = "failed";
    expect(store.get(job.id)?.status).toBe("running");
  });
});
