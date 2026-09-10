/**
 * UI wrapper around `@smm/core/pipeline/recognizeEpisodes`.
 * Adds MediaMetadataWithFolderFiles convenience + Web Worker async path.
 */
import {
  recognizeEpisodes as recognizeEpisodesPure,
  isVideoFile,
  pattern4,
  type RecognizedEpisode,
} from "@smm/core/pipeline/recognizeEpisodes";
import type { MediaMetadataWithFolderFiles } from "@/lib/mediaFolderFiles";

export type { RecognizedEpisode };
export { isVideoFile, pattern4 };

/**
 * Sync recognition using folder files from UI metadata.
 */
export function recognizeEpisodes(
  mm: MediaMetadataWithFolderFiles,
  folderFiles: string[],
): RecognizedEpisode[] {
  return recognizeEpisodesPure(mm, folderFiles);
}
