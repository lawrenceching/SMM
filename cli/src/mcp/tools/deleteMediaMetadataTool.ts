import { Path } from "@core/path";
import { metadataCacheFilePath } from "@/route/mediaMetadata/utils";
import { unlink } from "fs/promises";
import type { McpToolResponse } from "./mcpToolBase";

export interface DeleteMediaMetadataParams {
  mediaFolderPath: string;
}

/**
 * Delete cached media metadata for a folder.
 */
export async function handleDeleteMediaMetadata(params: DeleteMediaMetadataParams): Promise<McpToolResponse> {
  const { mediaFolderPath } = params;

  if (!mediaFolderPath || typeof mediaFolderPath !== "string" || mediaFolderPath.trim() === "") {
    return {
      content: [{ type: "text" as const, text: "Invalid path: mediaFolderPath must be a non-empty string" }],
      isError: true,
    };
  }

  try {
    // Convert to POSIX path for cache file lookup
    const folderPathInPosix = Path.posix(mediaFolderPath);
    const metadataFilePath = metadataCacheFilePath(folderPathInPosix);

    // Check if file exists
    const file = Bun.file(metadataFilePath);
    const exists = await file.exists();

    if (!exists) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ deleted: false, error: "Metadata file not found" }) }],
      };
    }

    // Delete the file
    await file.unlink();

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ deleted: true, path: folderPathInPosix }) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text" as const, text: `Error deleting media metadata: ${message}` }],
      isError: true,
    };
  }
}
