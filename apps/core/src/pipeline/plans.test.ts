import { describe, expect, it, vi } from "vitest";
import type { FsPort } from "../ports/FsPort";
import type { RecognizeMediaFilePlan } from "@smm/core/types/RecognizeMediaFilePlan";
import type { RenameFilesPlan } from "@smm/core/types/RenameFilesPlan";
import { planFilePath } from "./paths";
import { deletePlan, listPlans, readPlan, rejectPlan, writePlan } from "./plans";

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
    writeBinaryFile: vi.fn(async () => {}),
    exists: vi.fn(async (path: string) => files.has(path)),
    listFiles: vi.fn(async (dir: string) => {
      const prefix = dir.endsWith("/") ? dir : `${dir}/`;
      return [...files.keys()].filter((p) => p.startsWith(prefix) || p === dir);
    }),
    deleteFile: vi.fn(async (path: string) => {
      files.delete(path);
    }),
    rename: vi.fn(async () => {}),
    mkdir: vi.fn(async () => {}),
    listSubdirectories: vi.fn(async () => []),
  };
}

function recognizePlan(
  overrides: Partial<RecognizeMediaFilePlan> & Pick<RecognizeMediaFilePlan, "id" | "mediaFolderPath" | "status">,
): RecognizeMediaFilePlan {
  return {
    task: "recognize-media-file",
    creator: "app",
    files: [],
    ...overrides,
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

  it("listPlans returns only active plans by default", async () => {
    const fs = inMemoryFs();
    const pending = recognizePlan({ id: "a", mediaFolderPath: "/m/A", status: "pending" });
    const preparing = recognizePlan({ id: "b", mediaFolderPath: "/m/B", status: "preparing" });
    const rejected = recognizePlan({ id: "c", mediaFolderPath: "/m/A", status: "rejected" });
    await writePlan(fs, "/data", pending);
    await writePlan(fs, "/data", preparing);
    await writePlan(fs, "/data", rejected);

    const listed = await listPlans(fs, "/data");
    expect(listed.map((p) => p.id).sort()).toEqual(["a", "b"]);
  });

  it("listPlans all includes rejected", async () => {
    const fs = inMemoryFs();
    await writePlan(fs, "/data", recognizePlan({ id: "a", mediaFolderPath: "/m/A", status: "pending" }));
    await writePlan(fs, "/data", recognizePlan({ id: "c", mediaFolderPath: "/m/A", status: "rejected" }));

    const listed = await listPlans(fs, "/data", { all: true });
    expect(listed.map((p) => p.id).sort()).toEqual(["a", "c"]);
  });

  it("listPlans filters by mediaFolderPath", async () => {
    const fs = inMemoryFs();
    await writePlan(fs, "/data", recognizePlan({ id: "a", mediaFolderPath: "/m/A", status: "pending" }));
    await writePlan(fs, "/data", recognizePlan({ id: "b", mediaFolderPath: "/m/B", status: "pending" }));

    const listed = await listPlans(fs, "/data", { mediaFolderPath: "/m/A" });
    expect(listed.map((p) => p.id)).toEqual(["a"]);
  });

  it("listPlans returns empty when plans dir missing", async () => {
    const fs = inMemoryFs();
    fs.listFiles = vi.fn(async () => {
      throw new Error("ENOENT");
    });
    await expect(listPlans(fs, "/data")).resolves.toEqual([]);
  });

  it("rejectPlan sets status rejected and keeps file", async () => {
    const fs = inMemoryFs();
    const plan = recognizePlan({
      id: "p1",
      mediaFolderPath: "/m/Show",
      status: "pending",
      files: [{ season: 1, episode: 1, path: "/m/Show/S01E01.mkv" }],
    });
    await writePlan(fs, "/data", plan);

    const rejected = await rejectPlan(fs, "/data", "p1");
    expect(rejected.status).toBe("rejected");
    expect(await readPlan(fs, "/data", "p1")).toEqual(rejected);
  });

  it("rejectPlan throws when missing", async () => {
    const fs = inMemoryFs();
    await expect(rejectPlan(fs, "/data", "missing")).rejects.toThrow("Plan not found: missing");
  });

  it("listPlans can return rename-files plans", async () => {
    const fs = inMemoryFs();
    const rename: RenameFilesPlan = {
      id: "r1",
      task: "rename-files",
      status: "pending",
      creator: "app",
      mediaFolderPath: "/m/Show",
      files: [{ from: "/m/Show/a.mkv", to: "/m/Show/b.mkv" }],
    };
    await writePlan(fs, "/data", rename);
    const listed = await listPlans(fs, "/data");
    expect(listed).toEqual([rename]);
  });
});
