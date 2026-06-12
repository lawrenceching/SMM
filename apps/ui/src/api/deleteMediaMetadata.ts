import { hello } from "./hello";
import { deleteFile } from "./deleteFile";
import { metadataCacheFilePath } from "./readMediaMetadataV2";

/**
 * Delete the media metadata cache file for a media folder.
 *
 * Computes the cache file path from the bootstrap `appDataDir`
 * (fetched via `hello()`) and the folder's POSIX path, then calls
 * the unified `deleteFile()` API. Replaces the deprecated
 * `/api/deleteMediaMetadata` route.
 *
 * The unified `deleteFile` API treats ENOENT (file already absent)
 * as idempotent success, so this helper does not need to issue a
 * warning for "metadata not found" cases.
 */
export async function deleteMediaMetadata(path: string): Promise<void> {
  const systemConfig = await hello();
  const metadataFilePath = metadataCacheFilePath(
    systemConfig.appDataDir,
    path,
  );
  const result = await deleteFile(metadataFilePath);
  if (result.error) {
    throw new Error(`Failed to delete media metadata: ${result.error}`);
  }
}