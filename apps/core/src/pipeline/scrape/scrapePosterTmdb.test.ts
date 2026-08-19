import type { MediaMetadata, TmdbSeasonDetails, TmdbSeriesDetails, UserConfig } from "@smm/core";
import { describe, expect, it, vi } from "vitest";
import type { TmdbClient } from "../../clients/TmdbClient";
import type { FetchInit, HttpResponse, NetworkPort } from "../../ports/NetworkPort";
import type { FsPort } from "../../ports/FsPort";
import { DEFAULT_USER_CONFIG } from "../userConfig";
import { resolvePosterUrl, scrapePosterTmdb } from "./scrapePosterTmdb";
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
  genre_ids: [16, 35],
  origin_country: ["JP"],
  number_of_seasons: 1,
  number_of_episodes: 1,
  seasons: [{ id: 1, name: "Season 1", season_number: 1, episode_count: 1, poster_path: null }],
  status: "Ended",
  type: "Scripted",
  in_production: false,
  last_air_date: "2021-03-26",
  networks: [],
  production_companies: [],
} as TmdbSeriesDetails;

const tvShowMetadata: MediaMetadata = {
  type: "tvshow-folder",
  mediaFolderPath: "/media/Test Show",
  tvShow: { id: "123876", database: "TMDB", name: "Test Show", seasons: [] },
  mediaFiles: [],
} as MediaMetadata;

function createInMemoryFs(initialFiles: Record<string, Uint8Array | string> = {}): FsPort & {
  binaryFiles: Map<string, Uint8Array>;
  textFiles: Map<string, string>;
} {
  const binaryFiles = new Map<string, Uint8Array>();
  const textFiles = new Map<string, string>();

  for (const [path, content] of Object.entries(initialFiles)) {
    if (typeof content === "string") {
      textFiles.set(path, content);
    } else {
      binaryFiles.set(path, content);
    }
  }

  return {
    binaryFiles,
    textFiles,
    readTextFile: vi.fn(async (path) => textFiles.get(path) ?? ""),
    writeTextFile: vi.fn(async (path, content) => {
      textFiles.set(path, content);
    }),
    writeBinaryFile: vi.fn(async (path, data) => {
      binaryFiles.set(path, data);
    }),
    exists: vi.fn(async (path) => binaryFiles.has(path) || textFiles.has(path)),
    listFiles: vi.fn(async () => [...binaryFiles.keys(), ...textFiles.keys()]),
    deleteFile: vi.fn(),
    rename: vi.fn(),
    mkdir: vi.fn(),
  };
}

function fakeImageResponse(bytes: Uint8Array): HttpResponse {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: { "content-type": "image/jpeg" },
    text: () => Promise.resolve(""),
    json: <T>() => Promise.resolve({} as T),
    arrayBuffer: () => Promise.resolve(new Uint8Array(bytes).buffer),
  };
}

function createDeps(
  fs: FsPort,
  network: NetworkPort,
  tmdb: Partial<TmdbClient>,
  mediaMetadata: MediaMetadata = tvShowMetadata,
): ScrapeTaskDeps {
  return {
    fs,
    network,
    tmdb: tmdb as TmdbClient,
    mediaMetadata,
    language: "en-US",
    userConfig: DEFAULT_USER_CONFIG,
  };
}

describe("resolvePosterUrl", () => {
  it("resolves TMDB poster_path to an original-size CDN URL", async () => {
    const result = await resolvePosterUrl(123876, "en-US", vi.fn().mockResolvedValue(seriesDetails));
    expect(result).toBe("https://image.tmdb.org/t/p/original/poster.jpg");
  });
});

describe("scrapePosterTmdb", () => {
  it("downloads poster bytes when the file is missing", async () => {
    const fs = createInMemoryFs();
    const fakeBytes = new Uint8Array([0xff, 0xd8, 0xff]);
    const network: NetworkPort = {
      fetch: vi.fn(async () => fakeImageResponse(fakeBytes)),
    };
    const tmdb = {
      getTvShowById: vi.fn().mockResolvedValue(seriesDetails),
    };

    const result = await scrapePosterTmdb(createDeps(fs, network, tmdb));

    expect(result).toEqual({ status: "completed" });
    expect(fs.binaryFiles.get("/media/Test Show/poster.jpg")).toEqual(fakeBytes);
    expect(network.fetch).toHaveBeenCalledWith(
      "https://image.tmdb.org/t/p/original/poster.jpg",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("skips when poster already exists", async () => {
    const fs = createInMemoryFs({ "/media/Test Show/poster.jpg": new Uint8Array([1]) });
    const network: NetworkPort = { fetch: vi.fn() };
    const tmdb = { getTvShowById: vi.fn().mockResolvedValue(seriesDetails) };

    const result = await scrapePosterTmdb(createDeps(fs, network, tmdb));

    expect(result).toEqual({ status: "skipped" });
    expect(network.fetch).not.toHaveBeenCalled();
  });

  it("returns failed when TMDB has no poster", async () => {
    const fs = createInMemoryFs();
    const network: NetworkPort = { fetch: vi.fn() };
    const tmdb = {
      getTvShowById: vi.fn().mockResolvedValue({ ...seriesDetails, poster_path: null }),
    };

    const result = await scrapePosterTmdb(createDeps(fs, network, tmdb));

    expect(result.status).toBe("failed");
    expect(result.error).toContain("No TMDB poster");
  });
});
