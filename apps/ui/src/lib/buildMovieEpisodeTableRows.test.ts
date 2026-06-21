import { describe, it, expect } from "vitest";
import { buildMovieEpisodeTableRows } from "./buildMovieEpisodeTableRows";
import type { MediaMetadata } from "@core/types";
import type { UIMediaFolderStatus } from "@/types/UIMediaFolder";
import type { TvShowEpisodeDataRow } from "@/components/tv/TvShowEpisodeTable";

const t = (key: string) => key;

function makeMediaMetadata(overrides: Partial<MediaMetadata> = {}): MediaMetadata {
  return {
    mediaFolderPath: "/media/movies/TestMovie",
    files: [],
    mediaFiles: [],
    type: "movie-folder",
    movie: { id: "123", name: "Test Movie", database: "TMDB", airDate: "2024-01-01" },
    ...overrides,
  };
}

/** Returns the last row in the array (always the episode data row). */
function episodeRow(rows: ReturnType<typeof buildMovieEpisodeTableRows>): TvShowEpisodeDataRow {
  return rows[rows.length - 1] as TvShowEpisodeDataRow;
}

describe("buildMovieEpisodeTableRows", () => {
  // ── Empty / loading states ──

  it("returns initializing divider when uiStatus is initializing", () => {
    const rows = buildMovieEpisodeTableRows(makeMediaMetadata(), "initializing", t);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "divider", text: "mediaFolder.initializing" });
  });

  it("returns folder_not_found divider when uiStatus is folder_not_found", () => {
    const rows = buildMovieEpisodeTableRows(makeMediaMetadata(), "folder_not_found", t);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "divider", text: "mediaFolder.folderNotFound" });
  });

  it("returns error_loading_metadata divider when uiStatus is error_loading_metadata", () => {
    const rows = buildMovieEpisodeTableRows(makeMediaMetadata(), "error_loading_metadata", t);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "divider", text: "mediaFolder.errorLoadingMetadata" });
  });

  // ── Missing data ──

  it("returns no-video divider when mediaFolderPath is missing", () => {
    const mm = makeMediaMetadata({ mediaFolderPath: undefined });
    const rows = buildMovieEpisodeTableRows(mm, "ok", t);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "divider" });
  });

  it("returns no-video divider when mediaFiles is empty", () => {
    const mm = makeMediaMetadata({ mediaFiles: [] });
    const rows = buildMovieEpisodeTableRows(mm, "ok", t);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "divider" });
  });

  it("returns no-video divider when mediaFiles is undefined", () => {
    const mm = makeMediaMetadata({ mediaFiles: undefined });
    const rows = buildMovieEpisodeTableRows(mm, "ok", t);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "divider" });
  });

  // ── "Movie" divider row ──

  it("includes a Movie divider row before the episode row", () => {
    const mm = makeMediaMetadata({
      mediaFiles: [{ absolutePath: "/media/movies/TestMovie/video.mkv" }],
    });
    const rows = buildMovieEpisodeTableRows(mm, "ok", t);
    expect(rows).toHaveLength(2); // divider + episode
    expect(rows[0]).toMatchObject({ type: "divider", id: "movie", text: "Movie" });
    expect(rows[1].type).toBe("episode");
  });

  // ── Normal single-row output ──

  it("builds one episode row with season=1 episode=1 from a single video file", () => {
    const mm = makeMediaMetadata({
      mediaFiles: [{ absolutePath: "/media/movies/TestMovie/video.mkv" }],
    });
    const rows = buildMovieEpisodeTableRows(mm, "ok", t);
    const row = episodeRow(rows);
    expect(row.type).toBe("episode");
    expect(row.season).toBe(1);
    expect(row.episode).toBe(1);
    expect(row.videoFile).toBe("/media/movies/TestMovie/video.mkv");
    expect(row.checked).toBe(false);
    expect(row.episodeTitle).toBe("Test Movie");
  });

  it("uses only the first mediaFile when multiple exist", () => {
    const mm = makeMediaMetadata({
      mediaFiles: [
        { absolutePath: "/media/movies/TestMovie/main.mkv" },
        { absolutePath: "/media/movies/TestMovie/extra.mkv" },
      ],
    });
    const rows = buildMovieEpisodeTableRows(mm, "ok", t);
    expect(episodeRow(rows).videoFile).toBe("/media/movies/TestMovie/main.mkv");
  });

  // ── Stem-matched associated files ──

  it("finds stem-matched subtitle file", () => {
    const mm = makeMediaMetadata({
      files: [
        "/media/movies/TestMovie/video.mkv",
        "/media/movies/TestMovie/video.srt",
      ],
      mediaFiles: [{ absolutePath: "/media/movies/TestMovie/video.mkv" }],
    });
    const rows = buildMovieEpisodeTableRows(mm, "ok", t);
    expect(episodeRow(rows).subtitle).toContain("/media/movies/TestMovie/video.srt");
  });

  it("puts stem-matched thumbnail into episode row", () => {
    const mm = makeMediaMetadata({
      files: [
        "/media/movies/TestMovie/video.mkv",
        "/media/movies/TestMovie/video.jpg",
      ],
      mediaFiles: [{ absolutePath: "/media/movies/TestMovie/video.mkv" }],
    });
    const rows = buildMovieEpisodeTableRows(mm, "ok", t);
    expect(episodeRow(rows).thumbnail).toContain("video.jpg");
  });

  // ── Folder-level file rows ──

  it("creates a poster folderFile row", () => {
    const mm = makeMediaMetadata({
      files: [
        "/media/movies/TestMovie/video.mkv",
        "/media/movies/TestMovie/poster.jpg",
      ],
      mediaFiles: [{ absolutePath: "/media/movies/TestMovie/video.mkv" }],
    });
    const rows = buildMovieEpisodeTableRows(mm, "ok", t);
    expect(rows).toHaveLength(3); // poster folderFile + divider + episode
    expect(rows[0]).toMatchObject({ type: "folderFile", id: "poster", path: "/media/movies/TestMovie/poster.jpg" });
    expect(rows[1]).toMatchObject({ type: "divider", id: "movie" });
    expect(episodeRow(rows).thumbnail).toBeUndefined();
  });

  it("creates a fanart folderFile row", () => {
    const mm = makeMediaMetadata({
      files: [
        "/media/movies/TestMovie/video.mkv",
        "/media/movies/TestMovie/fanart.png",
      ],
      mediaFiles: [{ absolutePath: "/media/movies/TestMovie/video.mkv" }],
    });
    const rows = buildMovieEpisodeTableRows(mm, "ok", t);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ type: "folderFile", id: "fanart", path: "/media/movies/TestMovie/fanart.png" });
  });

  it("creates a movie.nfo folderFile row", () => {
    const mm = makeMediaMetadata({
      files: [
        "/media/movies/TestMovie/video.mkv",
        "/media/movies/TestMovie/movie.nfo",
      ],
      mediaFiles: [{ absolutePath: "/media/movies/TestMovie/video.mkv" }],
    });
    const rows = buildMovieEpisodeTableRows(mm, "ok", t);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ type: "folderFile", id: "nfo", path: "/media/movies/TestMovie/movie.nfo" });
    expect(episodeRow(rows).nfo).toBeUndefined();
  });

  it("emits multiple folderFile rows, divider, and one episode row", () => {
    const mm = makeMediaMetadata({
      files: [
        "/media/movies/TestMovie/video.mkv",
        "/media/movies/TestMovie/poster.jpg",
        "/media/movies/TestMovie/fanart.png",
        "/media/movies/TestMovie/movie.nfo",
      ],
      mediaFiles: [{ absolutePath: "/media/movies/TestMovie/video.mkv" }],
    });
    const rows = buildMovieEpisodeTableRows(mm, "ok", t);
    expect(rows).toHaveLength(5); // 3 folderFiles + divider + episode
    expect(rows.filter((r) => r.type === "folderFile")).toHaveLength(3);
    expect(rows.filter((r) => r.type === "divider")).toHaveLength(1);
    expect(rows.filter((r) => r.type === "episode")).toHaveLength(1);
  });

  // ── Rename preview ──

  it("fills newVideoFile/newSubtitle/newNfo when renamePreview is provided", () => {
    const mm = makeMediaMetadata({
      mediaFiles: [{ absolutePath: "/media/movies/TestMovie/video.mkv" }],
    });
    const rows = buildMovieEpisodeTableRows(mm, "ok", t, {
      renamePreview: {
        newVideoFile: "/media/movies/TestMovie/New Name (2024).mkv",
        newSubtitle: "/media/movies/TestMovie/New Name (2024).srt",
        newNfo: "/media/movies/TestMovie/New Name (2024).nfo",
      },
    });
    const row = episodeRow(rows);
    expect(row.newVideoFile).toBe("/media/movies/TestMovie/New Name (2024).mkv");
    expect(row.newSubtitle).toBe("/media/movies/TestMovie/New Name (2024).srt");
    expect(row.newNfo).toBe("/media/movies/TestMovie/New Name (2024).nfo");
  });

  it("does not fill preview fields when renamePreview is not provided", () => {
    const mm = makeMediaMetadata({
      mediaFiles: [{ absolutePath: "/media/movies/TestMovie/video.mkv" }],
    });
    const rows = buildMovieEpisodeTableRows(mm, "ok", t);
    const row = episodeRow(rows);
    expect(row.newVideoFile).toBeUndefined();
    expect(row.newSubtitle).toBeUndefined();
    expect(row.newNfo).toBeUndefined();
  });

  it("handles partial renamePreview (only newVideoFile)", () => {
    const mm = makeMediaMetadata({
      mediaFiles: [{ absolutePath: "/media/movies/TestMovie/video.mkv" }],
    });
    const rows = buildMovieEpisodeTableRows(mm, "ok", t, {
      renamePreview: {
        newVideoFile: "/media/movies/TestMovie/New Name (2024).mkv",
      },
    });
    const row = episodeRow(rows);
    expect(row.newVideoFile).toBe("/media/movies/TestMovie/New Name (2024).mkv");
    expect(row.newSubtitle).toBeUndefined();
    expect(row.newNfo).toBeUndefined();
  });

  // ── Episode title from movie metadata ──

  it("uses movie.name for episodeTitle", () => {
    const mm = makeMediaMetadata({
      movie: { id: "456", name: "Inception", database: "TMDB" },
      mediaFiles: [{ absolutePath: "/media/movies/Inception/video.mkv" }],
    });
    const rows = buildMovieEpisodeTableRows(mm, "ok", t);
    expect(episodeRow(rows).episodeTitle).toBe("Inception");
  });

  it("leaves episodeTitle undefined when movie metadata is missing", () => {
    const mm = makeMediaMetadata({
      movie: undefined,
      mediaFiles: [{ absolutePath: "/media/movies/TestMovie/video.mkv" }],
    });
    const rows = buildMovieEpisodeTableRows(mm, "ok", t);
    expect(episodeRow(rows).episodeTitle).toBeUndefined();
  });
});
