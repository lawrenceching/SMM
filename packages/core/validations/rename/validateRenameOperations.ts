import { Path } from "../../path"
import type { RenameValidationResult } from "../../types"
import type { RenameOperation } from "./types"
import {
  type RenameFileExistenceProbe,
  validateDestFilesNotExist,
  validateSourceFilesExist,
} from "./validateRenameFileExistence"
import { validateRenameOperationsSync } from "./validateRenameOperationsSync"

/**
 * Full rename preflight: path/batch rules + source exists + dest must not exist.
 *
 * On any failure, returns `validatedRenames: []` so callers can refuse the
 * entire batch (legacy `/api/renameFiles` semantics).
 */
export async function validateRenameOperations(
  files: RenameOperation[],
  folderPathInPosix: string,
  probe: RenameFileExistenceProbe,
): Promise<RenameValidationResult> {
  const normalizedTasks: RenameOperation[] = []

  for (const renameOp of files) {
    if (!renameOp) continue
    normalizedTasks.push({
      from: Path.posix(renameOp.from),
      to: Path.posix(renameOp.to),
    })
  }

  if (normalizedTasks.length === 0) {
    return {
      isValid: true,
      errors: [],
      validatedRenames: [],
    }
  }

  const syncResult = validateRenameOperationsSync(normalizedTasks, folderPathInPosix)
  const errors = [...syncResult.errors]

  const sourceExistResult = await validateSourceFilesExist(normalizedTasks, probe)
  if (!sourceExistResult.isValid) {
    for (const missingFile of sourceExistResult.missingFiles) {
      errors.push(`Source file "${missingFile}" does not exist in the media folder`)
    }
  }

  const destNotExistResult = await validateDestFilesNotExist(normalizedTasks, probe)
  if (!destNotExistResult.isValid) {
    for (const existingFile of destNotExistResult.existingFiles) {
      errors.push(`Target file "${existingFile}" already exists in the filesystem`)
    }
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
      validatedRenames: [],
    }
  }

  return syncResult
}
