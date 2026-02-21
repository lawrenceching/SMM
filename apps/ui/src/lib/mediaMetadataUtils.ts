import { listFiles } from "@/api/listFiles";
import type { MediaMetadata } from "@core/types";
import type { UIMediaMetadata } from "@/types/UIMediaMetadata";
import { Path } from "@core/path";
import type { readMediaMetadataApi } from "@/api/readMediaMatadata";
import { createMediaMetadata } from "@core/mediaMetadata";

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

export async function loadUIMediaMetadata(
  folderInPlatformFormat: string, 
  options: {
    readMediaMetadataApi: (folderInPlatformFormat: string) => ReturnType<typeof readMediaMetadataApi>,
    listFilesApi: (options: { path: string, recursively?: boolean, onlyFiles?: boolean }, signal?: AbortSignal) => ReturnType<typeof listFiles>,
    callback: (mm: UIMediaMetadata) => void
  }) {

    const {
      readMediaMetadataApi,
      listFilesApi,
      callback,
    } = options;


  try {

    let mm: UIMediaMetadata = {
      mediaFolderPath: Path.posix(folderInPlatformFormat),
      status: 'loading',
    }

    callback(mm)

    const resp = await readMediaMetadataApi(folderInPlatformFormat)
    if (resp.error) {
        console.error(`[loadUIMediaMetadata] Failed to read media metadata for folder: ${mm.mediaFolderPath}`, resp.error)
        return
    }
    if (resp.data === undefined) {
        console.error(`[loadUIMediaMetadata] Failed to read media metadata for folder: ${mm.mediaFolderPath}`, resp.error)
        return
    }


    console.log(`[loadUIMediaMetadata] loaded media metadata for folder: ${folderInPlatformFormat}`)
    mm = {
      ...resp.data,
      status: 'loading',
    }
    callback(mm)
    

    const listFilesResp = await listFilesApi({ path: folderInPlatformFormat, recursively: true, onlyFiles: true })
    if (listFilesResp.error) {
        console.error(`[loadUIMediaMetadata] Failed to list files for folder: ${mm.mediaFolderPath}`, listFilesResp.error)
        return
    }
    if (listFilesResp.data === undefined) {
        console.error(`[loadUIMediaMetadata] Failed to list files for folder: ${mm.mediaFolderPath}`, listFilesResp.error)
        return
    }

    console.log(`[loadUIMediaMetadata] loaded files for folder: ${folderInPlatformFormat}`)
    mm = {
      ...mm,
      files: listFilesResp.data.items.map(item => Path.posix(item.path)),
      status: 'ok',
    }
    callback(mm)
    

} catch (error) {
    console.error(`[loadUIMediaMetadata] Failed to read media metadata for folder: ${folderInPlatformFormat}`, error)
    callback({
      mediaFolderPath: Path.posix(folderInPlatformFormat),
      status: 'error_loading_metadata',
    })
    return
}

}