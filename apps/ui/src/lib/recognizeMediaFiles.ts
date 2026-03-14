import type { UIMediaMetadata } from "@/types/UIMediaMetadata";
import { videoFileExtensions } from "./utils";
import { extname } from "./path";

export interface RecognizedMovieMediaFile {
  videoFilePath: string;
}

/**
 * Filter paths to those that are video files by extension.
 */
function findVideoFiles(paths: string[]): string[] {
  return paths.filter((path) =>
    videoFileExtensions.includes(extname(path).toLowerCase())
  );
}

/**
 * Recognize video files in a movie media folder.
 * Returns one entry per video file (by extension); used by doPreprocessMediaFolder for movie-folder.
 */
export function recognizeMovieMediaFiles(
  mm: UIMediaMetadata
): RecognizedMovieMediaFile[] {
  if (
    mm.files === undefined ||
    mm.files === null ||
    mm.files.length === 0
  ) {
    return [];
  }
  const videoFiles = findVideoFiles(mm.files);
  return videoFiles.map((videoFilePath) => ({ videoFilePath }));
}

/**
 * TV show media file recognition is handled by recognizeEpisodesAsync in doPreprocessMediaFolder.
 * This export exists for tests that mock the recognizeMediaFiles module; it is not used by AppV2Utils for the TV branch.
 */
export function recognizeTvShowMediaFiles(
  _mm: UIMediaMetadata
): { videoFilePath: string; season: number; episode: number }[] {
  return [];
}
