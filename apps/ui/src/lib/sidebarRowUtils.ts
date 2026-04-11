import type { MediaMetadata } from "@core/types"
import { basename } from "@/lib/path"
import type { MediaFolderListItemV2Props } from "@/components/sidebar/MediaFolderListItemV2"
import type { UIMediaFolder, UIMediaFolderStatus } from "@/types/UIMediaFolder"

function displayNameFromMetadata(metadata: MediaMetadata | undefined, path: string): string {
  if (!metadata) return basename(path) || "未识别媒体名称"
  if (metadata.tvShow) return metadata.tvShow.name
  if (metadata.movie) return metadata.movie.name
  return basename(metadata.mediaFolderPath ?? path) || "未识别媒体名称"
}

function mediaTypeFromMetadata(metadata: MediaMetadata | undefined): MediaFolderListItemV2Props["mediaType"] {
  if (!metadata?.type) return "movie"
  if (metadata.type === "tvshow-folder") return "tvshow"
  if (metadata.type === "music-folder") return "music"
  if (metadata.type === "movie-folder") return "movie"
  return "movie"
}

function mapFolderStatusToItemStatus(
  status: UIMediaFolderStatus,
): NonNullable<MediaFolderListItemV2Props["status"]> {
  if (status === "pending_for_initialization" || status === "updating") return "loading"
  if (status === "error_loading_metadata") return "folder_not_found"
  if (
    status === "idle" ||
    status === "initializing" ||
    status === "ok" ||
    status === "folder_not_found" ||
    status === "loading"
  ) {
    return status
  }
  return "idle"
}

/**
 * Build sidebar row props from a folder row + optional metadata (e.g. TanStack Query cache).
 */
export function buildMediaFolderListItemPropsFromFolderAndMetadata(
  folder: UIMediaFolder,
  metadata: MediaMetadata | undefined,
): MediaFolderListItemV2Props {
  const path = folder.path
  return {
    path,
    mediaName: displayNameFromMetadata(metadata, path),
    mediaType: mediaTypeFromMetadata(metadata),
    status: mapFolderStatusToItemStatus(folder.status),
  }
}
