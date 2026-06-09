import { z } from "zod/v3";
import os from "node:os";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { Path } from "@smm/core/path";
import type { ListFilesRequestBody, ListFilesResponseBody } from "@smm/core/types";
import type { CoreRoutesConfig } from "./types.ts";

const listFilesRequestSchema = z.object({
  path: z.string().min(1, "Path is required"),
  onlyFiles: z.boolean().optional(),
  onlyFolders: z.boolean().optional(),
  includeHiddenFiles: z.boolean().optional(),
  recursively: z.boolean().optional(),
});

const emptyListFilesData = {
  path: "",
  items: [] as ListFilesResponseBody["data"] extends infer D
    ? D extends { items: infer I }
      ? I
      : never
    : never,
  size: 0,
};

export async function doListFiles(
  body: ListFilesRequestBody,
  config: Pick<CoreRoutesConfig, "logger"> = {},
): Promise<ListFilesResponseBody> {
  const { logger } = config;
  const requestId = `listFiles-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  logger?.info({ requestId, body }, "[ListFiles] request received");

  try {
    const validationResult = listFilesRequestSchema.safeParse(body);

    if (!validationResult.success) {
      logger?.info(
        { requestId, issues: validationResult.error.issues },
        "[ListFiles] validation failed",
      );
      return {
        data: { path: "", items: [], size: 0 },
        error: `Validation Failed: ${validationResult.error.issues.map((i) => i.message).join(", ")}`,
      };
    }

    let {
      path: folderPath,
      onlyFiles,
      onlyFolders,
      includeHiddenFiles = false,
      recursively = false,
    } = validationResult.data;

    logger?.debug(
      { requestId, folderPath, onlyFiles, onlyFolders, includeHiddenFiles, recursively },
      "[ListFiles] validated params",
    );

    if (folderPath === "~" || folderPath.startsWith("~/")) {
      const homeDir = os.homedir();
      folderPath = folderPath === "~" ? homeDir : path.join(homeDir, folderPath.slice(2));
    }

    try {
      if (folderPath.startsWith("/") && Path.isWindows()) {
        const normalizedPosixPath = folderPath.replace(/^\/([A-Za-z]):\//, "/$1/");
        folderPath = Path.win(normalizedPosixPath);
      } else if (/^[A-Za-z]:/.test(folderPath) && !Path.isWindows()) {
        folderPath = new Path(folderPath).abs("posix");
      } else {
        folderPath = Path.toPlatformPath(folderPath);
      }
    } catch (error) {
      logger?.info({ requestId, folderPath, error }, "[ListFiles] Path normalization threw, using path.resolve");
    }

    const validatedPath = path.resolve(folderPath);
    logger?.info({ requestId, validatedPath }, "[ListFiles] resolved absolute path");

    try {
      const stats = await stat(validatedPath);
      logger?.info(
        { requestId, validatedPath, isDirectory: stats.isDirectory(), isFile: stats.isFile() },
        "[ListFiles] stat result",
      );
      if (!stats.isDirectory()) {
        logger?.info({ requestId, validatedPath }, "[ListFiles] path is not a directory");
        return {
          data: { path: validatedPath, items: [], size: 0 },
          error: `Path Not Directory: ${folderPath} is not a directory`,
        };
      }
    } catch (error) {
      logger?.info(
        {
          requestId,
          validatedPath,
          folderPath,
          errMessage: error instanceof Error ? error.message : String(error),
          errCode: error instanceof Error ? (error as NodeJS.ErrnoException).code : undefined,
        },
        "[ListFiles] stat failed (path not found or not accessible)",
      );
      return {
        data: { path: validatedPath, items: [], size: 0 },
        error: `Directory Not Found: ${folderPath} was not found`,
      };
    }

    try {
      logger?.debug({ requestId, validatedPath }, "[ListFiles] starting readdir");
      const results: Array<{ path: string; size: number; mtime: number; isDirectory: boolean }> = [];
      let totalCount = 0;

      async function scanDirectory(dirPath: string, isTopLevel: boolean = false): Promise<void> {
        logger?.debug({ requestId, dirPath, isTopLevel }, "[ListFiles] scanDirectory readdir");
        const items = await readdir(dirPath);

        for (const item of items) {
          const fullPath = path.join(dirPath, item);

          try {
            const itemStats = await stat(fullPath);
            const isFile = itemStats.isFile();
            const isDirectory = itemStats.isDirectory();
            const filename = path.basename(item);
            const isHidden =
              filename.startsWith(".") || filename === "Thumbs.db" || filename === "desktop.ini";

            if (!includeHiddenFiles && isHidden) {
              continue;
            }

            if (isTopLevel) {
              totalCount++;
            }

            let shouldAddToResults = true;
            if (onlyFiles && onlyFolders) {
              shouldAddToResults = isFile;
            } else {
              if (onlyFiles === true && !isFile) {
                shouldAddToResults = false;
              }
              if (onlyFolders === true && !isDirectory) {
                shouldAddToResults = false;
              }
            }

            if (shouldAddToResults) {
              results.push({
                path: fullPath,
                size: itemStats.size,
                mtime: itemStats.mtimeMs,
                isDirectory,
              });
            }

            if (isDirectory && recursively) {
              await scanDirectory(fullPath, false);
            }
          } catch {
            continue;
          }
        }
      }

      await scanDirectory(validatedPath, true);

      return {
        data: {
          path: validatedPath,
          items: results,
          size: totalCount,
        },
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const errNo = (error as NodeJS.ErrnoException)?.code;
      logger?.info(
        {
          requestId,
          validatedPath,
          errMessage: err.message,
          errCode: errNo,
          errStack: err.stack,
        },
        "[ListFiles] readdir/list failed",
      );
      return {
        data: { path: validatedPath, items: [], size: 0 },
        error: `List Directory Failed: ${err.message}`,
      };
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger?.info(
      { requestId, errMessage: err.message, errStack: err.stack },
      "[ListFiles] unexpected error in doListFiles",
    );
    return {
      data: emptyListFilesData,
      error: `Unexpected Error: ${err.message}`,
    };
  }
}
