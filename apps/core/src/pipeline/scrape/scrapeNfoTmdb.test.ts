import type { MediaMetadata, TmdbSeasonDetails, TmdbSeriesDetails } from "@smm/types";
import { describe, expect, it, vi } from "vitest";
import type { TmdbClient } from "../../clients/TmdbClient";
import type { FsPort } from "../../ports/FsPort";
import type { NetworkPort } from "../../ports/NetworkPort";
import { DEFAULT_USER_CONFIG } from "../userConfigHelper";
import { scrapeNfoTmdb } from "./scrapeNfoTmdb";
import type { ScrapeTaskDeps } from "./scrapeTaskDeps";

const seriesDetails: TmdbSeriesDetails = {
  id: 123876,
  name: "Test Show",
  original_name: "Original Show",
  overview: "Show overview",
  poster_path: "/poster.jpg",
  backdrop_path: "/fanart.jpg",
  first_air_date: "2021-01-15",
  vote_average: 8.3,
  vote_count: 545,
  popularity: 100,
  genre_ids: [16],
  origin_country: ["JP"],
  number_of_seasons: 1,
  number_of_episodes: 1,
  seasons: [{ id: 1, name: "Season 1", season_number: 1, episode_count: 1, poster_path: null }],
  status: "Ended",
  type: "Scripted",
  in_production: false,
  last_air_date: "2021-03-26",
  networks: [],
  production_companies: [{ id: 1, name: "Studio Alpha", logo_path: null }],
  genres: [{ id: 16, name: "Animation" }],
} as unknown as TmdbSeriesDetails;

const seasonDetails: TmdbSeasonDetails = {
  id: 1,
  name: "Season 1",
  overview: "Season overview",
  poster_path: "/season1.jpg",
  season_number: 1,
  air_date: "2021-01-15",
  episode_count: 1,
  episodes: [
    {
      id: 8415207,
      name: "Episode One",
      overview: "Episode overview",
      still_path: "/still.jpg",
      air_date: "2021-01-15",
      episode_number: 1,
      season_number: 1,
      runtime: 24,
      vote_average: 7.8,
      vote_count: 13,
      crew: [],
      guest_stars: [],
    },
  ],
};

const tvShowMetadata: MediaMetadata = {
  type: "tvshow-folder",
  mediaFolderPath: "/media/Test Show",
  tvShow: { id: "123876", database: "TMDB", name: "Test Show", seasons: [] },
  mediaFiles: [
    {
      absolutePath: "/media/Test Show/Season 01/S01E01.mkv",
      seasonNumber: 1,
      episodeNumber: 1,
    },
  ],
} as MediaMetadata;

function createInMemoryFs(initialText: Record<string, string> = {}): FsPort & {
  textFiles: Map<string, string>;
} {
  const textFiles = new Map<string, string>(Object.entries(initialText));
  return {
    textFiles,
    readTextFile: vi.fn(async (path) => textFiles.get(path) ?? ""),
    writeTextFile: vi.fn(async (path, content) => {
      textFiles.set(path, content);
    }),
    writeBinaryFile: vi.fn(),
    exists: vi.fn(async (path) => textFiles.has(path)),
    listFiles: vi.fn(async () => [...textFiles.keys()]),
    deleteFile: vi.fn(),
    rename: vi.fn(),
    mkdir: vi.fn(),
    listSubdirectories: vi.fn(async () => []),
  };
}

function createDeps(
  fs: FsPort,
  tmdb: Partial<TmdbClient>,
  mediaMetadata: MediaMetadata = tvShowMetadata,
): ScrapeTaskDeps {
  return {
    fs,
    network: { fetch: vi.fn() },
    tmdb: tmdb as TmdbClient,
    tvdb: {} as import("../../clients/TvdbClient").TvdbClient,
    mediaMetadata,
    language: "en-US",
    userConfig: DEFAULT_USER_CONFIG,
  };
}

describe("scrapeNfoTmdb", () => {
  it("writes tvshow.nfo and episode nfos from TMDB data", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T12:00:00.000Z"));

    const fs = createInMemoryFs();
    const tmdb = {
      getTvShowById: vi.fn().mockResolvedValue(seriesDetails),
      getTvSeasonById: vi.fn().mockResolvedValue(seasonDetails),
    };

    const result = await scrapeNfoTmdb(createDeps(fs, tmdb));

    expect(result).toEqual({ status: "completed" });
    const tvshowNfo = fs.textFiles.get("/media/Test Show/tvshow.nfo");
    expect(tvshowNfo).toContain("<title>Test Show</title>");
    expect(tvshowNfo).toContain("<tmdbid>123876</tmdbid>");

    const episodeNfo = fs.textFiles.get("/media/Test Show/Season 01/S01E01.nfo");
    expect(episodeNfo).toContain("<title>Episode One</title>");
    expect(episodeNfo).toContain("<season>1</season>");
    expect(episodeNfo).toContain("<episode>1</episode>");

    vi.useRealTimers();
  });

  it("skips files that already exist", async () => {
    const fs = createInMemoryFs({
      "/media/Test Show/tvshow.nfo": "<tvshow></tvshow>",
      "/media/Test Show/Season 01/S01E01.nfo": "<episodedetails></episodedetails>",
    });
    const tmdb = {
      getTvShowById: vi.fn().mockResolvedValue(seriesDetails),
      getTvSeasonById: vi.fn().mockResolvedValue(seasonDetails),
    };

    const result = await scrapeNfoTmdb(createDeps(fs, tmdb));

    expect(result).toEqual({ status: "skipped" });
    expect(fs.writeTextFile).not.toHaveBeenCalled();
  });
});
