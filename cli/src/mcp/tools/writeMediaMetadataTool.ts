import { mkdir } from "fs/promises";
import { Path } from "@core/path";
import { mediaMetadataDir, metadataCacheFilePath } from "@/route/mediaMetadata/utils";
import type { MediaMetadata } from "@core/types";
import type { McpToolResponse } from "./mcpToolBase";

export interface WriteMediaMetadataParams {
  metadata: MediaMetadata;
}

/**
 * Write media metadata to the cache.
 * Requires mediaFolderPath in the metadata object.
 */
export async function handleWriteMediaMetadata(params: WriteMediaMetadataParams): Promise<McpToolResponse> {
  const { metadata } = params;

  if (!metadata || typeof metadata !== "object") {
    return {
      content: [{ type: "text" as const, text: "Invalid request: metadata is required" }],
      isError: true,
    };
  }

  if (!metadata.mediaFolderPath) {
    return {
      content: [{ type: "text" as const, text: "Invalid request: metadata.mediaFolderPath is required" }],
      isError: true,
    };
  }

  try {
    // Ensure the metadata directory exists
    await mkdir(mediaMetadataDir, { recursive: true });

    // Normalize the folder path
    const normalizedFolderPath = Path.posix(metadata.mediaFolderPath);
    const normalizedMetadata = {
      ...metadata,
      mediaFolderPath: normalizedFolderPath,
    };

    // Write metadata to file
    const metadataFilePath = metadataCacheFilePath(normalizedFolderPath);
    await Bun.write(metadataFilePath, JSON.stringify(normalizedMetadata, null, 2));

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: true, path: normalizedFolderPath }) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text" as const, text: `Error writing media metadata: ${message}` }],
      isError: true,
    };
  }
}
