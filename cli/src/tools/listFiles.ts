import { Path } from "@core/path";
import { videoFileExtensions } from "@core/utils";
import { listFiles } from "@/utils/files";
import { z } from "zod";
import type { ToolDefinition } from "./types";
import { createSuccessResponse, createErrorResponse } from "@/mcp/tools/mcpToolBase";
import { getLocalizedToolDescription } from '@/i18n/helpers';

interface ListFilesParams {
  /** Path to the directory to list files from */
  folderPath: string;
  /** Whether to list files recursively (default: false) */
  recursive?: boolean;
  /** Filter pattern for files/folders (supports wildcards) */
  filter?: string;
  /** Whether to return only video files (default: false) */
  videoFileOnly?: boolean;
}

/**
 * Check if a file path has a video file extension.
 */
function isVideoFile(filePath: string): boolean {
  const path = new Path(filePath);
  const ext = path.name().substring(path.name().lastIndexOf('.')).toLowerCase();
  return videoFileExtensions.includes(ext);
}

/**
 * List files and folders in a directory with optional filtering.
 * Accepts paths in both POSIX and Windows format.
 */
export async function handleListFiles(params: ListFilesParams): Promise<ReturnType<typeof createSuccessResponse> | ReturnType<typeof createErrorResponse>> {
  const { folderPath, videoFileOnly } = params;

  if (!folderPath || typeof folderPath !== "string" || folderPath.trim() === "") {
    return createErrorResponse("Invalid path: path must be a non-empty string");
  }

  try {
    const normalizedPath = Path.toPlatformPath(folderPath);
    let files = await listFiles(new Path(normalizedPath), true);

    // Filter for video files only if requested
    if (videoFileOnly) {
      files = files.filter(isVideoFile);
    }

    return createSuccessResponse({
      files,
      count: files.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return createErrorResponse(`Error listing files: ${message}`);
  }
}

export const getTool = async function (clientId?: string): Promise<ToolDefinition> {
  // Use i18n to get localized tool description based on global user's language preference
  const description = await getLocalizedToolDescription('list-files');

  return {
    toolName: "list-files",
    description: description,
    inputSchema: z.object({
      folderPath: z.string().describe("The absolute path of the folder to list files from"),
      recursive: z.boolean().optional().default(false).describe("Whether to list files recursively (default: false)"),
      filter: z.string().optional().describe("Filter pattern for files/folders (supports wildcards)"),
      videoFileOnly: z.boolean().optional().default(false).describe("Whether to return only video files (default: false)"),
    }),
    outputSchema: z.object({
      files: z.array(z.string()).describe("Array of file paths"),
      count: z.number().describe("Number of files listed"),
    }),
    execute: async (args: { folderPath: string; recursive?: boolean; filter?: string; videoFileOnly?: boolean }) => {
      return handleListFiles(args);
    },
  };
}

/**
 * Returns a tool definition with localized description for AI agent usage.
 * The description is localized based on the global user's language preference.
 *
 * @param clientId - Socket.IO client ID (for tool execution, not language)
 * @returns Promise resolving to localized tool definition
 */
export async function listFilesAgentTool(clientId: string) {
  const tool = await getTool(clientId);
  return {
    description: tool.description,
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
    execute: (args: any) => tool.execute(args),
  };
}

/**
 * Returns a tool definition with localized description for MCP server usage.
 * MCP tools use the global user's language preference.
 *
 * @returns Promise resolving to tool definition
 */
export async function listFilesMcpTool() {
  return getTool();
}

// Keep the original export for backward compatibility
export const listFilesTool = {
  description: "List all files in a folder recursively. Accepts paths in POSIX or Windows format. Returns file paths in POSIX format.",
  inputSchema: z.object({
    folderPath: z.string().describe("The absolute path of the folder to list files from"),
    recursive: z.boolean().optional().default(false).describe("Whether to list files recursively (default: false)"),
    filter: z.string().optional().describe("Filter pattern for files/folders (supports wildcards)"),
    videoFileOnly: z.boolean().optional().default(false).describe("Whether to return only video files (default: false)"),
  }),
  execute: async ({ folderPath, recursive, filter, videoFileOnly }: { folderPath: string; recursive?: boolean; filter?: string; videoFileOnly?: boolean }, abortSignal?: AbortSignal) => {
    if (abortSignal?.aborted) {
      throw new Error("Request was aborted");
    }

    if (!folderPath || typeof folderPath !== "string" || folderPath.trim() === "") {
      return { files: [], count: 0, error: "Invalid path: path must be a non-empty string" };
    }

    try {
      const normalizedPath = Path.toPlatformPath(folderPath);
      let files = await listFiles(new Path(normalizedPath), true);

      // Filter for video files only if requested
      if (videoFileOnly) {
        files = files.filter(isVideoFile);
      }

      return {
        files,
        count: files.length,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Error listing files: ${message}`);
    }
  },
};
