import { Path } from "@smm/utils/path";
import type { MediaFileMetadata, MediaMetadata } from "@smm/types";
import type { FsPort } from "../ports/FsPort";
import type { MediaMetadataHelper } from "./mediaMetadataHelper";
import { isVideoFile, recognizeEpisodes } from "./recognizeEpisodes";
import { updateMediaFileMetadatas } from "./updateMediaFileMetadatas";

export interface RecognizedMediaFile {
  path: string;
  /** Set for tvshow folders only; a movie folder links one file without season/episode. */
  season?: number;
  episode?: number;
}

export interface RecognizeMediaFilesDeps {
  fs: FsPort;
  mediaMetadata: MediaMetadataHelper;
  normalizePosix: (path: string) => string;
}

/**
 * Links local video files to a recognized folder: tvshow folders match episodes,
 * movie folders take the first video file. Shared by the user-triggered flow
 * (`tryToRecognizeEpisodes`) and by folder initialization stage 3.
 */
export function recognizeMediaFiles(
  mm: MediaMetadata,
  filePaths: string[],
): RecognizedMediaFile[] {
  if (mm.type === "tvshow-folder") {
    if (mm.tvShow === undefined) return [];
    return recognizeEpisodes(mm, filePaths).map((item) => ({
      path: item.file,
      season: item.season,
      episode: item.episode,
    }));
  }
  if (mm.type === "movie-folder") {
    if (mm.movie === undefined) return [];
    const firstVideo = filePaths.find(isVideoFile);
    return firstVideo === undefined ? [] : [{ path: firstVideo }];
  }
  return [];
}

/** Merges recognized files into `mediaFiles`, same semantics as applying a recognize-media-file plan. */
export function applyRecognizedMediaFiles(
  mediaFiles: MediaFileMetadata[],
  recognized: RecognizedMediaFile[],
): MediaFileMetadata[] {
  let next = mediaFiles;
  for (const file of recognized) {
    if (file.season !== undefined && file.episode !== undefined) {
      next = updateMediaFileMetadatas(next, file.path, file.season, file.episode);
      continue;
    }
    const absolutePath = Path.posix(file.path);
    next = [...next.filter((m) => m.absolutePath !== absolutePath), { absolutePath }];
  }
  return next;
}

/** Recognizes media files of a folder and persists them into the metadata cache. */
export async function recognizeMediaFilesPipeline(
  path: string,
  deps: RecognizeMediaFilesDeps,
  filePaths?: string[],
): Promise<RecognizedMediaFile[]> {
  const posixPath = deps.normalizePosix(path);
  const mm = await deps.mediaMetadata.read(posixPath);
  if (!mm) {
    throw new Error(`Media metadata not found: ${path}`);
  }

  const paths =
    filePaths ?? (await deps.fs.listFiles(posixPath)).map((file) => Path.posix(file));
  const recognized = recognizeMediaFiles({ ...mm, mediaFolderPath: posixPath }, paths);
  if (recognized.length === 0) return recognized;

  await deps.mediaMetadata.write({
    ...mm,
    mediaFolderPath: posixPath,
    mediaFiles: applyRecognizedMediaFiles(mm.mediaFiles ?? [], recognized),
  });
  return recognized;
}
