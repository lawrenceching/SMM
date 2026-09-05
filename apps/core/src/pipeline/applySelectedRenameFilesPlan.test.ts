import { describe, expect, it, vi } from "vitest";
import type { MediaMetadata } from "@smm/types";
import type { RenameFilesPlan } from "@smm/types/RenameFilesPlan";
import type { FsPort } from "../ports/FsPort";
import { metadataCachePath, planFilePath } from "./paths";
import {
  applySelectedRenameFilesPlanPipeline,
  SelectedFilesNotInPlanError,
} from "./applySelectedRenameFilesPlan";
import { applyPlanPipeline } from "./applyPlan";

const appDataDir = "/data";
const folder = "/m/Show";

function inMemoryFs(seed: Record<string, string> = {}): FsPort & { raw: Map<string, string> } {
  const files = new Map(Object.entries(seed));
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
      return [...files.keys()].filter((p) => p.startsWith(prefix));
    }),
    deleteFile: vi.fn(async (path: string) => {
      files.delete(path);
    }),
    rename: vi.fn(async (from: string, to: string) => {
      const v = files.get(from);
      if (v === undefined) throw new Error("ENOENT: " + from);
      files.delete(from);
      files.set(to, v);
    }),
    mkdir: vi.fn(async () => {}),
    listSubdirectories: vi.fn(async () => []),
  };
}

function basePlan(): RenameFilesPlan {
  return {
    id: "plan-1",
    task: "rename-files",
    status: "pending",
    creator: "app",
    mediaFolderPath: folder,
    files: [
      { from: `${folder}/old1.mkv`, to: `${folder}/S01E01.mkv` },
      { from: `${folder}/old2.mkv`, to: `${folder}/S01E02.mkv` },
    ],
  };
}

function baseMetadata(): MediaMetadata {
  return {
    mediaFolderPath: folder,
    type: "tvshow-folder",
    mediaFiles: [
      { absolutePath: `${folder}/old1.mkv`, seasonNumber: 1, episodeNumber: 1 },
      { absolutePath: `${folder}/old2.mkv`, seasonNumber: 1, episodeNumber: 2 },
    ],
  } as never;
}

function baseDeps(fs: ReturnType<typeof inMemoryFs>) {
  return {
    fs,
    appDataDir,
    normalizePosix: (p: string) => p,
    getMediaMetadata: async () => baseMetadata(),
    setMetadata: vi.fn(async (_mm: MediaMetadata) => {}),
  };
}

function seedFs(plan: RenameFilesPlan) {
  return inMemoryFs({
    [planFilePath(appDataDir, plan.id)]: JSON.stringify(plan),
    [`${folder}/old1.mkv`]: "v1",
    [`${folder}/old1.srt`]: "srt",
    [`${folder}/old2.mkv`]: "v2",
  });
}

