import { Path } from "@core/path";
import { listFiles } from "@/utils/files";
import { z } from "zod";
import type { ToolDefinition } from "./types";
import { createSuccessResponse, createErrorResponse } from "@/mcp/tools/mcpToolBase";

interface ListFilesParams {
  /** Path to the directory to list files from */
  folderPath: string;
  /** Whether to list files recursively (default: false) */
  recursive?: boolean;
  /** Filter pattern for files/folders (supports wildcards) */
  filter?: string;
}

/**
 * List files and folders in a directory with optional filtering.
 * Accepts paths in both POSIX and Windows format.
 */
export async function handleListFiles(params: ListFilesParams): Promise<ReturnType<typeof createSuccessResponse> | ReturnType<typeof createErrorResponse>> {
  const { folderPath } = params;

  if (!folderPath || typeof folderPath !== "string" || folderPath.trim() === "") {
    return createErrorResponse("Invalid path: path must be a non-empty string");
  }

  try {
    const normalizedPath = Path.toPlatformPath(folderPath);
    const files = await listFiles(new Path(normalizedPath), true);

    return createSuccessResponse({
      files,
      count: files.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return createErrorResponse(`Error listing files: ${message}`);
  }
}

export function getTool(clientId?: string): ToolDefinition {
  return {
    toolName: "list-files",
    description:
      "List all files in a folder recursively. Accepts paths in POSIX or Windows format. Returns file paths in POSIX format. Supports optional filter pattern for filtering results.",
    inputSchema: z.object({
      folderPath: z.string().describe("The absolute path of the folder to list files from"),
      recursive: z.boolean().optional().default(false).describe("Whether to list files recursively (default: false)"),
      filter: z.string().optional().describe("Filter pattern for files/folders (supports wildcards)"),
    }),
    outputSchema: z.object({
      files: z.array(z.string()).describe("Array of file paths"),
      count: z.number().describe("Number of files listed"),
    }),
    execute: async (args: { folderPath: string; recursive?: boolean; filter?: string }) => {
      return handleListFiles(args);
    },
  };
}

export function listFilesAgentTool(clientId: string) {
  return {
    description: getTool(clientId).description,
    inputSchema: getTool(clientId).inputSchema,
    outputSchema: getTool(clientId).outputSchema,
    execute: (args: any) => getTool(clientId).execute(args),
  };
}

export function listFilesMcpTool() {
  return getTool();
}

// Keep the original export for backward compatibility
export const listFilesTool = {
  description: "List all files in a folder recursively. Accepts paths in POSIX or Windows format. Returns file paths in POSIX format.",
  inputSchema: z.object({
    folderPath: z.string().describe("The absolute path of the folder to list files from"),
    recursive: z.boolean().optional().default(false).describe("Whether to list files recursively (default: false)"),
    filter: z.string().optional().describe("Filter pattern for files/folders (supports wildcards)"),
  }),
  execute: async ({ folderPath, recursive, filter }: { folderPath: string; recursive?: boolean; filter?: string }, abortSignal?: AbortSignal) => {
    if (abortSignal?.aborted) {
      throw new Error("Request was aborted");
    }

    if (!folderPath || typeof folderPath !== "string" || folderPath.trim() === "") {
      return { files: [], count: 0, error: "Invalid path: path must be a non-empty string" };
    }

    try {
      const normalizedPath = Path.toPlatformPath(folderPath);
      const files = await listFiles(new Path(normalizedPath), true);

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
