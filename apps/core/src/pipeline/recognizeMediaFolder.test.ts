import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Path } from "@smm/utils/path";
import type { MediaMetadata, MovieMediaMetadata, TvShowMediaMetadata } from "@smm/types";
import {
  createFolderInTestFolder,
  folder1,
  folder2,
  folder3,
  folder4,
  folder5,
  type TestFolder,
} from "@smm/test";
import { NodejsFsAdapter } from "../adapters/node/NodejsFsAdapter";
import {
  getTmdbIdFromFolderName,
  getTvdbIdFromFolderName,
  recognizeMediaFolder,
  type RecognitionDeps,
  type TmdbRecognitionClient,
  type TvdbRecognitionClient,
} from "./recognizeMediaFolder";

const tvShowFixture: TvShowMediaMetadata = {
  database: "TMDB",
  id: "84666",
  name: "WATATEN!: an Angel Flew Down to Me",
  seasons: [{ season: 1, name: "Season 1", episodes: [] }],
};

const movieFixture: MovieMediaMetadata = {
  database: "TMDB",
  id: "1539104",
  name: "咒术回战 涩谷事变×死灭回游 剧场版",
};

const darkKnightMovie: MovieMediaMetadata = {
  database: "TVDB",
  id: "116",
  name: "The Dark Knight",
};

const fs = new NodejsFsAdapter();

let mediaDir: string;

