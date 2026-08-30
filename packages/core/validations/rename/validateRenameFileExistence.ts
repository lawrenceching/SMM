import type { RenameOperation } from "./types"

/**
 * Runtime-agnostic probe for rename FS preflight.
 * Paths are expected in POSIX form (callers normalize first).
 */
export interface RenameFileExistenceProbe {
  /** True iff the path exists and is a regular file. */
  isFile(path: string): Promise<boolean>
}

/**
 * Every `from` must exist as a regular file.
 * Mirrors legacy `/api/renameFiles` source existence preflight.
 */
export async function validateSourceFilesExist(
  tasks: RenameOperation[],
  probe: RenameFileExistenceProbe,
): Promise<{ isValid: boolean; missingFiles: string[] }> {
  const missingFiles: string[] = []

  for (const task of tasks) {
    try {
      if (!(await probe.isFile(task.from))) {
        missingFiles.push(task.from)
      }
    } catch {
      missingFiles.push(task.from)
    }
  }

  return {
    isValid: missingFiles.length === 0,
    missingFiles,
  }
}

/**
 * No `to` may already exist as a regular file.
 * Mirrors legacy `/api/renameFiles` destination preflight.
 */
export async function validateDestFilesNotExist(
  tasks: RenameOperation[],
  probe: RenameFileExistenceProbe,
): Promise<{ isValid: boolean; existingFiles: string[] }> {
  const existingFiles: string[] = []

  for (const task of tasks) {
    try {
      if (await probe.isFile(task.to)) {
        existingFiles.push(task.to)
      }
    } catch {
      // Unreadable / missing — treat as free destination
      continue
    }
  }

  return {
    isValid: existingFiles.length === 0,
    existingFiles,
  }
}
