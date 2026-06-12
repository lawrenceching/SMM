import path from "node:path";
import { stat, unlink } from "node:fs/promises";
import { z } from "zod/v3";
import { Path } from "@smm/core/path";
import type { DeleteFileRequestBody, DeleteFileResponseBody } from "@smm/core/types";
import { validatePathIsInAllowlist } from "./allowlist.ts";
import type { CoreRoutesConfig } from "./types.ts";

export type { DeleteFileRequestBody, DeleteFileResponseBody };

const deleteFileRequestSchema = z.object({
  path: z.string().min(1, "Path is required"),
});

/**
 * Pure function backing `POST /api/deleteFile`.
 *
 * Validates the body via zod, asserts the path is in the allowlist,
 * then permanently deletes the file via `node:fs/promises.unlink`.
 * Replaces the previous `apps/cli/src/route/DeleteFile.ts`
 * implementation that used the restrictive
 * `isManagedYtdlpCookiesPath` predicate; the API is now generic
 * "delete a managed file" and is also used by the UI to delete media
 * metadata cache files (`{appDataDir}/metadata/{sanitized-folder}.json`).
 *
 * Semantics (mirroring the prior `permanentlyDeleteFile` helper):
 * - `{ error: "Validation Failed: ..." }` on zod failure.
 * - `{ error: "Path \"...\" is not in the allowlist" }` on allowlist
 *   rejection.
 * - `{ error: "Path Is Directory: ... is a directory, not a file" }`
 *   when `stat` succeeds but the entry is not a file.
 * - `{ error: "Cannot access file: ..." }` on a non-ENOENT `stat`
 *   error.
 * - `{ error: "Permission denied: Cannot delete file ..." }` on
 *   `EACCES`/`EPERM` during `unlink`.
 * - `{ error: "Failed to delete file ...: ..." }` on other `unlink`
 *   errors.
 * - `{ error: "Unexpected Error: ..." }` on the outer try/catch.
 * - `{ data: { path } }` on success. ENOENT during `stat` or `unlink`
 *   is treated as success (idempotent deletion).
 */
export async function doDeleteFile(
  body: DeleteFileRequestBody,
  config: Pick<CoreRoutesConfig, "allowlist" | "logger">,
): Promise<DeleteFileResponseBody> {
  const { logger, allowlist } = config;

  try {
    const validationResult = deleteFileRequestSchema.safeParse(body);

    if (!validationResult.success) {
      logger?.info(
        { issues: validationResult.error.issues },
        "doDeleteFile: validation failed",
      );
      return {
        error: `Validation Failed: ${validationResult.error.issues.map((i) => i.message).join(", ")}`,
      };
    }

    const { path: filePath } = validationResult.data;

    logger?.debug({ filePath }, "doDeleteFile: processing request");

    const resolvedPath = path.resolve(filePath);
    const posixPath = Path.posix(resolvedPath);

    if (!validatePathIsInAllowlist(posixPath, allowlist)) {
      logger?.warn({ filePath: posixPath }, "doDeleteFile: path not in allowlist");
      return {
        error: `Path "${filePath}" is not in the allowlist`,
      };
    }

    const platformPath = Path.toPlatformPath(posixPath);

    try {
      const fileStats = await stat(platformPath);
      if (!fileStats.isFile()) {
        logger?.info({ filePath: platformPath }, "doDeleteFile: path is not a file");
        return {
          error: `Path Is Directory: ${filePath} is a directory, not a file`,
        };
      }
    } catch (error) {
      const errorCode = (error as NodeJS.ErrnoException).code;
      if (errorCode === "ENOENT") {
        logger?.info({ filePath: platformPath }, "doDeleteFile: file already absent");
        return { data: { path: platformPath } };
      }
      logger?.error({ filePath: platformPath, error }, "doDeleteFile: cannot access file");
      return {
        error: `Cannot access file: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }

    try {
      await unlink(platformPath);
      logger?.info({ filePath: platformPath }, "doDeleteFile: file deleted successfully");
      return { data: { path: platformPath } };
    } catch (error) {
      const errorCode = (error as NodeJS.ErrnoException).code;
      if (errorCode === "ENOENT") {
        logger?.info({ filePath: platformPath }, "doDeleteFile: file already absent during unlink");
        return { data: { path: platformPath } };
      }
      if (errorCode === "EACCES" || errorCode === "EPERM") {
        logger?.warn({ filePath: platformPath }, "doDeleteFile: permission denied");
        return {
          error: `Permission denied: Cannot delete file ${filePath}`,
        };
      }
      logger?.error({ filePath: platformPath, error }, "doDeleteFile: unlink failed");
      return {
        error: `Failed to delete file ${filePath}: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  } catch (error) {
    logger?.error({ error }, "doDeleteFile: unexpected error");
    return {
      error: `Unexpected Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

