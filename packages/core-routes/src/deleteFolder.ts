import path from "node:path";
import { rm, stat } from "node:fs/promises";
import { z } from "zod/v3";
import { Path } from "@smm/core/path";
import type { DeleteFolderRequestBody, DeleteFolderResponseBody } from "@smm/core/types";
import { validatePathIsInAllowlist } from "./allowlist.ts";
import type { CoreRoutesConfig } from "./types.ts";

export type { DeleteFolderRequestBody, DeleteFolderResponseBody };

const deleteFolderRequestSchema = z.object({
  path: z.string().min(1, "Path is required"),
});

/**
 * Pure function backing `POST /api/deleteFolder`.
 *
 * Validates the body via zod, asserts the path is in the allowlist,
 * then permanently deletes the directory via
 * `node:fs/promises.rm({ recursive: true, force: true })`.
 *
 * Semantics (mirroring {@link doDeleteFile}, adapted for directories):
 * - `{ error: "Validation Failed: ..." }` on zod failure.
 * - `{ error: "Path \"...\" is not in the allowlist" }` on allowlist
 *   rejection.
 * - `{ error: "Path Is File: ... is a file, not a directory" }`
 *   when `stat` succeeds but the entry is not a directory.
 * - `{ error: "Cannot access path: ..." }` on a non-ENOENT `stat`
 *   error.
 * - `{ error: "Permission denied: Cannot delete folder ..." }` on
 *   `EACCES`/`EPERM` during `rm`.
 * - `{ error: "Failed to delete folder ...: ..." }` on other `rm`
 *   errors.
 * - `{ error: "Unexpected Error: ..." }` on the outer try/catch.
 * - `{ data: { path } }` on success. ENOENT during `stat` or `rm`
 *   is treated as success (idempotent deletion).
 */
export async function doDeleteFolder(
  body: DeleteFolderRequestBody,
  config: Pick<CoreRoutesConfig, "allowlist" | "logger">,
): Promise<DeleteFolderResponseBody> {
  const { logger, allowlist } = config;

  try {
    const validationResult = deleteFolderRequestSchema.safeParse(body);

    if (!validationResult.success) {
      logger?.info(
        { issues: validationResult.error.issues },
        "doDeleteFolder: validation failed",
      );
      return {
        error: `Validation Failed: ${validationResult.error.issues.map((i) => i.message).join(", ")}`,
      };
    }

    const { path: folderPath } = validationResult.data;

    logger?.debug({ folderPath }, "doDeleteFolder: processing request");

    const resolvedPath = path.resolve(folderPath);
    const posixPath = Path.posix(resolvedPath);

    if (!validatePathIsInAllowlist(posixPath, allowlist)) {
      logger?.warn({ folderPath: posixPath }, "doDeleteFolder: path not in allowlist");
      return {
        error: `Path "${folderPath}" is not in the allowlist`,
      };
    }

    const platformPath = Path.toPlatformPath(posixPath);

    try {
      const folderStats = await stat(platformPath);
      if (!folderStats.isDirectory()) {
        logger?.info({ folderPath: platformPath }, "doDeleteFolder: path is not a directory");
        return {
          error: `Path Is File: ${folderPath} is a file, not a directory`,
        };
      }
    } catch (error) {
      const errorCode = (error as NodeJS.ErrnoException).code;
      if (errorCode === "ENOENT") {
        logger?.info({ folderPath: platformPath }, "doDeleteFolder: folder already absent");
        return { data: { path: platformPath } };
      }
      logger?.error({ folderPath: platformPath, error }, "doDeleteFolder: cannot access path");
      return {
        error: `Cannot access path: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }

    try {
      await rm(platformPath, { recursive: true, force: true });
      logger?.info({ folderPath: platformPath }, "doDeleteFolder: folder deleted successfully");
      return { data: { path: platformPath } };
    } catch (error) {
      const errorCode = (error as NodeJS.ErrnoException).code;
      if (errorCode === "ENOENT") {
        logger?.info({ folderPath: platformPath }, "doDeleteFolder: folder already absent during rm");
        return { data: { path: platformPath } };
      }
      if (errorCode === "EACCES" || errorCode === "EPERM") {
        logger?.warn({ folderPath: platformPath }, "doDeleteFolder: permission denied");
        return {
          error: `Permission denied: Cannot delete folder ${folderPath}`,
        };
      }
      logger?.error({ folderPath: platformPath, error }, "doDeleteFolder: rm failed");
      return {
        error: `Failed to delete folder ${folderPath}: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  } catch (error) {
    logger?.error({ error }, "doDeleteFolder: unexpected error");
    return {
      error: `Unexpected Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