function deps(overrides: Partial<RecognitionDeps> = {}): RecognitionDeps {
  return {
    fs,
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

function writeNfo(folderPath: string, fileName: string, xml: string): void {
  writeFileSync(join(folderPath, fileName), xml, "utf-8");
}

async function mediaMetadataFrom(created: TestFolder): Promise<MediaMetadata> {
  const folderPosix = Path.posix(created.path!);
  const type =
    created.type === "tvshow"
      ? "tvshow-folder"
      : created.type === "movie"
        ? "movie-folder"
        : "music-folder";
  return {
    mediaFolderPath: folderPosix,
    type,
  };
}

describe("getTmdbIdFromFolderName / getTvdbIdFromFolderName", () => {
  it("parses ids from shared folder fixtures", () => {
    expect(getTmdbIdFromFolderName(folder1.folderName)).toBe("84666");
    expect(getTvdbIdFromFolderName(folder4.folderName)).toBe("421069");
    expect(getTvdbIdFromFolderName(folder5.folderName)).toBe("116");
    expect(getTmdbIdFromFolderName(folder3.folderName)).toBeNull();
  });
});

describe("recognizeMediaFolder", () => {
  beforeEach(() => {
    mediaDir = mkdtempSync(join(tmpdir(), "smm-recognize-media-folder-"));
  });

  afterEach(() => {
    rmSync(mediaDir, { recursive: true, force: true });
  });

  it("recognizes TV show via tmdbid in folder name (folder1 fixture)", async () => {
    const d = deps();
    (d.tmdb.getTvShowMediaMetadata as ReturnType<typeof vi.fn>).mockResolvedValue(tvShowFixture);

    const created = createFolderInTestFolder(mediaDir, folder1);
    const mm = await mediaMetadataFrom(created);
    const result = await recognizeMediaFolder(mm, d);

    expect(result.tvShow).toEqual(tvShowFixture);
    expect(d.tmdb.getTvShowMediaMetadata).toHaveBeenCalledWith(84666, "en-US");
    expect(d.tmdb.search).not.toHaveBeenCalled();
  });

  it("recognizes TV show via tvdbid in folder name (folder4 fixture)", async () => {
    const d = deps();
    (d.tvdb.getTvShowMediaMetadata as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...tvShowFixture,
      database: "TVDB",
      id: "421069",
    });

    const created = createFolderInTestFolder(mediaDir, folder4);
    const mm = await mediaMetadataFrom(created);
    const result = await recognizeMediaFolder(mm, d);

    expect(result.tvShow?.database).toBe("TVDB");
    expect(d.tvdb.getTvShowMediaMetadata).toHaveBeenCalledWith(421069, "eng");
    expect(d.tmdb.getTvShowMediaMetadata).not.toHaveBeenCalled();
  });

  it("recognizes TV show via tvshow.nfo tmdbid on disk", async () => {
    const d = deps();
    (d.tmdb.getTvShowMediaMetadata as ReturnType<typeof vi.fn>).mockResolvedValue(tvShowFixture);

    const created = createFolderInTestFolder(mediaDir, {
      ...folder1,
      folderName: "FolderContainsTvShowNfo",
    });
    writeNfo(
      created.path!,
      "tvshow.nfo",
      `<tvshow><title>天使降临到我身边</title><tmdbid>84666</tmdbid></tvshow>`,
    );
    const mm = await mediaMetadataFrom(created);
    const result = await recognizeMediaFolder(mm, d);

    expect(result.tvShow?.id).toBe("84666");
    expect(d.tmdb.getTvShowMediaMetadata).toHaveBeenCalledWith(84666, "en-US");
    expect(d.tmdb.search).not.toHaveBeenCalled();
  });

  it("recognizes TV show via tvshow.nfo tvdbid on disk", async () => {
    const d = deps();
    (d.tvdb.getTvShowMediaMetadata as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...tvShowFixture,
      database: "TVDB",
      id: "355969",
    });

    const created = createFolderInTestFolder(mediaDir, {
      ...folder1,
      folderName: "FolderWithTvdbNfo",
    });
    writeNfo(
      created.path!,
      "tvshow.nfo",
      `<tvshow><title>天使降临到我身边</title><tvdbid>355969</tvdbid></tvshow>`,
    );
    const mm = await mediaMetadataFrom(created);
    const result = await recognizeMediaFolder(mm, d);

    expect(result.tvShow?.database).toBe("TVDB");
    expect(d.tvdb.getTvShowMediaMetadata).toHaveBeenCalledWith(355969, "eng");
  });

  it("prefers tvshow.nfo over tmdbid embedded in the folder name", async () => {
    const d = deps();
    (d.tmdb.getTvShowMediaMetadata as ReturnType<typeof vi.fn>).mockResolvedValue(tvShowFixture);

    const created = createFolderInTestFolder(mediaDir, {
      ...folder1,
      folderName: "NfoOverridesFolderName {tmdbid=84666}",
    });
    writeNfo(created.path!, "tvshow.nfo", `<tvshow><tmdbid>7</tmdbid></tvshow>`);
    const mm = await mediaMetadataFrom(created);
    await recognizeMediaFolder(mm, d);

    expect(d.tmdb.getTvShowMediaMetadata).toHaveBeenCalledTimes(1);
    expect(d.tmdb.getTvShowMediaMetadata).toHaveBeenCalledWith(7, "en-US");
  });

  it("searches TMDB by folder name when no id is present (folder3 fixture)", async () => {
    const d = deps();
    (d.tmdb.search as ReturnType<typeof vi.fn>).mockResolvedValue({
      results: [{ id: 421069, name: folder3.folderName }],
    });
    (d.tmdb.getTvShowMediaMetadata as ReturnType<typeof vi.fn>).mockResolvedValue(tvShowFixture);

    const created = createFolderInTestFolder(mediaDir, folder3);
    const mm = await mediaMetadataFrom(created);
    const result = await recognizeMediaFolder(mm, d);

    expect(result.tvShow?.id).toBe("84666");
    expect(d.tmdb.search).toHaveBeenCalledWith(folder3.folderName, "tv", "en-US");
  });

  it("searches TVDB before TMDB when primaryDatabase is TVDB (folder3 fixture)", async () => {
    const d = deps({ primaryDatabase: "TVDB" });
    (d.tvdb.searchSeries as ReturnType<typeof vi.fn>).mockResolvedValue([
      { objectID: "series-421069", name: folder3.folderName, tvdb_id: "421069" },
    ]);
    (d.tvdb.getTvShowMediaMetadata as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...tvShowFixture,
      database: "TVDB",
      id: "421069",
    });

    const created = createFolderInTestFolder(mediaDir, folder3);
    const mm = await mediaMetadataFrom(created);
    const result = await recognizeMediaFolder(mm, d);

    expect(result.tvShow?.database).toBe("TVDB");
    expect(d.tvdb.getTvShowMediaMetadata).toHaveBeenCalledWith(421069, "eng");
    expect(d.tmdb.search).not.toHaveBeenCalled();
  });

  it("returns empty result for unknown TV show folder", async () => {
    const d = deps();
    (d.tmdb.search as ReturnType<typeof vi.fn>).mockResolvedValue({ results: [] });
    (d.tvdb.searchSeries as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const created = createFolderInTestFolder(mediaDir, {
      ...folder1,
      folderName: `Unknown-${Date.now()}`,
    });
    const mm = await mediaMetadataFrom(created);
    const result = await recognizeMediaFolder(mm, d);

    expect(result).toEqual({});
  });

  it("recognizes movie via tmdbid in folder name", async () => {
    const d = deps();
    (d.tmdb.getMovieMediaMetadata as ReturnType<typeof vi.fn>).mockResolvedValue(movieFixture);

    const created = createFolderInTestFolder(mediaDir, {
      ...folder2,
      folderName: "{tmdbid=1539104}",
      files: folder2.files,
    });
    const mm = await mediaMetadataFrom(created);
    const result = await recognizeMediaFolder(mm, d);

    expect(result.movie).toEqual(movieFixture);
    expect(d.tmdb.getMovieMediaMetadata).toHaveBeenCalledWith(1539104, "en-US");
    expect(d.tmdb.search).not.toHaveBeenCalled();
  });

  it("recognizes movie via tvdbid in folder name (folder5 fixture)", async () => {
    const d = deps();
    (d.tvdb.getMovieMediaMetadata as ReturnType<typeof vi.fn>).mockResolvedValue(darkKnightMovie);

    const created = createFolderInTestFolder(mediaDir, folder5);
    const mm = await mediaMetadataFrom(created);
    const result = await recognizeMediaFolder(mm, d);

    expect(result.movie).toEqual(darkKnightMovie);
    expect(d.tvdb.getMovieMediaMetadata).toHaveBeenCalledWith(116, "eng");
  });

  it("recognizes movie by exact TMDB title search (folder2 fixture)", async () => {
    const d = deps();
    (d.tmdb.search as ReturnType<typeof vi.fn>).mockResolvedValue({
      results: [{ id: 1539104, title: folder2.folderName }],
    });

    const created = createFolderInTestFolder(mediaDir, folder2);
    const mm = await mediaMetadataFrom(created);
    const result = await recognizeMediaFolder(mm, d);

    expect(result.movie).toEqual({
      id: "1539104",
      name: folder2.folderName,
      database: "TMDB",
    });
    expect(d.tmdb.search).toHaveBeenCalledWith(folder2.folderName, "movie", "en-US");
  });

  it("recognizes movie by TVDB folder name search", async () => {
    const d = deps({ primaryDatabase: "TVDB" });
    (d.tvdb.searchMovie as ReturnType<typeof vi.fn>).mockResolvedValue([
      { objectID: "movie-116", name: "The Dark Knight", tvdb_id: "116" },
    ]);
    (d.tvdb.getMovieMediaMetadata as ReturnType<typeof vi.fn>).mockResolvedValue(darkKnightMovie);

    const created = createFolderInTestFolder(mediaDir, {
      ...folder5,
      folderName: "The Dark Knight",
    });
    const mm = await mediaMetadataFrom(created);
    const result = await recognizeMediaFolder(mm, d);

    expect(result.movie).toEqual(darkKnightMovie);
    expect(d.tvdb.searchMovie).toHaveBeenCalledWith("The Dark Knight", "eng");
  });

  it("recognizes movie via movie.nfo tmdbid on disk", async () => {
    const d = deps();
    (d.tmdb.getMovieMediaMetadata as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "535167",
      name: "流浪地球",
      database: "TMDB",
    });

    const created = createFolderInTestFolder(mediaDir, {
      ...folder2,
      folderName: "FolderContainsMovieNfo",
      files: ["movie.mkv"],
    });
    writeNfo(created.path!, "movie.nfo", `<movie><title>流浪地球</title><tmdbid>535167</tmdbid></movie>`);
    const mm = await mediaMetadataFrom(created);
    const result = await recognizeMediaFolder(mm, d);

    expect(result.movie?.id).toBe("535167");
    expect(d.tmdb.getMovieMediaMetadata).toHaveBeenCalledWith(535167, "en-US");
  });

  it("recognizes movie via movie.nfo tvdbid on disk", async () => {
    const d = deps();
    (d.tvdb.getMovieMediaMetadata as ReturnType<typeof vi.fn>).mockResolvedValue(darkKnightMovie);

    const created = createFolderInTestFolder(mediaDir, {
      ...folder2,
      folderName: "FolderWithMovieTvdbNfo",
      files: ["movie.mkv"],
    });
    writeNfo(created.path!, "movie.nfo", `<movie><title>The Dark Knight</title><tvdbid>116</tvdbid></movie>`);
    const mm = await mediaMetadataFrom(created);
    const result = await recognizeMediaFolder(mm, d);

    expect(result.movie?.id).toBe("116");
    expect(d.tvdb.getMovieMediaMetadata).toHaveBeenCalledWith(116, "eng");
  });

  it("returns empty result for unknown movie folder", async () => {
    const d = deps();
    (d.tmdb.search as ReturnType<typeof vi.fn>).mockResolvedValue({ results: [] });
    (d.tvdb.searchMovie as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const created = createFolderInTestFolder(mediaDir, {
      ...folder2,
      folderName: `UnknownMovie-${Date.now()}`,
      files: [],
    });
    const mm = await mediaMetadataFrom(created);
    const result = await recognizeMediaFolder(mm, d);

    expect(result).toEqual({});
  });

  it("continues the TVDB search loop when one result's metadata throws", async () => {
    const d = deps({ primaryDatabase: "TVDB" });
    (d.tvdb.searchSeries as ReturnType<typeof vi.fn>).mockResolvedValue([
      { objectID: "series-1", name: folder3.folderName, tvdb_id: "1" },
      { objectID: "series-2", name: folder3.folderName, tvdb_id: "2" },
    ]);
    (d.tvdb.getTvShowMediaMetadata as ReturnType<typeof vi.fn>).mockImplementation(async (id: number) => {
      if (id === 1) throw new Error("no translation in preferred language");
      return { ...tvShowFixture, database: "TVDB", id: "2" };
    });

    const created = createFolderInTestFolder(mediaDir, folder3);
    const mm = await mediaMetadataFrom(created);
    const result = await recognizeMediaFolder(mm, d);

    expect(result.tvShow?.id).toBe("2");
    expect(d.tvdb.getTvShowMediaMetadata).toHaveBeenCalledTimes(2);
  });

  it("falls through to search when tmdbid in folder name fetch throws", async () => {
    const d = deps();
    (d.tmdb.getTvShowMediaMetadata as ReturnType<typeof vi.fn>).mockImplementation(async (id: number) => {
      if (id === 84666) throw new Error("network down");
      return tvShowFixture;
    });
    (d.tmdb.search as ReturnType<typeof vi.fn>).mockResolvedValue({
      results: [{ id: 9, name: folder1.mediaName }],
    });

    const created = createFolderInTestFolder(mediaDir, folder1);
    const mm = await mediaMetadataFrom(created);
    const result = await recognizeMediaFolder(mm, d);

    expect(result.tvShow?.id).toBe("84666");
    expect(d.tmdb.search).toHaveBeenCalled();
    expect(d.tmdb.getTvShowMediaMetadata).toHaveBeenCalledWith(9, "en-US");
  });
});
