import type { MediaMetadata } from "@smm/types"
import { basename } from "@/lib/path"
import type { FolderListItemProps } from "@/components/sidebar/FolderListItem"
import type { UIMediaFolder, UIMediaFolderStatus } from "@/types/UIMediaFolder"

function displayNameFromMetadata(metadata: MediaMetadata | undefined, path: string): string {
  if (!metadata) return basename(path) || "未识别媒体名称"
  if (metadata.tvShow) return metadata.tvShow.name
  if (metadata.movie) return metadata.movie.name
  return basename(metadata.mediaFolderPath ?? path) || "未识别媒体名称"
}

/**
 * Map a raw media metadata type (`*-folder`) to the plain media type used by
 * sidebar filters and row props. Returns `undefined` for untyped folders so
 * they are excluded from type-specific filters.
 */
export function mediaTypeFromMetadataType(
  type: MediaMetadata["type"] | undefined,
): FolderListItemProps["mediaType"] | undefined {
  if (!type) return undefined
  if (type === "tvshow-folder") return "tvshow"
  if (type === "music-folder") return "music"
  if (type === "movie-folder") return "movie"
  return undefined
}

function mediaTypeFromMetadata(metadata: MediaMetadata | undefined): FolderListItemProps["mediaType"] {
  return mediaTypeFromMetadataType(metadata?.type) ?? "movie"
}

function mapFolderStatusToItemStatus(
  status: UIMediaFolderStatus,
): NonNullable<FolderListItemProps["status"]> {
  if (status === "updating" || status === "initializing" || status === "loading") {
    return "loading"
  }
  if (status === "error_loading_metadata") return "folder_not_found"
  if (
    status === "idle" ||
    status === "pending_for_initialization" ||
    status === "ok" ||
    status === "folder_not_found"
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
): FolderListItemProps {
  const path = folder.path
  return {
    path,
    mediaName: displayNameFromMetadata(metadata, path),
    mediaType: mediaTypeFromMetadata(metadata),
    status: mapFolderStatusToItemStatus(folder.status),
  }
}
