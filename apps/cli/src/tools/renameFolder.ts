import { stat } from "node:fs/promises";
import { rename } from "node:fs/promises";
import { Path } from "@core/path";
import { metadataCacheFilePath } from "@/route/mediaMetadata/utils";
import { z } from "zod";
import type { ToolDefinition } from "./types";
import { createSuccessResponse, createErrorResponse } from "@/mcp/tools/mcpToolBase";
import { acknowledge, broadcast } from "@/utils/socketIO";
import { renameFolderInMediaMetadata } from "@core/mediaMetadata";
import logger from "../../lib/logger";
import { renameFolderInUserConfig } from "@core/userConfig";
import { nextTraceId } from "@/utils/traceId";
import { getUserConfig, writeUserConfig } from "@/utils/config";
import { deleteMediaMetadataFile, renameMediaMetadataCacheFile } from "@/utils/mediaMetadata";
import { broadcastUserConfigFolderRenamedEvent } from "@/events/userConfigUpdatedEvent";
import { getLocalizedToolDescription } from '@/i18n/helpers';

export interface RenameFolderParams {
  from: string;
  to: string;
}


/**
 * 
 * @param mediaFolderPath - the media folder path in POSIX format
 * @param from 
 * @param to 
 */
async function renameFolderInMediaMetadataAndSave(
  {mediaFolderPath, from, to, traceId}: {mediaFolderPath: string, from: string, to: string, traceId: string}) {

  const cachePath = metadataCacheFilePath(mediaFolderPath);
  const cacheFile = Bun.file(cachePath);
  if (!await cacheFile.exists()) {
    return;
  }
  const metadata = await cacheFile.json();
  const newMetadata = renameFolderInMediaMetadata(metadata, from, to);
  await cacheFile.write(JSON.stringify(newMetadata, null, 2));

  logger.info({
    mediaFolder: Path.toPlatformPath(mediaFolderPath),
    from,
    to,
    traceId,
    file: "tools/renameFolder.ts"
  }, "renamed folder in media metadata")
}

async function renameFolderInUserConfigAndSave({from, to, traceId}: {from: string, to: string, traceId: string}) {
  const userConfig = await getUserConfig();
  const newUserConfig = renameFolderInUserConfig(userConfig, from, to);
  await writeUserConfig(newUserConfig);
  logger.info({
    userConfig: newUserConfig,
    traceId,
    file: "tools/renameFolder.ts"
  }, "renamed folder in user config")
}

/**
 * Rename a media folder.
 * This is a destructive operation - the folder will be renamed on disk.
 * Metadata cache files will also be updated.
 */
