import { describe, expect, it } from "vitest";
import type { FsPort } from "../ports/FsPort";
import { MediaMetadataHelper } from "./mediaMetadataHelper";
import { metadataCachePath } from "./paths";
import { validatePersistedMediaMetadata } from "./mediaMetadataValidation";

function inMemoryFs(seed: Record<string, string> = {}): FsPort {
  const files = new Map(Object.entries(seed));
  return {
    readTextFile: async (path: string) => {
      const v = files.get(path);
      if (v === undefined) throw new Error("ENOENT: " + path);
      return v;
    },
    writeTextFile: async (path: string, content: string) => {
      files.set(path, content);
    },
    writeBinaryFile: async () => {},
    exists: async (path: string) => files.has(path),
    listFiles: async () => [],
    deleteFile: async (path: string) => {
      files.delete(path);
    },
    rename: async () => {},
    mkdir: async () => {},
    listSubdirectories: async () => [],
  };
}

describe("MediaMetadataHelper", () => {
  const appDataDir = "/data/smm";
  const folder = "/m/Show";
  const cache = metadataCachePath(appDataDir, folder);

  it("write strips files and read never returns files", async () => {
    const fs = inMemoryFs();
    const helper = new MediaMetadataHelper(fs, appDataDir);

    await helper.write({
      mediaFolderPath: folder,
      type: "tvshow-folder",
      mediaFiles: [],
    });

    const saved = JSON.parse((await fs.readTextFile(cache)) as string) as Record<string, unknown>;
    expect(saved.files).toBeUndefined();
    expect(await helper.read(folder)).toEqual({
      mediaFolderPath: folder,
      type: "tvshow-folder",
      mediaFiles: [],
    });
  });

  it("rejects metadata without mediaFolderPath", async () => {
    const helper = new MediaMetadataHelper(inMemoryFs(), appDataDir);
    await expect(
      helper.write({ type: "tvshow-folder" } as Parameters<typeof helper.write>[0]),
    ).rejects.toThrow("mediaFolderPath is required");
  });

  it("delete is idempotent", async () => {
    const fs = inMemoryFs({
      [cache]: JSON.stringify({ mediaFolderPath: folder, type: "tvshow-folder" }),
    });
    const helper = new MediaMetadataHelper(fs, appDataDir);

    await helper.delete(folder);
    await helper.delete(folder);
    expect(await fs.exists(cache)).toBe(false);
  });

  it("move renames cache file under write lock", async () => {
    const fs = inMemoryFs({
      [cache]: JSON.stringify({ mediaFolderPath: folder, type: "tvshow-folder" }),
    });
    const helper = new MediaMetadataHelper(fs, appDataDir);
    const toFolder = "/m/ShowRenamed";
    const newCache = metadataCachePath(appDataDir, toFolder);

    await helper.move(folder, toFolder, {
      mediaFolderPath: toFolder,
      type: "tvshow-folder",
    });

    expect(await fs.exists(cache)).toBe(false);
    expect(await fs.exists(newCache)).toBe(true);
  });
});

describe("validatePersistedMediaMetadata", () => {
  it("strips deprecated files field", () => {
    const validated = validatePersistedMediaMetadata({
      mediaFolderPath: "/m/Show",
      type: "tvshow-folder",
      files: ["/m/Show/a.mkv"],
    });
    expect(validated).toEqual({
      mediaFolderPath: "/m/Show",
      type: "tvshow-folder",
    });
  });
});
