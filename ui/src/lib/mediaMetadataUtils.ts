import { listFiles } from "@/api/listFiles";
import type { MediaMetadata } from "@core/types";
import type { UIMediaMetadata } from "@/types/UIMediaMetadata";
import { Path } from "@core/path";

export async function createInitialMediaMetadata(folderPathInPlatformFormat: string, options?: { traceId?: string, abortSignal?: AbortSignal }): Promise<UIMediaMetadata> {
  
  const mm: UIMediaMetadata = {
    mediaFolderPath: Path.posix(folderPathInPlatformFormat),
    status: 'idle',
  }

  const files = await listFiles({ path: folderPathInPlatformFormat, recursively: true, onlyFiles: true }, options?.abortSignal)
  if(files.error) {
    throw new Error(`Failed to list files: ${files.error}`);
  }
  if(files.data === undefined) {
    throw new Error(`Failed to list files: response.data is undefined`);
  }
  
  mm.files = files.data.items.map(item => Path.posix(item.path));

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
export function findUpdatedMediaMetadata(old: MediaMetadata[], newItems: MediaMetadata[]): MediaMetadata[] {
  const oldByPath = new Map(old.filter(m => m.mediaFolderPath).map(m => [m.mediaFolderPath!, m]));
  const updated: MediaMetadata[] = [];

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
    const fieldsToCompare: (keyof MediaMetadata)[] = [
      'mediaName',
      'officalMediaName',
      'tmdbTvShow',
      'tmdbMovie',
      'mediaFiles',
      'seasons',
      'poster',
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