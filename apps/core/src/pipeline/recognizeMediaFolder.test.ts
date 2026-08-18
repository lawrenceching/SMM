import { describe, expect, it, vi } from "vitest";
import type { MediaMetadata, TvShowMediaMetadata } from "@smm/core";
import type { FsPort } from "../ports/FsPort";
import {
  getTmdbIdFromFolderName,
  getTvdbIdFromFolderName,
  recognizeMediaFolder,
  type RecognitionDeps,
  type TmdbRecognitionClient,
  type TvdbRecognitionClient,
} from "./recognizeMediaFolder";

const tvShow: TvShowMediaMetadata = {
  database: "TMDB",
  id: "1",
  name: "My Show",
  seasons: [{ season: 1, name: "S1", episodes: [] }],
};

function fsPort(files: Record<string, string>): FsPort {
  return {
    readTextFile: vi.fn(async (path: string) => {
      const content = files[path];
      if (content === undefined) throw new Error("ENOENT: " + path);
      return content;
    }),
    writeTextFile: vi.fn(async () => {}),
    exists: vi.fn(async () => true),
    listFiles: vi.fn(async () => []),
    deleteFile: vi.fn(async () => {}),
    rename: vi.fn(async () => {}),
  };
}

function deps(overrides: Partial<RecognitionDeps> = {}): RecognitionDeps {
  return {
    fs: fsPort({}),
    tmdb: {
      search: vi.fn(),
      getTvShowMediaMetadata: vi.fn(),
      getMovieMediaMetadata: vi.fn(),
    } as unknown as TmdbRecognitionClient,
    tvdb: {
      searchSeries: vi.fn(),
      searchMovie: vi.fn(),
      getTvShowMediaMetadata: vi.fn(),
      getMovieMediaMetadata: vi.fn(),
    } as unknown as TvdbRecognitionClient,
    language: "en-US",
    primaryDatabase: "TMDB",
    ...overrides,
  };
}

describe("getTmdbIdFromFolderName / getTvdbIdFromFolderName", () => {
  it("parses (tmdbid=123) and (tvdbid=456)", () => {
    expect(getTmdbIdFromFolderName("Show (tmdbid=123)")).toBe("123");
    expect(getTvdbIdFromFolderName("Show [tvdbid=456]")).toBe("456");
    expect(getTmdbIdFromFolderName("Plain Name")).toBeNull();
  });
});

