import { describe, expect, it, vi } from "vitest";
import type { MediaMetadata } from "@smm/types";
import type { RecognizeMediaFilePlan } from "@smm/types/RecognizeMediaFilePlan";
import type { FsPort } from "../ports/FsPort";
import { metadataCachePath, planFilePath } from "./paths";
import {
  applySelectedRecognizeFilesPlanPipeline,
  RecognizedFilesNotInPlanError,
} from "./applySelectedRecognizeFilesPlan";
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

const plan: RecognizeMediaFilePlan = {
  id: "plan-r1",
  task: "recognize-media-file",
  status: "pending",
  creator: "app",
  mediaFolderPath: folder,
  files: [
    { season: 1, episode: 1, path: `${folder}/ep1.mkv` },
    { season: 1, episode: 2, path: `${folder}/ep2.mkv` },
  ],
};

function seedMetadata(mediaFiles: MediaMetadata["mediaFiles"]): Record<string, string> {
  return {
    // Runtime cast: MediaMetadata has required fields the pipeline never reads.
    [metadataCachePath(appDataDir, folder)]: JSON.stringify({
      mediaFolderPath: folder,
      type: "tvshow-folder",
      mediaFiles: mediaFiles ?? [],
    } as unknown as MediaMetadata),
    [planFilePath(appDataDir, plan.id)]: JSON.stringify(plan),
  };
}

function makeDeps(fs: ReturnType<typeof inMemoryFs>) {
  return {
    fs,
    appDataDir,
    normalizePosix: (p: string) => p,
    getMediaMetadata: async (f: string) =>
      JSON.parse(fs.raw.get(metadataCachePath(appDataDir, f))!) as MediaMetadata,
    setMetadata: vi.fn(async (mm: MediaMetadata) => {
      fs.raw.set(metadataCachePath(appDataDir, folder), JSON.stringify(mm));
    }),
  };
}

describe("applySelectedRecognizeFilesPlanPipeline", () => {
  it("applies only the selected entries and deletes the plan", async () => {
    const fs = inMemoryFs(
      seedMetadata([{ absolutePath: `${folder}/ep1.mkv`, seasonNumber: 1, episodeNumber: 1 }]),
    );
    await applySelectedRecognizeFilesPlanPipeline(plan, [`${folder}/ep2.mkv`], makeDeps(fs));

    const mm = JSON.parse(fs.raw.get(metadataCachePath(appDataDir, folder))!) as MediaMetadata;
    const ep2 = mm.mediaFiles?.find((f) => f.absolutePath === `${folder}/ep2.mkv`);
    expect(ep2?.seasonNumber).toBe(1);
    expect(ep2?.episodeNumber).toBe(2);
    expect(await fs.exists(planFilePath(appDataDir, plan.id))).toBe(false);
  });

  it("throws RecognizedFilesNotInPlanError with offenders and writes nothing", async () => {
    const fs = inMemoryFs(seedMetadata([]));
    await expect(
      applySelectedRecognizeFilesPlanPipeline(plan, [`${folder}/other.mkv`], {
        fs,
        appDataDir,
        normalizePosix: (p) => p,
        getMediaMetadata: async () => null,
        setMetadata: async () => {},
      }),
    ).rejects.toMatchObject({
      name: "RecognizedFilesNotInPlanError",
      files: [`${folder}/other.mkv`],
    });
    expect(await fs.exists(planFilePath(appDataDir, plan.id))).toBe(true);
  });

  it("rejects an empty selection", async () => {
    const fs = inMemoryFs(seedMetadata([]));
    await expect(
      applySelectedRecognizeFilesPlanPipeline(plan, [], {
        fs,
        appDataDir,
        normalizePosix: (p) => p,
        getMediaMetadata: async () => null,
        setMetadata: async () => {},
      }),
    ).rejects.toThrow("data.files must be a non-empty array");
  });

  it("matches Windows-style separators in the selection", async () => {
    const fs = inMemoryFs(seedMetadata([]));
    await applySelectedRecognizeFilesPlanPipeline(plan, [`\\m\\Show\\ep1.mkv`], makeDeps(fs));
    const mm = JSON.parse(fs.raw.get(metadataCachePath(appDataDir, folder))!) as MediaMetadata;
    expect(mm.mediaFiles?.find((f) => f.absolutePath === `${folder}/ep1.mkv`)?.episodeNumber).toBe(1);
    expect(await fs.exists(planFilePath(appDataDir, plan.id))).toBe(false);
  });
});

describe("applyPlanPipeline dispatch (recognize-media-file)", () => {
  it("routes data.files to the selected pipeline", async () => {
    const fs = inMemoryFs(seedMetadata([]));
    await applyPlanPipeline(plan, makeDeps(fs), { files: [`${folder}/ep1.mkv`] });
    const mm = JSON.parse(fs.raw.get(metadataCachePath(appDataDir, folder))!) as MediaMetadata;
    expect(
      mm.mediaFiles?.some((f) => f.absolutePath === `${folder}/ep1.mkv` && f.episodeNumber === 1),
    ).toBe(true);
    expect(mm.mediaFiles?.find((f) => f.absolutePath === `${folder}/ep2.mkv`)).toBeUndefined();
  });

  it("keeps full merge when data is absent", async () => {
    const fs = inMemoryFs(seedMetadata([]));
    await applyPlanPipeline(plan, makeDeps(fs));
    const mm = JSON.parse(fs.raw.get(metadataCachePath(appDataDir, folder))!) as MediaMetadata;
    expect(mm.mediaFiles?.length).toBe(2);
  });
});
