import type { MediaMetadata } from "@smm/core";
import { describe, expect, it, vi } from "vitest";
import type { FsPort } from "../../ports/FsPort";
import { checkScrapeCompletion } from "./checkScrapeCompletion";

function createFs(listFiles: string[] | (() => never)): FsPort {
  return {
    readTextFile: vi.fn(),
    writeTextFile: vi.fn(),
    writeBinaryFile: vi.fn(),
    exists: vi.fn(),
    listFiles: vi.fn(async () => {
      if (typeof listFiles === "function") {
        listFiles();
      }
      return listFiles as string[];
    }),
    deleteFile: vi.fn(),
    rename: vi.fn(),
    mkdir: vi.fn(),
  };
}

const tvMetadata = (overrides: Partial<MediaMetadata> = {}): MediaMetadata => ({
  mediaFolderPath: "/media/My.Show",
  type: "tvshow-folder",
  mediaFiles: [
    {
      absolutePath: "/media/My.Show/S01E01.mkv",
      seasonNumber: 1,
      episodeNumber: 1,
    },
    {
      absolutePath: "/media/My.Show/S01E02.mkv",
      seasonNumber: 1,
      episodeNumber: 2,
    },
  ],
  ...overrides,
});

describe("checkScrapeCompletion", () => {
  it("returns all false when mediaFolderPath is missing", async () => {
    const result = await checkScrapeCompletion({ type: "tvshow-folder" }, createFs([]));

    expect(result).toEqual({
      poster: false,
      fanart: false,
      thumbnails: false,
      nfo: false,
    });
  });

  it("checks movie poster/fanart/movie.nfo and forces thumbnails complete", async () => {
    const fs = createFs([
      "/media/movie/poster.jpg",
      "/media/movie/fanart.jpg",
      "/media/movie/movie.nfo",
    ]);
    const result = await checkScrapeCompletion(
      { mediaFolderPath: "/media/movie", type: "movie-folder", mediaFiles: [] },
      fs,
    );

    expect(result).toEqual({
      poster: true,
      fanart: true,
      thumbnails: true,
      nfo: true,
    });
    expect(fs.listFiles).toHaveBeenCalled();
  });

  it("movie without movie.nfo leaves nfo incomplete but thumbnails still complete", async () => {
    const fs = createFs(["/media/movie/poster.jpg"]);
    const result = await checkScrapeCompletion(
      { mediaFolderPath: "/media/movie", type: "movie-folder" },
      fs,
    );

    expect(result.poster).toBe(true);
    expect(result.fanart).toBe(false);
    expect(result.nfo).toBe(false);
    expect(result.thumbnails).toBe(true);
  });

  it("returns all false when listFiles throws", async () => {
    const fs = createFs(() => {
      throw new Error("disk error");
    });

    const result = await checkScrapeCompletion(tvMetadata(), fs);

    expect(result).toEqual({
      poster: false,
      fanart: false,
      thumbnails: false,
      nfo: false,
    });
  });

  it("detects poster and fanart by filename prefix and image extension", async () => {
    const fs = createFs([
      "/media/My.Show/poster.jpg",
      "/media/My.Show/fanart.PNG",
      "/media/My.Show/S01E01.mkv",
    ]);

    const result = await checkScrapeCompletion(tvMetadata(), fs);

    expect(result.poster).toBe(true);
    expect(result.fanart).toBe(true);
  });

  it("detects NFO completion when tvshow.nfo and episode nfos exist", async () => {
    const fs = createFs([
      "/media/My.Show/tvshow.nfo",
      "/media/My.Show/S01E01.mkv",
      "/media/My.Show/S01E01.nfo",
      "/media/My.Show/S01E02.mkv",
      "/media/My.Show/S01E02.nfo",
    ]);

    const result = await checkScrapeCompletion(tvMetadata(), fs);

    expect(result.nfo).toBe(true);
  });

  it("reports NFO incomplete when an episode nfo is missing", async () => {
    const fs = createFs([
      "/media/My.Show/tvshow.nfo",
      "/media/My.Show/S01E01.mkv",
      "/media/My.Show/S01E01.nfo",
      "/media/My.Show/S01E02.mkv",
    ]);

    const result = await checkScrapeCompletion(tvMetadata(), fs);

    expect(result.nfo).toBe(false);
  });

  it("detects thumbnails when each linked episode has a same-stem image", async () => {
    const fs = createFs([
      "/media/My.Show/S01E01.mkv",
      "/media/My.Show/S01E01.jpg",
      "/media/My.Show/S01E02.mkv",
      "/media/My.Show/S01E02.png",
    ]);

    const result = await checkScrapeCompletion(tvMetadata(), fs);

    expect(result.thumbnails).toBe(true);
  });

  it("reports thumbnails incomplete when one episode thumb is missing", async () => {
    const fs = createFs([
      "/media/My.Show/S01E01.mkv",
      "/media/My.Show/S01E01.jpg",
      "/media/My.Show/S01E02.mkv",
    ]);

    const result = await checkScrapeCompletion(tvMetadata(), fs);

    expect(result.thumbnails).toBe(false);
  });

  it("reports thumbnails incomplete when no episodes are linked", async () => {
    const fs = createFs(["/media/My.Show/S01E01.mkv"]);

    const result = await checkScrapeCompletion(tvMetadata({ mediaFiles: [] }), fs);

    expect(result.thumbnails).toBe(false);
  });

  it("ignores media files without season and episode numbers", async () => {
    const fs = createFs([
      "/media/My.Show/tvshow.nfo",
      "/media/My.Show/S01E01.mkv",
      "/media/My.Show/S01E01.nfo",
      "/media/My.Show/S01E01.jpg",
    ]);

    const result = await checkScrapeCompletion(
      tvMetadata({
        mediaFiles: [
          { absolutePath: "/media/My.Show/S01E01.mkv" },
          {
            absolutePath: "/media/My.Show/S01E01.mkv",
            seasonNumber: 1,
            episodeNumber: 1,
          },
        ],
      }),
      fs,
    );

    expect(result.nfo).toBe(true);
    expect(result.thumbnails).toBe(true);
  });
});
