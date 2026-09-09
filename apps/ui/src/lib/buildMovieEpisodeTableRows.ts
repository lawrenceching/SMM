import type {
  MediaFileTableSeasonData,
  UIMediaFileDataRow,
  UIMediaFileTableRow,
} from "@/components/media/UIMediaFileTable";
import type { MediaMetadata } from "@/lib/mediaFolderFiles"
import type { UIMediaFolderStatus } from "@/types/UIMediaFolder";
import type { MetadataFiles } from "@smm/types/MetadataFiles";
import { basename, join } from "@/lib/path";
import { findAssociatedFiles } from "@/lib/utils";
import {
  findNfos,
  findSubtitles,
  findThumbnails,
} from "@/lib/tvShowEpisodeAssociatedFiles";

export interface MovieRenamePreviewData {
  newVideoFile?: string;
  newSubtitle?: string;
  newNfo?: string;
}

export type MovieEpisodeAssociatedFileLists = {
  subtitleFiles: { season: number; episode: number; files: string[] }[];
  nfoFiles: { season: number; episode: number; files: string[] }[];
  thumbnailFiles: { season: number; episode: number; files: string[] }[];
};

/**
 * Builds seasonData for MediaFileTable simple/detail/preview layouts.
 * Movies are modeled as one season ("Movie") with a single S01E01 episode.
 */
export function buildMovieMediaFileTableSeasonData(
  mm: MediaMetadata,
): MediaFileTableSeasonData[] {
  if (!mm.mediaFolderPath || !mm.mediaFiles || mm.mediaFiles.length === 0) {
    return [];
  }

  const videoFile = mm.mediaFiles[0]!;
  return [
    {
      season: 1,
      title: "Movie",
      episodes: [
        {
          season: 1,
          episode: 1,
          title: mm.movie?.name ?? "",
          path: videoFile.absolutePath,
        },
      ],
    },
  ];
}

/** Folder-level poster / fanart / movie.nfo for MediaFileTable metadata rows. */
export function buildMovieMetadataFiles(
  mm: MediaMetadata,
  folderFiles: string[],
): MetadataFiles {
  void mm;
  const posterPath = folderFiles.find((f) => {
    const name = basename(f);
    return name != null && name.startsWith("poster.");
  });
  const fanartPath = folderFiles.find((f) => {
    const name = basename(f);
    return name != null && name.startsWith("fanart.");
  });
  const nfoPath = folderFiles.find((f) => basename(f) === "movie.nfo");

  return {
    posterPath,
    fanartPath,
    nfoPath,
    seasonPosters: [],
    clearlogoPath: undefined,
    themePath: undefined,
  };
}

/**
 * Associated subtitle / nfo / thumbnail lists keyed as S01E01 for MediaFileTable.
 * Prefers stem-matched files; falls back to folder-level poster.* / movie.nfo.
 */
export function buildMovieEpisodeAssociatedFileLists(
  mm: MediaMetadata,
  folderFiles: string[],
): MovieEpisodeAssociatedFileLists {
  const empty: MovieEpisodeAssociatedFileLists = {
    subtitleFiles: [],
    nfoFiles: [],
    thumbnailFiles: [],
  };

  if (!mm.mediaFolderPath || !mm.mediaFiles || mm.mediaFiles.length === 0) {
    return empty;
  }

  const videoPath = mm.mediaFiles[0]!.absolutePath;
  let subtitles = findSubtitles(folderFiles, videoPath);
  if (subtitles.length === 0 && mm.mediaFiles[0]!.subtitleFilePaths?.length) {
    subtitles = [...mm.mediaFiles[0]!.subtitleFilePaths!];
  }

  let nfoFiles = findNfos(folderFiles, videoPath);
  if (nfoFiles.length === 0) {
    const movieNfo = folderFiles.find((f) => basename(f) === "movie.nfo");
    if (movieNfo) nfoFiles = [movieNfo];
  }

  let thumbnails = findThumbnails(folderFiles, videoPath);
  if (thumbnails.length === 0) {
    const poster = folderFiles.find((f) => {
      const name = basename(f);
      return name != null && name.startsWith("poster.");
    });
    if (poster) thumbnails = [poster];
  }

  return {
    subtitleFiles: subtitles.length
      ? [{ season: 1, episode: 1, files: subtitles }]
      : [],
    nfoFiles: nfoFiles.length ? [{ season: 1, episode: 1, files: nfoFiles }] : [],
    thumbnailFiles: thumbnails.length
      ? [{ season: 1, episode: 1, files: thumbnails }]
      : [],
  };
}

