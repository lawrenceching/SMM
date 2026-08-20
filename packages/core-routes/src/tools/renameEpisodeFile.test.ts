import { describe, expect, it, vi } from "vitest";
import { executeRenameEpisodeFile } from "./renameEpisodeFile.ts";

describe("executeRenameEpisodeFile", () => {
  it("returns unavailable when runner is missing", async () => {
    const result = await executeRenameEpisodeFile(
      {
        mediaFolder: "/m/Show",
        from: "/m/Show/a.mp4",
        to: "/m/Show/b.mp4",
      },
      undefined,
    );
    expect(result.renamed).toBe(false);
    expect(result.error).toMatch(/not available/i);
  });

  it("maps runner success to renamed output", async () => {
    const runner = vi.fn(async () => ({
      succeeded: [{ from: "/m/Show/a.mp4", to: "/m/Show/b.mp4" }],
      failed: [],
    }));
    const result = await executeRenameEpisodeFile(
      {
        mediaFolder: "/m/Show",
        from: "/m/Show/a.mp4",
        to: "/m/Show/b.mp4",
      },
      runner,
    );
    expect(result.renamed).toBe(true);
    expect(result.succeeded).toHaveLength(1);
    expect(runner).toHaveBeenCalledOnce();
  });
});
