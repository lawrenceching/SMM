import { stat } from "node:fs/promises";
import { Path } from "@core/path";
import type { McpToolResponse } from "./mcpToolBase";

export interface IsFolderExistParams {
  path: string;
}

/**
 * Check if a folder exists at the specified path.
 * Accepts paths in both POSIX and Windows format.
 */
export async function handleIsFolderExist(params: IsFolderExistParams): Promise<McpToolResponse> {
  const { path } = params;

  if (!path || typeof path !== "string" || path.trim() === "") {
    return {
      content: [{ type: "text" as const, text: "Invalid path: path must be a non-empty string" }],
      isError: true,
    };
  }

  try {
    const normalizedPath = Path.toPlatformPath(path);
    const stats = await stat(normalizedPath);

    if (stats.isDirectory()) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ exists: true, path: normalizedPath }) }],
      };
    } else {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ exists: false, path: normalizedPath, reason: "Path exists but is not a directory" }) }],
      };
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || (error as NodeJS.ErrnoException).code === "ENOTFOUND") {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ exists: false, path: path, reason: "Path does not exist" }) }],
      };
    }
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text" as const, text: `Error checking folder existence: ${message}` }],
      isError: true,
    };
  }
}