/**
 * Builds UIMediaFileTableRow[] from movie MediaMetadata.
 * Treats the movie as a "one season, one episode" TV show (S01E01).
 *
 * Output includes:
 * - Folder file rows for poster.*, fanart.*, movie.nfo
 * - One episode data row (S01E01) with video + stem-matched associated files
 */
export function buildMovieEpisodeTableRows(
  mm: MediaMetadata,
  uiStatus: UIMediaFolderStatus,
  t: (key: string) => string,
  folderFiles: string[] = [],
  options?: {
    renamePreview?: MovieRenamePreviewData;
  }
): UIMediaFileTableRow[] {
  // Empty states — mirror buildTvShowEpisodeTableRows behaviour
  if (uiStatus === "initializing") {
    return [{ id: "initializing", type: "divider", text: t("mediaFolder.initializing") }];
  }
  if (uiStatus === "folder_not_found") {
    return [{ id: "folder_not_found", type: "divider", text: t("mediaFolder.folderNotFound") }];
  }
  if (uiStatus === "error_loading_metadata") {
    return [{ id: "error_loading_metadata", type: "divider", text: t("mediaFolder.errorLoadingMetadata") }];
  }

  if (!mm.mediaFolderPath || !mm.mediaFiles || mm.mediaFiles.length === 0) {
    return [{ id: "no-video", type: "divider", text: "No video file" }];
  }

  const rows: UIMediaFileTableRow[] = [];
  const mediaFolderPath = mm.mediaFolderPath;
  const videoFile = mm.mediaFiles[0]; // Only the first/main video file
  const allFiles = folderFiles;

  // ── Folder-level file rows (mirrors TvShowPanel's buildFolderFileRows) ──

  const posterFile = allFiles.find((f) => {
    const name = basename(f);
    return name != null && name.startsWith("poster.");
  });
  if (posterFile) {
    rows.push({ id: "poster", type: "folderFile", path: posterFile });
  }

  const fanartFile = allFiles.find((f) => {
    const name = basename(f);
    return name != null && name.startsWith("fanart.");
  });
  if (fanartFile) {
    rows.push({ id: "fanart", type: "folderFile", path: fanartFile });
  }

  const movieNfoFile = allFiles.find((f) => basename(f) === "movie.nfo");
  if (movieNfoFile) {
    rows.push({ id: "nfo", type: "folderFile", path: movieNfoFile });
  }

  // ── "Movie" divider (mirrors TV show season dividers) ──
  rows.push({ type: "divider", id: "movie", text: "Movie" });

  // ── Episode row (S01E01) ──
  // Preferred: stem-matched associated files (e.g. "Movie (2024).srt").
  // Fallback: folder-level poster.* / movie.nfo (common for movie folders
  // where the subtitle/image stem does not match the video basename).
  const associated = findAssociatedFiles(mediaFolderPath, allFiles, videoFile.absolutePath);

  let thumbnail: string | undefined;
  let subtitle: string | undefined;
  let nfo: string | undefined;

  for (const file of associated) {
    const absPath = join(mediaFolderPath, file.path);
    switch (file.tag) {
      case "POSTER":
        if (!thumbnail) thumbnail = absPath;
        break;
      case "SUB":
        if (!subtitle) subtitle = absPath;
        break;
      case "NFO":
        if (!nfo) nfo = absPath;
        break;
    }
  }

  // Subtitle fallback: subtitleFilePaths populated during recognition can hold
  // subtitles with a different stem than the video (e.g. "Movie.srt" for
  // "Movie (2024).mkv").
  if (!subtitle && videoFile.subtitleFilePaths?.length) {
    subtitle = videoFile.subtitleFilePaths[0];
  }

  // Folder-level fallbacks for thumbnail / nfo. Movie folders typically only
  // carry poster.* and movie.nfo at the folder root, not stem-matched to the
  // video basename, so the stem-matched scan above leaves these columns empty
  // unless we fall back to the same files we already surface as folderFile rows.
  if (!thumbnail && posterFile) thumbnail = posterFile;
  if (!nfo && movieNfoFile) nfo = movieNfoFile;

  const row: UIMediaFileDataRow = {
    season: 1,
    episode: 1,
    type: "episode",
    videoFile: videoFile.absolutePath,
    thumbnail,
    subtitle,
    nfo,
    episodeTitle: mm.movie?.name,
  };

  if (options?.renamePreview) {
    row.newVideoFile = options.renamePreview.newVideoFile;
    row.newSubtitle = options.renamePreview.newSubtitle;
    row.newNfo = options.renamePreview.newNfo;
  }

  rows.push(row);
  return rows;
}
