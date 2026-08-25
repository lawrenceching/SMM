import { describe, expect, it, vi } from "vitest";
import type { FsPort } from "../ports/FsPort";
import { metadataCachePath, userConfigPath } from "./paths";
import { UserConfig } from "./userConfig";
import {
  recognizeFolderPipeline,
  tryToRecognizeFolderPipeline,
  type RecognizeFolderDeps,
} from "./recognizeFolder";

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
    deleteFile: vi.fn(async (path: string) => {
      files.delete(path);
    }),
    rename: vi.fn(async () => {}),
    mkdir: vi.fn(async () => {}),
  };
}

function deps(partial: Partial<RecognizeFolderDeps> & { fs: FsPort; appDataDir: string }): RecognizeFolderDeps {
  const userConfig = new UserConfig(partial.fs, partial.appDataDir);
  return {
    userConfig,
    normalizePosix: (p) => p.replace(/\\/g, "/"),
    language: "en-US",
    tmdb: {
      search: vi.fn(async () => ({ results: [], page: 1, total_pages: 1, total_results: 0 })),
      getTvShowMediaMetadata: vi.fn(),
      getMovieMediaMetadata: vi.fn(),
    },
    tvdb: {
      searchSeries: vi.fn(async () => []),
      searchMovie: vi.fn(async () => []),
      getTvShowMediaMetadata: vi.fn(),
      getMovieMediaMetadata: vi.fn(),
    },
    ...partial,
  };
}

describe("tryToRecognizeFolderPipeline", () => {
  it("returns candidate from tmdbid in folder name without writing", async () => {
    const mm = {
      mediaFolderPath: "/m/Show {tmdbid=84666}",
      type: "tvshow-folder" as const,
      mediaFiles: [{ absolutePath: "/m/Show {tmdbid=84666}/S01E01.mkv", seasonNumber: 1, episodeNumber: 1 }],
    };
    const fs = inMemoryFs({
      [userConfigPath("/data")]: JSON.stringify({ folders: ["/m/Show {tmdbid=84666}"] }),
    });
    const d = deps({ fs, appDataDir: "/data" });
    const cachePath = metadataCachePath("/data", "/m/Show {tmdbid=84666}");
    await fs.writeTextFile(cachePath, JSON.stringify(mm));
    (d.tmdb.getTvShowMediaMetadata as ReturnType<typeof vi.fn>).mockResolvedValue({
      database: "TMDB",
      id: "84666",
      name: "WATATEN",
      airDate: "2019-01-08",
      seasons: [],
    });

    const candidate = await tryToRecognizeFolderPipeline("/m/Show {tmdbid=84666}", d);
    expect(candidate).toEqual({
      db: "tmdb",
      id: "84666",
      title: "WATATEN",
      year: "2019",
      kind: "tvshow",
    });
    const writes = (fs.writeTextFile as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([p]) => p === cachePath,
    );
    expect(writes).toHaveLength(1); // only the seed write above
  });

  it("throws when unmanaged", async () => {
    const fs = inMemoryFs({ [userConfigPath("/data")]: JSON.stringify({ folders: [] }) });
    const d = deps({ fs, appDataDir: "/data" });
    await expect(tryToRecognizeFolderPipeline("/m/Other", d)).rejects.toThrow(/not managed by SMM/);
  });
});

describe("recognizeFolderPipeline", () => {
  it("writes tvShow and clears mediaFiles", async () => {
    const mm = {
      mediaFolderPath: "/m/Show",
      type: "tvshow-folder" as const,
      mediaFiles: [{ absolutePath: "/m/Show/S01E01.mkv", seasonNumber: 1, episodeNumber: 1 }],
    };
    const fs = inMemoryFs({
      [userConfigPath("/data")]: JSON.stringify({ folders: ["/m/Show"] }),
    });
    const d = deps({ fs, appDataDir: "/data" });
    const cachePath = metadataCachePath("/data", "/m/Show");
    await fs.writeTextFile(cachePath, JSON.stringify(mm));
    (d.tmdb.getTvShowMediaMetadata as ReturnType<typeof vi.fn>).mockResolvedValue({
      database: "TMDB",
      id: "84666",
      name: "WATATEN",
      airDate: "2019-01-08",
      seasons: [{ season: 1, name: "Season 1", episodes: [] }],
    });

    await recognizeFolderPipeline("/m/Show", { db: "tmdb", id: "84666" }, d);

    const raw = await fs.readTextFile(cachePath);
    const saved = JSON.parse(raw) as typeof mm & { tvShow: { id: string }; movie?: unknown };
    expect(saved.tvShow.id).toBe("84666");
    expect(saved.mediaFiles).toEqual([]);
    expect(saved.movie).toBeUndefined();
  });

  it("maps IETF language to TVDB ISO 639-3 when fetching by id", async () => {
    const mm = {
      mediaFolderPath: "/m/Show",
      type: "tvshow-folder" as const,
      mediaFiles: [],
    };
    const fs = inMemoryFs({
      [userConfigPath("/data")]: JSON.stringify({ folders: ["/m/Show"] }),
    });
    const d = deps({ fs, appDataDir: "/data" });
    const cachePath = metadataCachePath("/data", "/m/Show");
    await fs.writeTextFile(cachePath, JSON.stringify(mm));
    (d.tvdb.getTvShowMediaMetadata as ReturnType<typeof vi.fn>).mockResolvedValue({
      database: "TVDB",
      id: "421069",
      name: "WATATEN",
      seasons: [],
    });

    await recognizeFolderPipeline("/m/Show", { db: "tvdb", id: "421069" }, d);

    expect(d.tvdb.getTvShowMediaMetadata).toHaveBeenCalledWith(421069, "eng");
    expect(d.tmdb.getTvShowMediaMetadata).not.toHaveBeenCalled();
  });
});