export async function handleRenameFolder(
  params: RenameFolderParams,
  abortSignal?: AbortSignal
): Promise<ReturnType<typeof createSuccessResponse> | ReturnType<typeof createErrorResponse>> {

  logger.info({
    params,
    file: "tools/renameFolder.ts"
  }, "[MCP] rename-folder tool started")

  const { from, to } = params;
  const traceId = nextTraceId();

  // Check for abort signal
  if (abortSignal?.aborted) {
    logger.info({
      traceId,
      file: "tools/renameFolder.ts"
    }, "[MCP] rename-folder tool aborted: abort signal detected")
    return createErrorResponse("Request was aborted");
  }

  // Validate 'from' path
  if (!from || typeof from !== "string" || from.trim() === "") {
    logger.warn({
      traceId,
      from,
      reason: "from path is empty or invalid",
      file: "tools/renameFolder.ts"
    }, "[MCP] rename-folder tool validation failed: invalid 'from' path")
    return createSuccessResponse({ renamed: false, from: "", to: "", error: "Invalid path: 'from' must be a non-empty string" });
  }

  // Validate 'to' path
  if (!to || typeof to !== "string" || to.trim() === "") {
    logger.warn({
      traceId,
      to,
      reason: "to path is empty or invalid",
      file: "tools/renameFolder.ts"
    }, "[MCP] rename-folder tool validation failed: invalid 'to' path")
    return createSuccessResponse({ renamed: false, from: from || "", to: "", error: "Invalid path: 'to' must be a non-empty string" });
  }

  logger.info({
    traceId,
    from,
    to,
    fromPlatformPath: Path.toPlatformPath(from),
    toPlatformPath: Path.toPlatformPath(to),
    file: "tools/renameFolder.ts"
  }, "[MCP] rename-folder tool parameters validated, proceeding with checks")

  try {
    const fromPlatformPath = Path.toPlatformPath(from);
    const toPlatformPath = Path.toPlatformPath(to);

    // Check if source folder exists
    try {
      const stats = await stat(fromPlatformPath);
      if (!stats.isDirectory()) {
        logger.warn({
          traceId,
          fromPlatformPath,
          reason: "source path is not a directory",
          file: "tools/renameFolder.ts"
        }, "[MCP] rename-folder tool failed: source path is not a directory")
        return createSuccessResponse({ renamed: false, from: fromPlatformPath, to: toPlatformPath, error: "Source path is not a directory" });
      }
      logger.info({
        traceId,
        fromPlatformPath,
        file: "tools/renameFolder.ts"
      }, "[MCP] rename-folder tool: source folder confirmed")
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        logger.warn({
          traceId,
          fromPlatformPath,
          reason: "source folder not found",
          errorCode: "ENOENT",
          file: "tools/renameFolder.ts"
        }, "[MCP] rename-folder tool failed: source folder not found")
        return createSuccessResponse({ renamed: false, from: fromPlatformPath, to: toPlatformPath, error: "Source folder not found" });
      }
      logger.error({
        traceId,
        fromPlatformPath,
        error: error instanceof Error ? error.message : String(error),
        errorCode: (error as NodeJS.ErrnoException).code,
        file: "tools/renameFolder.ts"
      }, "[MCP] rename-folder tool: unexpected error checking source folder")
      throw error;
    }

    // Check if destination already exists
    try {
      const destStats = await stat(toPlatformPath);
      if (destStats.isDirectory()) {
        logger.warn({
          traceId,
          toPlatformPath,
          reason: "destination folder already exists",
          file: "tools/renameFolder.ts"
        }, "[MCP] rename-folder tool failed: destination folder already exists")
        return createSuccessResponse({ renamed: false, from: fromPlatformPath, to: toPlatformPath, error: "Destination folder already exists" });
      }
      logger.info({
        traceId,
        toPlatformPath,
        reason: "destination exists but is not a directory",
        file: "tools/renameFolder.ts"
      }, "[MCP] rename-folder tool: destination path exists (not a directory)")
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        logger.error({
          traceId,
          toPlatformPath,
          error: error instanceof Error ? error.message : String(error),
          errorCode: (error as NodeJS.ErrnoException).code,
          file: "tools/renameFolder.ts"
        }, "[MCP] rename-folder tool: unexpected error checking destination")
        throw error;
      }
      // Destination doesn't exist, which is fine
      logger.info({
        traceId,
        toPlatformPath,
        file: "tools/renameFolder.ts"
      }, "[MCP] rename-folder tool: destination folder does not exist, proceeding")
    }

    // TODO: There are implementations for rename function
    // 1. ui\src\api\renameFile.ts
    // 2. renameFolderAgentTool in this file
    // 3. And here
    // 4. cli\src\utils\mediaMetadataUtils.ts
    // 5. cli\src\route\RenameFolder.ts
    // need to find a way to merge them

    // Step 1: Rename folder in media metadata
    logger.info({
      traceId,
      from: Path.posix(from),
      to: Path.posix(to),
      file: "tools/renameFolder.ts"
    }, "[MCP] rename-folder tool: starting renameFolderInMediaMetadataAndSave")
    await renameFolderInMediaMetadataAndSave({mediaFolderPath: Path.posix(from), from: Path.posix(from), to: Path.posix(to), traceId})
    logger.info({
      traceId,
      file: "tools/renameFolder.ts"
    }, "[MCP] rename-folder tool: completed renameFolderInMediaMetadataAndSave")

    // Step 2: Rename metadata cache file
    logger.info({
      traceId,
      from: Path.posix(from),
      to: Path.posix(to),
      file: "tools/renameFolder.ts"
    }, "[MCP] rename-folder tool: starting renameMediaMetadataCacheFile")
    await renameMediaMetadataCacheFile(Path.posix(from), Path.posix(to), { traceId });
    logger.info({
      traceId,
      file: "tools/renameFolder.ts"
    }, "[MCP] rename-folder tool: completed renameMediaMetadataCacheFile")

    // Step 3: Rename folder in user config
    logger.info({
      traceId,
      from,
      to,
      file: "tools/renameFolder.ts"
    }, "[MCP] rename-folder tool: starting renameFolderInUserConfigAndSave")
    await renameFolderInUserConfigAndSave({from, to, traceId}),
    logger.info({
      traceId,
      file: "tools/renameFolder.ts"
    }, "[MCP] rename-folder tool: completed renameFolderInUserConfigAndSave")

    // Step 4: Rename the actual folder on disk
    logger.info({
      traceId,
      from: fromPlatformPath,
      to: toPlatformPath,
      file: "tools/renameFolder.ts"
    }, "[MCP] rename-folder tool: starting filesystem rename")
    await rename(fromPlatformPath, toPlatformPath),
    logger.info({
      traceId,
      from: fromPlatformPath,
      to: toPlatformPath,
      file: "tools/renameFolder.ts"
    }, "[MCP] rename-folder tool: completed filesystem rename")

    logger.info({
      from: from,
      to: to,
      traceId,
      file: "tools/renameFolder.ts"
    }, "renamed media folder")

    broadcastUserConfigFolderRenamedEvent({
      from: fromPlatformPath,
      to: toPlatformPath,
    });
    
    const resp = createSuccessResponse({ renamed: true, from: fromPlatformPath, to: toPlatformPath });
    logger.info({
      params,
      file: "tools/renameFolder.ts",
      response: resp,
    }, "[MCP] rename-folder tool ended")

    return resp;
  } catch (error) {
    logger.error({
      params,
      file: "tools/renameFolder.ts",
      error: error instanceof Error ? error.message : String(error),
    }, "[MCP] rename-folder tool ended with error")
    const message = error instanceof Error ? error.message : String(error);
    // Use createSuccessResponse with error field instead of createErrorResponse
    // to ensure MCP validation passes with the required from/to fields
    const fromPlatformPath = Path.toPlatformPath(from);
    const toPlatformPath = Path.toPlatformPath(to);
    return createSuccessResponse({ renamed: false, from: fromPlatformPath, to: toPlatformPath, error: `Error renaming folder: ${message}` });
  }
}

