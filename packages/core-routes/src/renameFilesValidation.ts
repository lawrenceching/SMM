import { validateRenameOperations as validateRenameOperationsShared } from "@smm/core/validations/rename/validateRenameOperations";
import type { RenameValidationResult } from "@smm/core/types";
import { createNodeRenameFileExistenceProbe } from "./nodeRenameFileExistenceProbe.ts";

/**
 * A single rename operation: source path and target path.
 */
export interface RenameFile {
  from: string;
  to: string;
}

/**
 * Validate a batch of rename operations. Self-contained for Bun (`apps/cli`)
 * and Node (`apps/ohos` / Electron main): shared path rules + `node:fs` probe.
 */
export async function validateRenameOperations(
  files: RenameFile[],
  folderPathInPosix: string,
): Promise<RenameValidationResult> {
  return validateRenameOperationsShared(
    files,
    folderPathInPosix,
    createNodeRenameFileExistenceProbe(),
  );
}
