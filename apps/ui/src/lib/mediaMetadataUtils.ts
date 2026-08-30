import type { MediaMetadataWithFolderFiles } from "@/lib/mediaFolderFiles"
import { listMediaFolderFilePaths } from "@/lib/mediaFolderFiles"
import { createMediaMetadata } from "@smm/core/mediaMetadata"
import type { UIMediaMetadata } from "@/types/UIMediaMetadata"

export async function createInitialMediaMetadata(
  folderPathInPlatformFormat: string, 
  type: "music-folder" | "tvshow-folder" | "movie-folder",
  options?: { traceId?: string, abortSignal?: AbortSignal, mediaMetadataProps?: Partial<UIMediaMetadata> }
): Promise<UIMediaMetadata> {
  
  const mm: UIMediaMetadata = {
    status: 'idle',
    ...createMediaMetadata(folderPathInPlatformFormat, type),
    ...options?.mediaMetadataProps
  };

  const files = await listMediaFolderFilePaths(folderPathInPlatformFormat, options?.abortSignal)
  mm.files = files;

  return mm;
}

/**
 * This method need to maintain the field list of MediaMetadata, which is very error prone.
 * Don't use this method.
 * @deprecated
 * @param old 
 * @param newItems 
 * @returns 
 */
export function findUpdatedMediaMetadata(old: MediaMetadataWithFolderFiles[], newItems: MediaMetadataWithFolderFiles[]): MediaMetadataWithFolderFiles[] {
  const oldByPath = new Map(old.filter(m => m.mediaFolderPath).map(m => [m.mediaFolderPath!, m]));
  const updated: MediaMetadataWithFolderFiles[] = [];

  for (const item of newItems) {
    const path = item.mediaFolderPath;
    if (!path) continue;

    const oldItem = oldByPath.get(path);

    // New item (not in old array) - consider as changed
    if (!oldItem) {
      updated.push(item);
      continue;
    }

    // Compare relevant metadata fields
    const fieldsToCompare: (keyof MediaMetadataWithFolderFiles)[] = [
      'mediaFolderPath',
      'files',
      'tvShow',
      'movie',
      'mediaFiles',
      'type',
    ];

    let hasChanged = false;
    for (const field of fieldsToCompare) {
      if (JSON.stringify(item[field]) !== JSON.stringify(oldItem[field])) {
        hasChanged = true;
        break;
      }
    }

    if (hasChanged) {
      updated.push(item);
    }
  }

  return updated;
}
