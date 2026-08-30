import { describe, expect, it, vi } from "vitest";
import type { MediaMetadata } from "@smm/core";
import { Core } from "./Core";
import type { FsPort } from "./ports/FsPort";
import type { NetworkPort } from "./ports/NetworkPort";
import {
  MetadataAlreadyExistsError,
  MetadataNotFoundError,
  MetadataValidationError,
} from "./pipeline/metadataErrors";
import type { MetadataPatch } from "./pipeline/setMetadataPatch";
import { metadataCachePath, userConfigPath } from "./pipeline/paths";

function inMemoryFs(): FsPort {
  const files = new Map<string, string>();
  return {
    readTextFile: vi.fn(async (path) => {
      const value = files.get(path);
      if (value === undefined) throw new Error(`ENOENT: ${path}`);
      return value;
    }),
    writeTextFile: vi.fn(async (path, content) => {
      files.set(path, content);
    }),
    writeBinaryFile: vi.fn(async () => {}),
    exists: vi.fn(async (path) => files.has(path)),
    listFiles: vi.fn(async () => []),
    listSubdirectories: vi.fn(async () => []),
    deleteFile: vi.fn(async (path) => {
      files.delete(path);
    }),
    rename: vi.fn(async () => {}),
    mkdir: vi.fn(async () => {}),
  };
}

const network: NetworkPort = {
  fetch: vi.fn(async () => {
    throw new Error("Unexpected network request");
  }),
};

function createCore(fs: FsPort): Core {
  return new Core({
    fs,
    network,
    appDataDir: "/data/internal",
    userDataDir: "/data/config",
    reportedAppDataDir: "/data/reported",
  });
}

const metadata: MediaMetadata = {
  mediaFolderPath: "/media/Show",
  type: "tvshow-folder",
  mediaFiles: [],
  tvShow: { id: "1", name: "Show", database: "TMDB", seasons: [] },
};

describe("Core metadata CRUD", () => {
  it("throws MetadataNotFoundError when metadata is missing", async () => {
    const core = createCore(inMemoryFs());

    await expect(core.getMetadata("/media/Missing")).rejects.toThrow(MetadataNotFoundError);
  });

  it("creates metadata and reads it back", async () => {
    const core = createCore(inMemoryFs());

    await expect(core.createMetadata(metadata)).resolves.toEqual(metadata);
    await expect(core.getMetadata(metadata.mediaFolderPath!)).resolves.toEqual(metadata);
  });

  it("throws MetadataAlreadyExistsError when creating metadata twice", async () => {
    const core = createCore(inMemoryFs());
    await core.createMetadata(metadata);

    await expect(core.createMetadata(metadata)).rejects.toThrow(MetadataAlreadyExistsError);
  });

  it("allows only one of two concurrent creates", async () => {
    const core = createCore(inMemoryFs());

    const results = await Promise.allSettled([
      core.createMetadata(metadata),
      core.createMetadata(metadata),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({
      reason: expect.any(MetadataAlreadyExistsError),
    });
  });

  it("merges an allowed patch into existing metadata", async () => {
    const core = createCore(inMemoryFs());
    await core.createMetadata(metadata);

    const updated = await core.setMetadata(metadata.mediaFolderPath!, {
      type: "movie-folder",
      movie: { id: "2", name: "Movie", database: "TMDB" },
    });

    expect(updated).toMatchObject({
      mediaFolderPath: "/media/Show",
      type: "movie-folder",
      movie: { id: "2", name: "Movie", database: "TMDB" },
    });
    expect(updated.tvShow).toEqual(metadata.tvShow);
  });

  it("preserves both concurrent metadata patches", async () => {
    const core = createCore(inMemoryFs());
    await core.createMetadata(metadata);

    await Promise.all([
      core.setMetadata(metadata.mediaFolderPath!, {
        movie: { id: "2", name: "Movie", database: "TMDB" },
      }),
      core.setMetadata(metadata.mediaFolderPath!, {
        mediaFiles: [{ absolutePath: "/media/Show/S01E01.mkv" }],
      }),
    ]);

    await expect(core.getMetadata(metadata.mediaFolderPath!)).resolves.toMatchObject({
      movie: { id: "2", name: "Movie", database: "TMDB" },
      mediaFiles: [{ absolutePath: "/media/Show/S01E01.mkv" }],
    });
  });

  it("throws MetadataNotFoundError when patching missing metadata", async () => {
    const core = createCore(inMemoryFs());

    await expect(core.setMetadata("/media/Missing", { type: "movie-folder" })).rejects.toThrow(
      MetadataNotFoundError,
    );
  });

  it("throws MetadataValidationError for an illegal patch key", async () => {
    const core = createCore(inMemoryFs());
    await core.createMetadata(metadata);
    const illegalPatch = { mediaFolderPath: "/media/Other" } as unknown as MetadataPatch;

    await expect(core.setMetadata(metadata.mediaFolderPath!, illegalPatch)).rejects.toThrow(
      MetadataValidationError,
    );
  });

  it("deletes metadata idempotently", async () => {
    const core = createCore(inMemoryFs());
    await core.createMetadata(metadata);

    await expect(core.deleteMetadata(metadata.mediaFolderPath!)).resolves.toBeUndefined();
    await expect(core.deleteMetadata(metadata.mediaFolderPath!)).resolves.toBeUndefined();
    await expect(core.getMetadata(metadata.mediaFolderPath!)).rejects.toThrow(MetadataNotFoundError);
  });

  it("stores metadata under reportedAppDataDir and config under userDataDir", async () => {
    const fs = inMemoryFs();
    const core = createCore(fs);

    await core.createMetadata(metadata);
    await core.setUserConfigKey("dryRun", true);

    expect(await fs.exists(metadataCachePath("/data/reported", metadata.mediaFolderPath!))).toBe(true);
    expect(await fs.exists(userConfigPath("/data/config"))).toBe(true);
    expect(await fs.exists(metadataCachePath("/data/internal", metadata.mediaFolderPath!))).toBe(false);
    expect(await fs.exists(userConfigPath("/data/internal"))).toBe(false);
  });

  it("recognizes episodes from the same metadata root used by CRUD", async () => {
    const fs = inMemoryFs();
    const core = createCore(fs);
    const metadataWithEpisodes: MediaMetadata = {
      ...metadata,
      tvShow: {
        ...metadata.tvShow!,
        seasons: [
          {
            season: 1,
            name: "Season 1",
            episodes: [{ season: 1, episode: 1, name: "Pilot" }],
          },
        ],
      },
    };
    await core.setUserConfigKey("folders", [metadata.mediaFolderPath!]);
    await core.createMetadata(metadataWithEpisodes);

    await expect(core.tryToRecognizeEpisodes(metadata.mediaFolderPath!)).resolves.toMatchObject({
      mediaFolderPath: metadata.mediaFolderPath,
      task: "recognize-media-file",
    });
  });
});
