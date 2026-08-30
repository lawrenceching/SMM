import { Path } from "@core/path";
import type { MediaFileMetadata } from "@smm/core";

/** Same semantics as apps/ui TvShowPanelUtils.updateMediaFileMetadatas. */
export function updateMediaFileMetadatas(
  mediaFiles: MediaFileMetadata[],
  videoFilePath: string,
  seasonNumber: number,
  episodeNumber: number,
): MediaFileMetadata[] {
  const absolutePath = Path.posix(videoFilePath);
  const next = mediaFiles
    .filter((m) => !(m.seasonNumber === seasonNumber && m.episodeNumber === episodeNumber))
    .filter((m) => m.absolutePath !== absolutePath);
  next.push({ absolutePath, seasonNumber, episodeNumber });
  return next;
}
