import type { TvShowEpisodeDataRow, TvShowEpisodeTableRow } from "@/components/tv/TvShowEpisodeTable";
import type { MediaMetadata } from "@core/types";
import type { UIMediaFolderStatus } from "@/types/UIMediaFolder";
import { basename, join } from "@/lib/path";
import { findAssociatedFiles } from "@/lib/utils";

export interface MovieRenamePreviewData {
  newVideoFile?: string;
  newSubtitle?: string;
  newNfo?: string;
}

/**
 * Builds TvShowEpisodeTableRow[] from movie MediaMetadata.
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
  options?: {
    renamePreview?: MovieRenamePreviewData;
  }
): TvShowEpisodeTableRow[] {
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

  const rows: TvShowEpisodeTableRow[] = [];
  const mediaFolderPath = mm.mediaFolderPath;
  const videoFile = mm.mediaFiles[0]; // Only the first/main video file
  const allFiles = mm.files ?? [];

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
  // Stem-matched associated files only (NOT folder-level poster/fanart/movie.nfo)
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

  // Supplement with subtitleFilePaths from mediaFiles (populated during recognition).
  // findAssociatedFiles uses strict stem matching that can miss subtitles with
  // different naming (e.g., "Movie.srt" for "Movie (2024).mkv").
  if (!subtitle && videoFile.subtitleFilePaths?.length) {
    subtitle = videoFile.subtitleFilePaths[0];
  }

  const row: TvShowEpisodeDataRow = {
    season: 1,
    episode: 1,
    type: "episode",
    videoFile: videoFile.absolutePath,
    thumbnail,
    subtitle,
    nfo,
    episodeTitle: mm.movie?.name,
    checked: false,
  };

  if (options?.renamePreview) {
    row.newVideoFile = options.renamePreview.newVideoFile;
    row.newSubtitle = options.renamePreview.newSubtitle;
    row.newNfo = options.renamePreview.newNfo;
  }

  rows.push(row);
  return rows;
}
