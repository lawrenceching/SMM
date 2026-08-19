import { describe, expect, it, vi } from "vitest";
import type { FsPort } from "../ports/FsPort";
import type { RecognizeMediaFilePlan } from "@smm/core/types/RecognizeMediaFilePlan";
import { planFilePath } from "./paths";
import { deletePlan, readPlan, writePlan } from "./plans";

function inMemoryFs(): FsPort & { raw: Map<string, string> } {
  const files = new Map<string, string>();
  return {
    raw: files,
    readTextFile: vi.fn(async (path: string) => {
      const v = files.get(path);
      if (v === undefined) throw new Error("ENOENT: " + path);
      return v;
    }),
    writeTextFile: vi.fn(async (path: string, content: string) => {
      files.set(path, content);
    }),
    exists: vi.fn(async (path: string) => files.has(path)),
    listFiles: vi.fn(async () => []),
    deleteFile: vi.fn(async (path: string) => {
      files.delete(path);
    }),
    rename: vi.fn(async () => {}),
    mkdir: vi.fn(async () => {}),
  };
}

describe("plans storage", () => {
  it("writes and reads a recognize plan", async () => {
    const fs = inMemoryFs();
    const plan: RecognizeMediaFilePlan = {
      id: "p1",
      task: "recognize-media-file",
      status: "pending",
      creator: "app",
      mediaFolderPath: "/m/Show",
      files: [{ season: 1, episode: 1, path: "/m/Show/S01E01.mkv" }],
    };
    await writePlan(fs, "/data", plan);
    expect(fs.raw.has(planFilePath("/data", "p1"))).toBe(true);
    await expect(readPlan(fs, "/data", "p1")).resolves.toEqual(plan);
  });

  it("deletePlan is idempotent", async () => {
    const fs = inMemoryFs();
    await deletePlan(fs, "/data", "missing");
    expect(fs.deleteFile).toHaveBeenCalledWith(planFilePath("/data", "missing"));
  });
});
