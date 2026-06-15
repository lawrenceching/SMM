import { stat } from "node:fs/promises";
import { z } from "zod/v3";
import { Path } from "@smm/core/path";
import type { IsFolderExistOutput } from "@smm/core/types/ai-tools/isFolderExist";
import {
  isFolderExistInvalidPath,
  isFolderExistNotDirectory,
  isFolderExistNotFound,
  isFolderExistSucceeded,
  isFolderExistCheckFailed,
} from "@smm/core/ai-tool/isFolderExistResult";
import type { CoreRoutesConfig } from "./types.ts";

/**
 * Request body for `POST /api/isFolderAvailable`.
 */
export interface IsFolderAvailableRequestBody {
  /**
   * Absolute or resolved folder path as understood by the server
   * (native OS form). Must be a non-empty string.
   */
  path: string;
}

/**
 * Response body for `POST /api/isFolderAvailable`.
 */
export interface IsFolderAvailableResponseBody {
  /**
   * True iff `stat` succeeds on the path and the entry is a
   * directory (after symlink resolution).
   */
  available: boolean;
  /** Present when `available` is false (validation, missing path, not a directory, etc.) */
  reason?: string;
}

const isFolderAvailableRequestSchema = z.object({
  path: z.string().min(1, "path is required"),
});

/**
 * Detailed folder existence check shared by AI tools and HTTP API.
 */
export async function resolveFolderExistence(
  folderPath: string,
): Promise<IsFolderExistOutput> {
  if (!folderPath || typeof folderPath !== "string" || folderPath.trim() === "") {
    return isFolderExistInvalidPath();
  }

  try {
    const normalizedPath = Path.toPlatformPath(folderPath);
    const stats = await stat(normalizedPath);

    if (stats.isDirectory()) {
      return isFolderExistSucceeded(folderPath);
    }
    return isFolderExistNotDirectory(folderPath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTFOUND") {
      return isFolderExistNotFound(folderPath);
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Error checking folder existence: ${message}`);
  }
}

/**
 * True when the path exists, is accessible, and is a directory
 * (after symlink resolution).
 */
export async function checkFolderPathAvailable(folderPath: string): Promise<boolean> {
  const result = await resolveFolderExistence(folderPath);
  return result.exists;
}

/**
 * Pure function backing `POST /api/isFolderAvailable`.
 */
export async function doIsFolderAvailable(
  body: IsFolderAvailableRequestBody,
  _config: Partial<CoreRoutesConfig> = {},
): Promise<IsFolderAvailableResponseBody> {
  const parsed = isFolderAvailableRequestSchema.safeParse(body);
  if (!parsed.success) {
    return { available: false, reason: "path is required" };
  }

  try {
    const result = await resolveFolderExistence(parsed.data.path);
    if (result.exists) {
      _config.logger?.debug({ path: parsed.data.path }, "doIsFolderAvailable: folder exists");
    } else {
      _config.logger?.info(
        { path: parsed.data.path, reason: result.reason },
        "doIsFolderAvailable: folder not available",
      );
    }
    return {
      available: result.exists,
      reason: result.reason,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    _config.logger?.error({ path: parsed.data.path, error: message }, "doIsFolderAvailable: check failed");
    return {
      available: false,
      reason: isFolderExistCheckFailed(parsed.data.path, message).reason,
    };
  }
}
