import type { MediaMetadata } from "@core/types";
import { Path } from "@core/path";
import { updateMediaFileMetadatas } from "@/components/TvShowPanelUtils";

/**
 * The helper function for TvShowPanel component.
 * This method handles that user select a video file for a given season and episode.
 * For example, user select file `S01E01.mp4` for season 1 episode 1.
 * And then this method will update the Media Metadata accordingly
 *
 * This method is designed to handle the computational logic.
 * Use callback to notify TvShowPanel for any UI iteraction.
 *
 * @param mm
 * @param seasonNumber
 * @param episodeNumber
 * @param filePath
 */
export function handleEpisodeFileSelect(
  mm: MediaMetadata,
  seasonNumber: number,
  episodeNumber: number,
  filePath: string,
  onError: (error: string) => void
): MediaMetadata {

  if (!mm.files) {
    onError("Files list is not available");
    return mm;
  }

  if (seasonNumber === undefined || episodeNumber === undefined) {
    onError("Invalid episode: season or episode number is missing");
    return mm;
  }

  if (!mm.mediaFolderPath) {
    onError("Media folder path is not available");
    return mm;
  }

  const filePathInPosix = Path.posix(filePath);

  const isWindows = Path.isWindows();

  const normalizedSelectedPath = isWindows ? filePathInPosix.toLowerCase() : filePathInPosix;
  const normalizedFiles = mm.files.map(f => isWindows ? f.toLowerCase() : f);

  let fileFound = false;
  let matchedFile = "";
  for (let i = 0; i < mm.files.length; i++) {
    const normalizedFile = normalizedFiles[i];
    if (normalizedFile === normalizedSelectedPath) {
      fileFound = true;
      matchedFile = mm.files[i];
      break;
    }
  }

  if (!fileFound) {
    onError("Selected file is not in the media folder");
    return mm;
  }

  const updatedMediaFiles = updateMediaFileMetadatas(
    mm.mediaFiles ?? [],
    matchedFile,
    seasonNumber,
    episodeNumber
  );

  return {
    ...mm,
    mediaFiles: updatedMediaFiles,
  };
}