export const getTool = async function (abortSignal?: AbortSignal): Promise<ToolDefinition> {
  // Use i18n to get localized tool description based on global user's language preference
  const description = await getLocalizedToolDescription('rename-folder');

  return {
    toolName: "rename-folder",
    description: description,
    inputSchema: z.object({
      from: z.string().describe("The current absolute path of the folder to rename, in POSIX or Windows format"),
      to: z.string().describe("The new absolute path for the folder, in POSIX or Windows format"),
    }),
    outputSchema: z.object({
      renamed: z.boolean().describe("Whether the folder was successfully renamed"),
      from: z.string().describe("The source path after normalization"),
      to: z.string().describe("The destination path after normalization"),
      error: z.string().optional().describe("Error message if rename failed"),
    }),
    execute: async (args: { from: string; to: string }) => {
      return handleRenameFolder(args, abortSignal);
    },
  };
}

/**
 * Returns a tool definition with localized description for AI agent usage.
 * The description is localized based on the global user's language preference.
 *
 * @param clientId - Socket.IO client ID (for tool execution, not language)
 * @param abortSignal - Optional abort signal for request cancellation
 * @returns Promise resolving to localized tool definition
 */
/**
 * Returns a tool definition for AI agent usage.
 * Uses fixed English description for synchronous return.
 *
 * @param clientId - Socket.IO client ID (for tool execution, not language)
 * @param abortSignal - Optional abort signal for request cancellation
 * @returns Tool definition (synchronous)
 */
