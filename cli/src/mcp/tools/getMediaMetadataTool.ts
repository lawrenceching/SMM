import { stat } from "node:fs/promises";
import { Path } from "@core/path";
import { findMediaMetadata, writeMediaMetadata } from "@/utils/mediaMetadata";
import { listFiles } from "@/utils/files";
import type { MediaMetadata } from "@core/types";
import type { McpToolResponse } from "./mcpToolBase";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export interface GetMediaMetadataParams {
  mediaFolderPath: string;
}

/**
 * Get media metadata for a folder.
 * Returns the cached metadata if it exists.
 */
export async function handleGetMediaMetadata(params: GetMediaMetadataParams): Promise<McpToolResponse> {
  const { mediaFolderPath } = params;

  if (!mediaFolderPath || typeof mediaFolderPath !== "string" || mediaFolderPath.trim() === "") {
    return {
      content: [{ type: "text" as const, text: "Invalid path: mediaFolderPath must be a non-empty string" }],
      isError: true,
    };
  }

  try {
    const normalizedPath = Path.toPlatformPath(mediaFolderPath);

    // Check if folder exists
    try {
      const stats = await stat(normalizedPath);
      if (!stats.isDirectory()) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ found: false, error: "Path is not a directory" }) }],
        };
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ found: false, error: "Folder not found" }) }],
        };
      }
      throw error;
    }

    // Find metadata using POSIX path
    const posixPath = Path.posix(mediaFolderPath);
    const metadata = await findMediaMetadata(posixPath);

    if (!metadata) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ found: false, error: "No metadata cached for this folder" }) }],
      };
    }

    // Update files list from actual folder
    const files = await listFiles(new Path(normalizedPath), true);
    const metadataWithFiles: MediaMetadata & { files: string[] } = {
      ...metadata,
      files,
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ found: true, metadata: metadataWithFiles }, null, 2) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text" as const, text: `Error reading media metadata: ${message}` }],
      isError: true,
    };
  }
}

/**
 * Register the get-media-metadata tool with the MCP server.
 */
export function registerGetMediaMetadataTool(server: McpServer): void {
  server.registerTool(
    "get-media-metadata",
    {
      description: "Get cached media metadata for a folder. Returns metadata including type, TMDB ID, name, and seasons.",
      inputSchema: {
        mediaFolderPath: z.string().describe("The absolute path of the media folder"),
      },
    } as any,
    async (args: any) => {
      return handleGetMediaMetadata(args);
    }
  );
}
