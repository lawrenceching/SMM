import { Path } from "@core/path";
import { z } from "zod";
import type { ToolDefinition } from "./types";
import { createSuccessResponse, createErrorResponse } from "@/mcp/tools/mcpToolBase";
import { acknowledge } from "@/utils/socketIO";
import logger from "../../lib/logger";
import { broadcastUserConfigFolderRenamedEvent } from "@/events/userConfigUpdatedEvent";
import { getLocalizedToolDescription } from '@/i18n/helpers';
import { doRenameFolder } from "@/route/RenameFolder";

export interface RenameFolderParams {
  from: string;
  to: string;
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

  // Check for abort signal
  if (abortSignal?.aborted) {
    logger.info({
      file: "tools/renameFolder.ts"
    }, "[MCP] rename-folder tool aborted: abort signal detected")
    return createErrorResponse("Request was aborted");
  }

  // Validate 'from' path
  if (!from || typeof from !== "string" || from.trim() === "") {
    logger.warn({
      from,
      reason: "from path is empty or invalid",
      file: "tools/renameFolder.ts"
    }, "[MCP] rename-folder tool validation failed: invalid 'from' path")
    return createSuccessResponse({ renamed: false, from: "", to: "", error: "Invalid path: 'from' must be a non-empty string" });
  }

  // Validate 'to' path
  if (!to || typeof to !== "string" || to.trim() === "") {
    logger.warn({
      to,
      reason: "to path is empty or invalid",
      file: "tools/renameFolder.ts"
    }, "[MCP] rename-folder tool validation failed: invalid 'to' path")
    return createSuccessResponse({ renamed: false, from: from || "", to: "", error: "Invalid path: 'to' must be a non-empty string" });
  }

  try {
    const result = await doRenameFolder({ from, to });

    const fromPlatformPath = Path.toPlatformPath(from);
    const toPlatformPath = Path.toPlatformPath(to);

    if (result.error) {
      logger.info({
        from, to, error: result.error,
        file: "tools/renameFolder.ts",
      }, "[MCP] rename-folder tool ended with error from doRenameFolder")
      return createSuccessResponse({ renamed: false, from: fromPlatformPath, to: toPlatformPath, error: result.error });
    }

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