export function renameFolderAgentTool(clientId: string, abortSignal?: AbortSignal) {
  return {
    description: `Rename a media folder in SMM.
This tool accepts the source folder path and destination folder path.
This tool should ONLY be used to rename FOLDER, NOT FILE
This tool will update media metadata accordingly.

Example: Rename folder "/path/to/old-folder" to "/path/to/new-folder".`,
    inputSchema: z.object({
      from: z.string().describe("The current absolute path of the folder to rename, in POSIX or Windows format"),
      to: z.string().describe("The new absolute path for the folder, in POSIX or Windows format"),
    }),
    outputSchema: z.object({
      renamed: z.boolean().describe("Whether the folder was successfully renamed"),
      from: z.string().describe("The source path after normalization"),
      to: z.string().describe("The destination path after normalization"),
      error: z.string().optional().describe("Error message if rename failed"),
    }),
    execute: async (args: { from: string; to: string }) => {
      if (abortSignal?.aborted) {
        throw new Error("Request was aborted");
      }

      // Ask for user confirmation
      const getFolderName = (path: string) => {
        const pathInPosix = Path.posix(path);
        const parts = pathInPosix.split("/").filter((p) => p);
        return parts[parts.length - 1] || pathInPosix;
      };

      const confirmationMessage = `Rename folder "${getFolderName(args.from)}" to "${getFolderName(args.to)}"?\n\nThis will:\n  • Rename the folder on disk\n  • Update media metadata`;

      try {
        const responseData = await acknowledge(
          {
            event: "askForConfirmation",
            data: {
              message: confirmationMessage,
            },
            clientId: clientId,
          }
        );

        const confirmed = responseData?.confirmed ?? responseData?.response === "yes";

        if (!confirmed) {
          return { renamed: false, error: "User cancelled the operation" };
        }
      } catch (error) {
        return {
          renamed: false,
          error: `Failed to get user confirmation: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
      }

      if (abortSignal?.aborted) {
        throw new Error("Request was aborted");
      }

      return handleRenameFolder(args, abortSignal);
    },
  };
}

/**
 * Returns a tool definition with localized description for MCP server usage.
 * MCP tools use the global user's language preference.
 *
 * @returns Promise resolving to tool definition
 */
export async function renameFolderMcpTool() {
  return getTool();
}

// Keep the original export for backward compatibility
export const createRenameFolderTool = (clientId: string, abortSignal?: AbortSignal) => ({
  description: `Rename a media folder in SMM.
This tool accepts the source folder path and destination folder path.
This tool should ONLY be used to rename FOLDER, NOT FILE
This tool will update media metadata accordingly.

Example: Rename folder "/path/to/old-folder" to "/path/to/new-folder".`,
  inputSchema: z.object({
    from: z.string().describe("The current absolute path of the folder to rename, in POSIX or Windows format"),
    to: z.string().describe("The new absolute path for the folder, in POSIX or Windows format"),
  }),
  execute: async ({ from, to }: { from: string; to: string }) => {
    if (abortSignal?.aborted) {
      throw new Error("Request was aborted");
    }

    // Ask for user confirmation
    const getFolderName = (path: string) => {
      const pathInPosix = Path.posix(path);
      const parts = pathInPosix.split("/").filter((p) => p);
      return parts[parts.length - 1] || pathInPosix;
    };

    const confirmationMessage = `Rename folder "${getFolderName(from)}" to "${getFolderName(to)}"?\n\nThis will:\n  • Rename the folder on disk\n  • Update media metadata`;

    try {
      const responseData = await acknowledge(
        {
          event: "askForConfirmation",
          data: {
            message: confirmationMessage,
          },
          clientId: clientId,
        }
      );

      const confirmed = responseData?.confirmed ?? responseData?.response === "yes";

      if (!confirmed) {
        return { renamed: false, error: "User cancelled the operation" };
      }
    } catch (error) {
      return {
        renamed: false,
        error: `Failed to get user confirmation: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }

    if (abortSignal?.aborted) {
      throw new Error("Request was aborted");
    }

    const result = await handleRenameFolder({ from, to }, abortSignal);

    // Convert McpToolResponse to the expected format
    if (result.isError) {
      return { renamed: false, error: result.content[0]?.text || "Unknown error" };
    }

    const structuredContent = result.structuredContent as { renamed: boolean; from?: string; to?: string; error?: string };
    return {
      renamed: structuredContent.renamed || false,
      from: structuredContent.from || from,
      to: structuredContent.to || to,
      error: structuredContent.error,
    };
  },
});