describe("recognizeMediaFolder", () => {
  it("recognizes via tmdbid in folder name (tvshow)", async () => {
    const d = deps();
    (d.tmdb.getTvShowMediaMetadata as ReturnType<typeof vi.fn>).mockResolvedValue(tvShow);

    const mm: MediaMetadata = { mediaFolderPath: "/m/My.Show (tmdbid=1)", type: "tvshow-folder", files: [] };
    const result = await recognizeMediaFolder(mm, d);

    expect(result.tvShow).toEqual(tvShow);
    expect(d.tmdb.getTvShowMediaMetadata).toHaveBeenCalledWith(1, "en-US");
  });

  it("recognizes via tvshow.nfo (tvshow)", async () => {
    const d = deps({ fs: fsPort({ "/m/My.Show/tvshow.nfo": "<tvshow><tmdbid>7</tmdbid></tvshow>" }) });
    (d.tmdb.getTvShowMediaMetadata as ReturnType<typeof vi.fn>).mockResolvedValue(tvShow);

    const mm: MediaMetadata = { mediaFolderPath: "/m/My.Show", type: "tvshow-folder", files: ["/m/My.Show/tvshow.nfo", "/m/My.Show/S01E01.mkv"] };
    const result = await recognizeMediaFolder(mm, d);

    expect(result.tvShow?.id).toBe("1");
    expect(d.tmdb.getTvShowMediaMetadata).toHaveBeenCalledWith(7, "en-US");
  });

  it("searches TMDB by folder name when no id present", async () => {
    const d = deps();
    (d.tmdb.search as ReturnType<typeof vi.fn>).mockResolvedValue({ results: [{ id: 9, name: "My Show" }] });
    (d.tmdb.getTvShowMediaMetadata as ReturnType<typeof vi.fn>).mockResolvedValue(tvShow);

    const mm: MediaMetadata = { mediaFolderPath: "/m/My Show", type: "tvshow-folder", files: [] };
    const result = await recognizeMediaFolder(mm, d);

    expect(result.tvShow?.id).toBe("1");
    expect(d.tmdb.search).toHaveBeenCalledWith("My Show", "tv", "en-US");
    expect(d.tmdb.getTvShowMediaMetadata).toHaveBeenCalledWith(9, "en-US");
  });

  it("searches TVDB before TMDB when primaryDatabase is TVDB", async () => {
    const d = deps({ primaryDatabase: "TVDB" });
    (d.tvdb.searchSeries as ReturnType<typeof vi.fn>).mockResolvedValue([
      { objectID: "series-5", name: "My Show", tvdb_id: "5" },
    ]);
    (d.tvdb.getTvShowMediaMetadata as ReturnType<typeof vi.fn>).mockResolvedValue(tvShow);

    const mm: MediaMetadata = { mediaFolderPath: "/m/My Show", type: "tvshow-folder", files: [] };
    const result = await recognizeMediaFolder(mm, d);

    expect(result.tvShow?.id).toBe("1");
    expect(d.tvdb.getTvShowMediaMetadata).toHaveBeenCalledWith(5, "en-US");
    expect(d.tmdb.search).not.toHaveBeenCalled();
  });

  it("recognizes a movie by exact TMDB title match", async () => {
    const d = deps();
    (d.tmdb.search as ReturnType<typeof vi.fn>).mockResolvedValue({
      results: [{ id: 2, title: "My Film" }],
    });

    const mm: MediaMetadata = { mediaFolderPath: "/m/My Film", type: "movie-folder", files: [] };
    const result = await recognizeMediaFolder(mm, d);

    expect(result.movie).toEqual({ id: "2", name: "My Film", database: "TMDB" });
  });

  it("continues the TVDB search loop when one result's metadata throws", async () => {
    const d = deps({ primaryDatabase: "TVDB" });
    (d.tvdb.searchSeries as ReturnType<typeof vi.fn>).mockResolvedValue([
      { objectID: "series-1", name: "My Show", tvdb_id: "1" },
      { objectID: "series-2", name: "My Show", tvdb_id: "2" },
    ]);
    (d.tvdb.getTvShowMediaMetadata as ReturnType<typeof vi.fn>).mockImplementation(async (id: number) => {
      if (id === 1) throw new Error("no translation in preferred language");
      return tvShow;
    });

    const mm: MediaMetadata = { mediaFolderPath: "/m/My Show", type: "tvshow-folder", files: [] };
    const result = await recognizeMediaFolder(mm, d);

    expect(result.tvShow?.id).toBe("1");
    expect(d.tvdb.getTvShowMediaMetadata).toHaveBeenCalledTimes(2);
  });

  it("returns an empty result when nothing matches", async () => {
    const d = deps();
    (d.tmdb.search as ReturnType<typeof vi.fn>).mockResolvedValue({ results: [] });
    (d.tvdb.searchSeries as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const mm: MediaMetadata = { mediaFolderPath: "/m/Unknown", type: "tvshow-folder", files: [] };
    const result = await recognizeMediaFolder(mm, d);

    expect(result).toEqual({});
  });

  it("falls through to the search phases when the tmdbid fetch throws", async () => {
    const d = deps();
    (d.tmdb.getTvShowMediaMetadata as ReturnType<typeof vi.fn>).mockImplementation(async (id: number) => {
      if (id === 1) throw new Error("network down");
      return tvShow;
    });
    (d.tmdb.search as ReturnType<typeof vi.fn>).mockResolvedValue({ results: [{ id: 9, name: "My Show" }] });

    const mm: MediaMetadata = { mediaFolderPath: "/m/My.Show (tmdbid=1)", type: "tvshow-folder", files: [] };
    const result = await recognizeMediaFolder(mm, d);

    expect(result.tvShow?.id).toBe("1");
    expect(d.tmdb.search).toHaveBeenCalled();
  });
});
