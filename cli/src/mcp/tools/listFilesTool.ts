import { Path } from "@core/path";
import { listFiles } from "@/utils/files";
import type { McpToolResponse } from "./mcpToolBase";

export interface ListFilesParams {
  path: string;
}

/**
 * List all files in a media folder recursively.
 * Accepts paths in both POSIX and Windows format.
 * Returns file paths in POSIX format.
 */
export async function handleListFiles(params: ListFilesParams): Promise<McpToolResponse> {
  const { path } = params;

  if (!path || typeof path !== "string" || path.trim() === "") {
    return {
      content: [{ type: "text" as const, text: "Invalid path: path must be a non-empty string" }],
      isError: true,
    };
  }

  try {
    const normalizedPath = Path.toPlatformPath(path);
    const folderPath = new Path(normalizedPath);

    // Check if path exists and is a directory
    const files = await listFiles(folderPath, true);

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
