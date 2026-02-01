import { mkdir } from "fs/promises";
import { Path } from "@core/path";
import { mediaMetadataDir, metadataCacheFilePath } from "@/route/mediaMetadata/utils";
import type { MediaMetadata } from "@core/types";
import type { McpToolResponse } from "./mcpToolBase";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export interface WriteMediaMetadataParams {
  /** Media metadata object to write (must include mediaFolderPath) */
  metadata: MediaMetadata;
}

/**
 * Write or update media metadata for a folder. This will create or overwrite the metadata cache.
 *
 * @param params - Tool parameters containing metadata object
 * @param params.metadata - The metadata object to write (must include mediaFolderPath)
 * @returns Promise resolving to MCP tool response with success confirmation or error
 *
 * Note: This is a destructive operation that will overwrite any existing metadata
 * for the specified folder. The mediaFolderPath in the metadata determines
 * where the cache file will be stored.
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

/**
 * Register the write-media-metadata tool with the MCP server.
 */
export function registerWriteMediaMetadataTool(server: McpServer): void {
  server.registerTool(
    "write-media-metadata",
    {
      description: "Write media metadata to the cache. Requires metadata object with mediaFolderPath.",
      inputSchema: {
        type: "object",
        properties: {
          metadata: {
            type: "object",
            description: "The media metadata object to write",
            properties: {
              mediaFolderPath: { type: "string" },
              mediaName: { type: "string" },
              type: { type: "string" },
              tmdbTvShow: { type: "object" },
            },
            required: ["mediaFolderPath"],
          },
        },
        required: ["metadata"],
      },
    } as any,
    async (args: WriteMediaMetadataParams) => {
      return handleWriteMediaMetadata(args);
    }
  );
}
