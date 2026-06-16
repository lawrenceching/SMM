import { stat } from "node:fs/promises";
import { Path } from "@smm/core/path";
import type { RenameValidationResult } from "@smm/core/types";
import { validateRenameOperationsSync } from "@smm/core/validations/rename/validateRenameOperationsSync";

interface RenameFile {
  from: string;
  to: string;
}

async function validateSourceFileExist(
  tasks: RenameFile[],
): Promise<{ isValid: boolean; missingFiles: string[] }> {
  const missingFiles: string[] = [];

  for (const task of tasks) {
    try {
      const platformPath = Path.toPlatformPath(task.from);
      const stats = await stat(platformPath);
      if (!stats.isFile()) {
        missingFiles.push(task.from);
      }
    } catch {
      missingFiles.push(task.from);
    }
  }

  return {
    isValid: missingFiles.length === 0,
    missingFiles,
  };
}

async function validateDestFileNotExist(
  tasks: RenameFile[],
): Promise<{ isValid: boolean; existingFiles: string[] }> {
  const existingFiles: string[] = [];

  for (const task of tasks) {
    try {
      const platformPath = Path.toPlatformPath(task.to);
      const stats = await stat(platformPath);
      if (stats.isFile()) {
        existingFiles.push(task.to);
      }
    } catch {
      continue;
    }
  }

  return {
    isValid: existingFiles.length === 0,
    existingFiles,
  };
}

export async function validateRenameOperations(
  files: RenameFile[],
  folderPathInPosix: string,
): Promise<RenameValidationResult> {
  const normalizedTasks: RenameFile[] = [];

  for (const renameOp of files) {
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

  const syncResult = validateRenameOperationsSync(normalizedTasks, folderPathInPosix);
  const errors = [...syncResult.errors];

  const sourceExistResult = await validateSourceFileExist(normalizedTasks);
  if (!sourceExistResult.isValid) {
    for (const missingFile of sourceExistResult.missingFiles) {
      errors.push(`Source file "${missingFile}" does not exist in the media folder`);
    }
  }

  const destNotExistResult = await validateDestFileNotExist(normalizedTasks);
  if (!destNotExistResult.isValid) {
    for (const existingFile of destNotExistResult.existingFiles) {
      errors.push(`Target file "${existingFile}" already exists in the filesystem`);
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
