import { describe, expect, it, vi } from "vitest";
import { executeGetJob } from "./getJob.ts";

describe("executeGetJob", () => {
  it("returns unavailable when runner is missing", async () => {
    const result = await executeGetJob("job-1", undefined);
    expect(result.error).toMatch(/not available/i);
  });

  it("returns job when found", async () => {
    const job = {
      kind: "scrape" as const,
      id: "job-1",
      folderPath: "/m/Show",
      status: "running" as const,
      tasks: {
        poster: { status: "completed" as const },
        fanart: { status: "running" as const },
        thumbnails: { status: "pending" as const },
        nfo: { status: "pending" as const },
      },
      createdAt: 1,
      updatedAt: 2,
    };
    const runner = vi.fn(() => job);
    const result = await executeGetJob("job-1", runner);
    expect(result.job).toEqual(job);
    expect(result.error).toBeUndefined();
  });

  it("returns not found when runner returns undefined", async () => {
    const result = await executeGetJob("missing", () => undefined);
    expect(result.error).toMatch(/Job not found/);
  });
});
