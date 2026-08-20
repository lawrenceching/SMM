import type { MediaMetadata, TmdbSeasonDetails, TmdbSeriesDetails } from "@smm/core";
import { describe, expect, it, vi } from "vitest";
import type { TmdbClient } from "../../clients/TmdbClient";
import type { FsPort } from "../../ports/FsPort";
import type { NetworkPort } from "../../ports/NetworkPort";
import { DEFAULT_USER_CONFIG } from "../userConfig";
import { scrapeThumbnailsTmdb } from "./scrapeThumbnailsTmdb";
import type { ScrapeTaskDeps } from "./scrapeTaskDeps";

const seriesDetails: TmdbSeriesDetails = {
  id: 123876,
  name: "Test Show",
  seasons: [{ id: 1, name: "Season 1", season_number: 1, episode_count: 1, poster_path: null }],
} as TmdbSeriesDetails;

const seasonDetails: TmdbSeasonDetails = {
  id: 1,
  name: "Season 1",
  season_number: 1,
  episode_count: 1,
  episodes: [
    {
      id: 8415207,
      name: "Episode One",
      still_path: "/still.jpg",
      episode_number: 1,
      season_number: 1,
      runtime: 24,
      vote_average: 0,
      vote_count: 0,
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

function createInMemoryFs(): FsPort & { binaryFiles: Map<string, Uint8Array> } {
  const binaryFiles = new Map<string, Uint8Array>();
  return {
    binaryFiles,
    readTextFile: vi.fn(),
    writeTextFile: vi.fn(),
    writeBinaryFile: vi.fn(async (path, data) => {
      binaryFiles.set(path, data);
    }),
    exists: vi.fn(async (path) => binaryFiles.has(path)),
    listFiles: vi.fn(async () => []),
    deleteFile: vi.fn(),
    rename: vi.fn(),
    mkdir: vi.fn(),
  };
}

function createDeps(
  fs: FsPort,
  network: NetworkPort,
  tmdb: Partial<TmdbClient>,
): ScrapeTaskDeps {
  return {
    fs,
    network,
    tmdb: tmdb as TmdbClient,
    tvdb: {} as import("../../clients/TvdbClient").TvdbClient,
    mediaMetadata: tvShowMetadata,
    language: "en-US",
    userConfig: DEFAULT_USER_CONFIG,
  };
}

describe("scrapeThumbnailsTmdb", () => {
  it("downloads episode still beside each linked video", async () => {
    const fs = createInMemoryFs();
    const fakeBytes = new Uint8Array([0x47, 0x49]);
    const network: NetworkPort = {
      fetch: vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        text: () => Promise.resolve(""),
        json: <T>() => Promise.resolve({} as T),
        arrayBuffer: () => Promise.resolve(new Uint8Array(fakeBytes).buffer),
      })),
    };
    const tmdb = {
      getTvShowById: vi.fn().mockResolvedValue(seriesDetails),
      getTvSeasonById: vi.fn().mockResolvedValue(seasonDetails),
    };

    const result = await scrapeThumbnailsTmdb(createDeps(fs, network, tmdb));

    expect(result).toEqual({ status: "completed" });
    expect(fs.binaryFiles.get("/media/Test Show/Season 01/S01E01.jpg")).toEqual(fakeBytes);
  });
});
