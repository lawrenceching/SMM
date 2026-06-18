import { stat } from "node:fs/promises";
import { Path } from "@smm/core/path";
import { validateRenameOperationsSync } from "@smm/core/validations/rename/validateRenameOperationsSync";
import type { RenameValidationResult } from "@smm/core/types";

/**
 * A single rename operation: source path and target path.
 */
export interface RenameFile {
  from: string;
  to: string;
}

/**
 * Validate a batch of rename operations. Mirrors the original
 * `validateRenameOperations` from
 * `apps/cli/src/tools/renameFilesInBatch.ts` but is self-contained
 * (no `apps/cli` imports) so it works on both Bun (`apps/cli`) and
 * Node.js (`apps/ohos` Electron main process).
 *
 * Validation consists of:
 * 1. POSIX-normalising both `from` and `to` paths.
 * 2. Calling the runtime-neutral
 *    {@link validateRenameOperationsSync} for syntax/structure
 *    checks.
 * 3. Checking that each source file exists on disk via
 *    `node:fs/promises#stat`.
 * 4. Checking that each target path is not an existing file
 *    (renaming onto an existing file is rejected).
 */
export async function validateRenameOperations(
  files: RenameFile[],
  folderPathInPosix: string,
): Promise<RenameValidationResult> {
  const normalizedTasks: RenameFile[] = [];

  for (let i = 0; i < files.length; i++) {
    const renameOp = files[i];
    if (!renameOp) {
      continue;
    }

    normalizedTasks.push({
      from: Path.posix(renameOp.from),
      to: Path.posix(renameOp.to),
    });
  }

  if (normalizedTasks.length === 0) {
    return {
      isValid: true,
      errors: [],
      validatedRenames: [],
    };
  }

  const syncResult = validateRenameOperationsSync(
    normalizedTasks,
    folderPathInPosix,
  );
  const errors = [...syncResult.errors];

  const sourceExistResult = await validateSourceFileExist(normalizedTasks);
  if (!sourceExistResult.isValid) {
    for (const missingFile of sourceExistResult.missingFiles) {
      errors.push(
        `Source file "${missingFile}" does not exist in the media folder`,
      );
    }
  }

  const destNotExistResult = await validateDestFileNotExist(normalizedTasks);
  if (!destNotExistResult.isValid) {
    for (const existingFile of destNotExistResult.existingFiles) {
      errors.push(
        `Target file "${existingFile}" already exists in the filesystem`,
      );
    }
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
      validatedRenames: [],
    };
  }

  return syncResult;
}

/**
 * Returns true if every source file in `tasks` exists on disk and
 * is a regular file (not a directory).
 */
async function validateSourceFileExist(
  tasks: RenameFile[],
): Promise<{ isValid: boolean; missingFiles: string[] }> {
  const missingFiles: string[] = [];

  for (const task of tasks) {
    if (!task) continue;

    try {
      const platformPath = Path.toPlatformPath(task.from);
      const stats = await stat(platformPath);
      if (!stats.isFile()) {
        missingFiles.push(task.from);
      }
    } catch {
      // File doesn't exist or can't be accessed
      missingFiles.push(task.from);
    }
  }

  return {
    isValid: missingFiles.length === 0,
    missingFiles,
  };
}

/**
 * Returns true if none of the destination paths in `tasks` is an
 * existing file. Wraps `stat` in a 1-second timeout so the
 * validation does not hang on unresponsive filesystems.
 */
async function validateDestFileNotExist(
  tasks: RenameFile[],
): Promise<{ isValid: boolean; existingFiles: string[] }> {
  const existingFiles: string[] = [];

  for (const task of tasks) {
    if (!task) continue;

    try {
      const platformPath = Path.toPlatformPath(task.to);
      const stats = await statWithTimeout(platformPath);
      if (stats.isFile()) {
        existingFiles.push(task.to);
      }
    } catch {
      // File doesn't exist or timeout — that's the desired state
      continue;
    }
  }

  return {
    isValid: existingFiles.length === 0,
    existingFiles,
  };
}

function statWithTimeout(
  filePath: string,
  timeoutMs: number = 1000,
): Promise<Awaited<ReturnType<typeof stat>>> {
  return Promise.race([
    stat(filePath),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`stat timeout for path: ${filePath}`)),
        timeoutMs,
      ),
    ),
  ]);
}
