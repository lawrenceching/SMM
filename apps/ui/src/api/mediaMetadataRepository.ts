import type { MediaMetadata } from "@core/types";
import type { UIMediaMetadata } from "@/types/UIMediaMetadata";
import { readMediaMetadataV2 } from "./readMediaMetadataV2";
import { writeMediaMetadata } from "./writeMediaMetadata";
import { deleteMediaMetadata } from "./deleteMediaMetadata";
import { listFiles } from "./listFiles";
import { Path } from "@core/path";
import { mergeRefreshedMetadata } from "@/lib/mediaMetadataRefreshUtils";

/**
 * MediaMetadataRepository handles all data access operations for media metadata.
 * This centralizes read/write/delete operations and encapsulates persistence rules.
 */
export class MediaMetadataRepository {
  /**
   * Read media metadata from cache, with fallback to blank metadata and file listing
   */
  async read(pathPosix: string, options?: { traceId?: string }): Promise<MediaMetadata> {
    return readMediaMetadataV2(pathPosix, options || {});
  }

  /**
   * Write media metadata to cache, applying persistence rules (e.g., clearing files)
   */
  async write(metadata: UIMediaMetadata, options?: { traceId?: string }): Promise<void> {
    return writeMediaMetadata(metadata, options || {});
  }

  /**
   * Delete media metadata from cache
   */
  async delete(path: string, _options?: { traceId?: string }): Promise<void> {
    return deleteMediaMetadata(path);
  }

  /**
   * Refresh metadata by re-reading from cache and merging with current UI state
   */
  async refresh(pathPosix: string, currentMetadata: UIMediaMetadata | undefined, options?: { traceId?: string }): Promise<UIMediaMetadata> {
    const response = await this.read(pathPosix, options);
    return mergeRefreshedMetadata(response, currentMetadata);
  }

  /**
   * Reload all metadata for given folders
   */
  async reloadAll(foldersInPosix: string[], currentMetadataMap: Map<string, UIMediaMetadata>, options?: { traceId?: string }): Promise<UIMediaMetadata[]> {
    const promises = foldersInPosix.map(async (path) => {
      const current = currentMetadataMap.get(path);
      return this.refresh(path, current, options);
    });

    return Promise.all(promises);
  }

  /**
   * Initialize metadata for a folder by listing files and creating initial metadata
   */
  async initialize(folderPathInPlatformFormat: string, type: "music-folder" | "tvshow-folder" | "movie-folder", options?: { traceId?: string }): Promise<UIMediaMetadata> {
    const folderPathInPosix = Path.posix(folderPathInPlatformFormat);

    // Check if metadata already exists
    try {
      const existing = await this.read(folderPathInPosix, options);
      if (existing.type) {
        return { ...existing, status: 'ok' };
      }
    } catch (error) {
      // Metadata doesn't exist, continue with initialization
    }

    // List files and create initial metadata
    const listFilesResponse = await listFiles({
      path: folderPathInPlatformFormat,
      recursively: true,
      onlyFiles: true,
    });

    const files: string[] = [];
    if (listFilesResponse.data?.items) {
      files.push(...listFilesResponse.data.items.map(item =>
        Path.posix(typeof item === 'string' ? item : item.path)
      ));
    }

    const initialMetadata: UIMediaMetadata = {
      mediaFolderPath: folderPathInPosix,
      type,
      files,
      mediaFiles: [],
      status: 'initializing',
    };

    return initialMetadata;
  }
}

// Singleton instance
export const mediaMetadataRepository = new MediaMetadataRepository();