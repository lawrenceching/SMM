import { Path } from "@core/path";
import { listFiles } from "@/utils/files";
import type { McpToolResponse } from "./mcpToolBase";

export interface ListFilesParams {
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
 * 
 * @param params - Tool parameters containing folder path and options
 * @param params.folderPath - Path to the directory to list
 * @param params.recursive - Whether to list files recursively (default: false)
 * @param params.filter - Filter pattern for files/folders (supports wildcards)
 * @returns Promise resolving to MCP tool response with file listing or error
 */
export async function handleListFiles(params: ListFilesParams): Promise<McpToolResponse> {
  const { folderPath } = params;

  if (!folderPath || typeof folderPath !== "string" || folderPath.trim() === "") {
    return {
      content: [{ type: "text" as const, text: "Invalid path: path must be a non-empty string" }],
      isError: true,
    };
  }

  try {
    const normalizedPath = Path.toPlatformPath(folderPath);
    const files = await listFiles(new Path(normalizedPath), true);

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ files, count: files.length }) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text" as const, text: `Error listing files: ${message}` }],
      isError: true,
    };
  }
}
