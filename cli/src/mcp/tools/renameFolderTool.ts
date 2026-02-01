import { stat } from "node:fs/promises";
import { rename } from "node:fs/promises";
import { Path } from "@core/path";
import { metadataCacheFilePath } from "@/route/mediaMetadata/utils";
import type { McpToolResponse } from "./mcpToolBase";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export interface RenameFolderParams {
  from: string;
  to: string;
}

/**
 * Rename a media folder.
 * This is a destructive operation - the folder will be renamed on disk.
 * Metadata cache files will also be updated.
 */
export async function handleRenameFolder(params: RenameFolderParams): Promise<McpToolResponse> {
  const { from, to } = params;

  if (!from || typeof from !== "string" || from.trim() === "") {
    return {
      content: [{ type: "text" as const, text: "Invalid path: 'from' must be a non-empty string" }],
      isError: true,
    };
  }

  if (!to || typeof to !== "string" || to.trim() === "") {
    return {
      content: [{ type: "text" as const, text: "Invalid path: 'to' must be a non-empty string" }],
      isError: true,
    };
  }

  try {
    const fromPlatformPath = Path.toPlatformPath(from);
    const toPlatformPath = Path.toPlatformPath(to);

    // Check if source folder exists
    try {
      const stats = await stat(fromPlatformPath);
      if (!stats.isDirectory()) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ renamed: false, error: "Source path is not a directory" }) }],
        };
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ renamed: false, error: "Source folder not found" }) }],
        };
      }
      throw error;
    }

    // Check if destination already exists
    try {
      const destStats = await stat(toPlatformPath);
      if (destStats.isDirectory()) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ renamed: false, error: "Destination folder already exists" }) }],
        };
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
      // Destination doesn't exist, which is fine
    }

    // Perform the rename
    await rename(fromPlatformPath, toPlatformPath);

    // Update metadata cache file if it exists
    const fromPosixPath = Path.posix(from);
    const oldMetadataPath = metadataCacheFilePath(fromPosixPath);
    const oldMetadataFile = Bun.file(oldMetadataPath);

    if (await oldMetadataFile.exists()) {
      const metadata = await oldMetadataFile.json();
      const toPosixPath = Path.posix(to);

      // Update the mediaFolderPath in metadata
      metadata.mediaFolderPath = toPosixPath;

      // Write to new location
      const newMetadataPath = metadataCacheFilePath(toPosixPath);
      await Bun.write(newMetadataPath, JSON.stringify(metadata, null, 2));

      // Delete old metadata file
      await oldMetadataFile.unlink();
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ renamed: true, from: fromPlatformPath, to: toPlatformPath }) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text" as const, text: `Error renaming folder: ${message}` }],
      isError: true,
    };
  }
}

/**
 * Register the rename-folder tool with the MCP server.
 */
export function registerRenameFolderTool(server: McpServer): void {
  server.registerTool(
    "rename-folder",
    {
      description: "Rename a media folder. This is a destructive operation - the folder will be renamed on disk and metadata cache will be updated.",
      inputSchema: {
        type: "object",
        properties: {
          from: {
            type: "string",
            description: "The current absolute path of the folder to rename",
          },
          to: {
            type: "string",
            description: "The new absolute path for the folder",
          },
        },
        required: ["from", "to"],
      },
    } as any,
    async (args: RenameFolderParams) => {
      return handleRenameFolder(args);
    }
  );
}
