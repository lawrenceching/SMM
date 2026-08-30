import { validateRenameOperations as validateRenameOperationsShared } from "@smm/core/validations/rename/validateRenameOperations";
import type { RenameValidationResult } from "@smm/types";
import { createNodeRenameFileExistenceProbe } from "./nodeRenameFileExistenceProbe.ts";

interface RenameFile {
  from: string;
  to: string;
}

/**
 * Host-side rename preflight for Node/Bun (path rules + FS existence).
 * Delegates to shared `@smm/core` validators with a `node:fs` probe.
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
