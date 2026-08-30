import { describe, expect, it, vi } from "vitest";
import type { FsPort } from "../ports/FsPort";
import { createRenameEpisodePlanPipeline } from "./createRenameEpisodePlan";
import { metadataCachePath, planFilePath } from "./paths";

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

describe("createRenameEpisodePlanPipeline", () => {
  const appDataDir = "/data";
  const folder = "/m/Show";

  it("writes pending plan with posix paths", async () => {
    const mm = {
      mediaFolderPath: folder,
      type: "tvshow-folder" as const,
      mediaFiles: [{ absolutePath: "/m/Show/S01E01.mkv", seasonNumber: 1, episodeNumber: 1 }],
    };
    const fs = inMemoryFs({
      [metadataCachePath(appDataDir, folder)]: JSON.stringify(mm),
      "/m/Show/S01E01.mkv": "",
    });
    const plan = await createRenameEpisodePlanPipeline(
      folder,
      [{ from: "/m/Show/S01E01.mkv", to: "/m/Show/[1].mkv" }],
      { creator: "ai", id: "fixed-id" },
      {
        fs,
        appDataDir,
        normalizePosix: (p) => p,
        getMediaMetadata: async () => mm as never,
        createId: () => "fixed-id",
      },
    );
    expect(plan.status).toBe("pending");
    expect(plan.creator).toBe("ai");
    expect(plan.files[0]?.to).toBe("/m/Show/[1].mkv");
    expect(await fs.exists(planFilePath(appDataDir, "fixed-id"))).toBe(true);
  });

  it("rejects empty files when allowEmptyFiles is false", async () => {
    await expect(
      createRenameEpisodePlanPipeline(folder, [], { creator: "ai" }, {
        fs: inMemoryFs({}),
        appDataDir,
        normalizePosix: (p) => p,
        getMediaMetadata: async () => ({ mediaFolderPath: folder, type: "tvshow-folder", mediaFiles: [] }) as never,
      }),
    ).rejects.toThrow(/No rename entries/);
  });

  it("rejects when metadata missing", async () => {
    await expect(
      createRenameEpisodePlanPipeline(
        folder,
        [{ from: "/m/Show/a.mkv", to: "/m/Show/b.mkv" }],
        { creator: "ai" },
        {
          fs: inMemoryFs({}),
          appDataDir,
          normalizePosix: (p) => p,
          getMediaMetadata: async () => null,
        },
      ),
    ).rejects.toThrow(/not opened in SMM|Media metadata not found/);
  });
});
