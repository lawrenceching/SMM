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