describe("applySelectedRenameFilesPlanPipeline", () => {
  it("applies only the selected entries and leaves the original rejected", async () => {
    const plan = basePlan();
    const fs = seedFs(plan);
    const deps = baseDeps(fs);

    await applySelectedRenameFilesPlanPipeline(plan, [`${folder}/old1.mkv`], deps);

    expect(fs.raw.has(`${folder}/S01E01.mkv`)).toBe(true);
    expect(fs.raw.has(`${folder}/old1.mkv`)).toBe(false);
    expect(fs.raw.has(`${folder}/S01E01.srt`)).toBe(true);
    expect(fs.raw.has(`${folder}/old1.srt`)).toBe(false);
    expect(fs.raw.has(`${folder}/old2.mkv`)).toBe(true);
    expect(fs.raw.has(`${folder}/S01E02.mkv`)).toBe(false);

    const planFiles = [...fs.raw.keys()].filter((p) => p.endsWith(".plan.json"));
    expect(planFiles).toEqual([planFilePath(appDataDir, "plan-1")]);
    const rejected = JSON.parse(fs.raw.get(planFilePath(appDataDir, "plan-1"))!);
    expect(rejected.status).toBe("rejected");

    expect(deps.setMetadata).toHaveBeenCalledTimes(1);
    const mm = deps.setMetadata.mock.calls[0]![0] as MediaMetadata;
    expect(mm.mediaFiles?.map((f) => f.absolutePath)).toEqual([
      `${folder}/S01E01.mkv`,
      `${folder}/old2.mkv`,
    ]);
  });

  it("throws SelectedFilesNotInPlanError and changes nothing for unknown files", async () => {
    const plan = basePlan();
    const fs = seedFs(plan);
    const deps = baseDeps(fs);
    const before = new Map(fs.raw);

    const error = await applySelectedRenameFilesPlanPipeline(plan, [`${folder}/nope.mkv`], deps).then(
      () => null,
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(SelectedFilesNotInPlanError);
    expect((error as SelectedFilesNotInPlanError).files).toEqual([`${folder}/nope.mkv`]);
    expect(fs.raw).toEqual(before);
    expect(deps.setMetadata).not.toHaveBeenCalled();
  });

  it("throws for an empty selection", async () => {
    const plan = basePlan();
    const fs = seedFs(plan);
    const deps = baseDeps(fs);

    await expect(
      applySelectedRenameFilesPlanPipeline(plan, [], deps),
    ).rejects.toThrow(/non-empty/);
  });

  it("matches selected files written with windows separators", async () => {
    const plan = basePlan();
    const fs = seedFs(plan);
    const deps = baseDeps(fs);
    const winPath = `${folder}/old1.mkv`.replaceAll("/", "\\");

    await expect(
      applySelectedRenameFilesPlanPipeline(plan, [winPath], deps),
    ).resolves.toBeUndefined();

    expect(fs.raw.has(`${folder}/S01E01.mkv`)).toBe(true);
  });
});

describe("applyPlanPipeline dispatch with data", () => {
  it("routes data.files to the selected pipeline", async () => {
    const plan = basePlan();
    const fs = seedFs(plan);
    const deps = baseDeps(fs);

    await applyPlanPipeline(plan, deps, { files: [`${folder}/old1.mkv`] });

    expect(fs.raw.has(`${folder}/S01E01.mkv`)).toBe(true);
    expect(fs.raw.has(`${folder}/S01E02.mkv`)).toBe(false);
    const planFiles = [...fs.raw.keys()].filter((p) => p.endsWith(".plan.json"));
    expect(planFiles).toEqual([planFilePath(appDataDir, "plan-1")]);
  });

  it("applies everything when data is absent", async () => {
    const plan = basePlan();
    const fs = seedFs(plan);
    const deps = baseDeps(fs);

    await applyPlanPipeline(plan, deps);

    expect(fs.raw.has(`${folder}/S01E01.mkv`)).toBe(true);
    expect(fs.raw.has(`${folder}/S01E02.mkv`)).toBe(true);
    const planFiles = [...fs.raw.keys()].filter((p) => p.endsWith(".plan.json"));
    expect(planFiles).toEqual([]);
  });

  it("rejects unknown data.files for recognize-media-file plans", async () => {
    const plan = {
      id: "rec-1",
      task: "recognize-media-file" as const,
      status: "pending" as const,
      creator: "app" as const,
      mediaFolderPath: folder,
      files: [{ season: 1, episode: 2, path: `${folder}/old1.mkv` }],
    };
    const fs = inMemoryFs({
      [planFilePath(appDataDir, "rec-1")]: JSON.stringify(plan),
      [`${folder}/old1.mkv`]: "v1",
    });
    const deps = baseDeps(fs);

    await expect(
      applyPlanPipeline(plan, deps, { files: [`${folder}/nope.mkv`] }),
    ).rejects.toMatchObject({ name: "RecognizedFilesNotInPlanError" });

    expect(deps.setMetadata).not.toHaveBeenCalled();
    expect(fs.raw.has(planFilePath(appDataDir, "rec-1"))).toBe(true);
  });

  it("applies selected data.files for recognize-media-file plans", async () => {
    const plan = {
      id: "rec-1",
      task: "recognize-media-file" as const,
      status: "pending" as const,
      creator: "app" as const,
      mediaFolderPath: folder,
      files: [
        { season: 1, episode: 1, path: `${folder}/old1.mkv` },
        { season: 1, episode: 2, path: `${folder}/old2.mkv` },
      ],
    };
    const fs = inMemoryFs({
      [metadataCachePath(appDataDir, folder)]: JSON.stringify(baseMetadata()),
      [planFilePath(appDataDir, "rec-1")]: JSON.stringify(plan),
      [`${folder}/old1.mkv`]: "v1",
    });
    const deps = {
      fs,
      appDataDir,
      normalizePosix: (p: string) => p,
      getMediaMetadata: async () =>
        JSON.parse(fs.raw.get(metadataCachePath(appDataDir, folder))!) as MediaMetadata,
      setMetadata: vi.fn(async (mm: MediaMetadata) => {
        fs.raw.set(metadataCachePath(appDataDir, folder), JSON.stringify(mm));
      }),
    };

    await applyPlanPipeline(plan, deps, { files: [`${folder}/old1.mkv`] });

    const mm = JSON.parse(fs.raw.get(metadataCachePath(appDataDir, folder))!) as MediaMetadata;
    expect(mm.mediaFiles?.find((f) => f.absolutePath === `${folder}/old1.mkv`)?.episodeNumber).toBe(1);
    expect(fs.raw.has(planFilePath(appDataDir, "rec-1"))).toBe(false);
  });
});
