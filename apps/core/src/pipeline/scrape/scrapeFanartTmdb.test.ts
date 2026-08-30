import type { MediaMetadata, TmdbSeriesDetails } from "@smm/types";
import { describe, expect, it, vi } from "vitest";
import type { TmdbClient } from "../../clients/TmdbClient";
import type { FsPort } from "../../ports/FsPort";
import type { NetworkPort } from "../../ports/NetworkPort";
import { DEFAULT_USER_CONFIG } from "../userConfigHelper";
import { scrapeFanartTmdb } from "./scrapeFanartTmdb";
import type { ScrapeTaskDeps } from "./scrapeTaskDeps";
import type { TvdbClient } from "../../clients/TvdbClient";

const seriesDetails: TmdbSeriesDetails = {
  id: 123876,
  name: "Test Show",
  poster_path: "/poster.jpg",
  backdrop_path: "/fanart.jpg",
  seasons: [],
} as unknown as TmdbSeriesDetails;

const tvShowMetadata: MediaMetadata = {
  type: "tvshow-folder",
  mediaFolderPath: "/media/Test Show",
  tvShow: { id: "123876", database: "TMDB", name: "Test Show", seasons: [] },
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
    listSubdirectories: vi.fn(async () => []),
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
    tvdb: {} as TvdbClient,
    mediaMetadata: tvShowMetadata,
    language: "en-US",
    userConfig: DEFAULT_USER_CONFIG,
  };
}

describe("scrapeFanartTmdb", () => {
  it("downloads fanart from backdrop_path", async () => {
    const fs = createInMemoryFs();
    const fakeBytes = new Uint8Array([0x89, 0x50]);
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
    const tmdb = { getTvShowById: vi.fn().mockResolvedValue(seriesDetails) };

    const result = await scrapeFanartTmdb(createDeps(fs, network, tmdb));

    expect(result).toEqual({ status: "completed" });
    expect(fs.binaryFiles.get("/media/Test Show/fanart.jpg")).toEqual(fakeBytes);
  });
});
