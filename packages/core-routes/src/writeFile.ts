import { z } from "zod/v3";
import path from "node:path";
import { mkdir, appendFile, writeFile, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { Path } from "@smm/core/path";
import { existedFileError, isError, ExistedFileError } from "@smm/core/errors";
import type { WriteFileRequestBody, WriteFileResponseBody } from "@smm/core/types";
import { validatePathIsInAllowlist } from "./allowlist.ts";
import type { CoreRoutesConfig } from "./types.ts";

const writeFileRequestSchema = z.object({
  path: z.string().min(1, "Path is required"),
  mode: z.enum(["overwrite", "append", "create"]),
  data: z.string(),
});

const fileLocks = new Map<string, Promise<void>>();

async function acquireFileLock(resolvedPath: string): Promise<() => void> {
  const previousLock = fileLocks.get(resolvedPath) || Promise.resolve();
  let releaseLock!: () => void;
  const newLock = new Promise<void>((r) => {
    releaseLock = r;
  });
  fileLocks.set(resolvedPath, newLock);

  try {
    await previousLock;
  } catch {
    // Previous operation failed, still proceed
  }

  return () => {
    releaseLock();
    if (fileLocks.get(resolvedPath) === newLock) {
      fileLocks.delete(resolvedPath);
    }
  };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function doWriteFile(
  body: WriteFileRequestBody,
  config: CoreRoutesConfig,
  traceId: string = "",
): Promise<WriteFileResponseBody> {
  const { logger, allowlist } = config;

  try {
    logger?.info({ traceId }, "doWriteFile: Starting file write operation");

    const validationResult = writeFileRequestSchema.safeParse(body);

    if (!validationResult.success) {
      logger?.error({ traceId, error: validationResult.error }, "doWriteFile: Validation failed");
      return {
        error: `Validation failed: ${validationResult.error.issues.map((i) => i.message).join(", ")}`,
      };
    }

    const { path: filePath, mode, data } = validationResult.data;

    logger?.debug(
      { traceId, filePath, mode, dataSize: data.length },
      "doWriteFile: Processing write request",
    );

    const resolvedPath = path.resolve(filePath);
    const posixPath = Path.posix(resolvedPath);

    if (!validatePathIsInAllowlist(posixPath, allowlist)) {
      logger?.warn({ traceId, filePath }, "doWriteFile: Path not in allowlist");
      return {
        error: `Path "${filePath}" is not in allowlist`,
      };
    }

    const release = await acquireFileLock(resolvedPath);
    try {
      const validatedPath = resolvedPath;
      const parentDir = path.dirname(validatedPath);

      try {
        await mkdir(parentDir, { recursive: true });
        logger?.debug({ traceId, parentDir }, "doWriteFile: Parent directory ensured");
      } catch (error) {
        logger?.warn({ traceId, error }, "doWriteFile: Failed to ensure parent directory");
      }

      if (mode === "create") {
        logger?.debug({ traceId, path: validatedPath }, "doWriteFile: Create mode");
        if (await fileExists(validatedPath)) {
          logger?.error({ traceId, path: validatedPath }, "doWriteFile: File already exists");
          return {
            error: existedFileError(validatedPath),
          };
        }

        try {
          await writeFile(validatedPath, data, "utf-8");
          logger?.info(
            { traceId, path: validatedPath, size: data.length },
            "doWriteFile: File written successfully (create mode)",
          );
          return {};
        } catch (error) {
          logger?.error({ traceId, path: validatedPath, error }, "doWriteFile: Failed to write file (create mode)");
          return {
            error: `Failed to write file: ${error instanceof Error ? error.message : "Unknown error"}`,
          };
        }
      }

      if (mode === "overwrite") {
        logger?.debug({ traceId, path: validatedPath }, "doWriteFile: Overwrite mode");
        try {
          await writeFile(validatedPath, data, "utf-8");
          logger?.info(
            { traceId, path: validatedPath, size: data.length },
            "doWriteFile: File written successfully (overwrite mode)",
          );
          return {};
        } catch (error) {
          logger?.error({ traceId, path: validatedPath, error }, "doWriteFile: Failed to write file (overwrite mode)");
          return {
            error: `Failed to write file: ${error instanceof Error ? error.message : "Unknown error"}`,
          };
        }
      }

      if (mode === "append") {
        logger?.debug({ traceId, path: validatedPath }, "doWriteFile: Append mode");
        try {
          await appendFile(validatedPath, data, "utf-8");
          logger?.info(
            { traceId, path: validatedPath, appendedSize: data.length },
            "doWriteFile: Data appended successfully",
          );
          return {};
        } catch (error) {
          logger?.error({ traceId, path: validatedPath, error }, "doWriteFile: Failed to append to file");
          return {
            error: `Failed to append to file: ${error instanceof Error ? error.message : "Unknown error"}`,
          };
        }
      }

      logger?.error({ traceId, mode }, "doWriteFile: Invalid mode");
      return {
        error: `Invalid mode: ${mode}`,
      };
    } finally {
      release();
    }
  } catch (error) {
    const loggableError =
      error instanceof Error
        ? {
            message: error.message,
            stack: error.stack,
            name: error.name,
          }
        : { error };

    logger?.error({ traceId, error: loggableError }, "doWriteFile: Unexpected error");

    return {
      error: `Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export { isError, ExistedFileError };
