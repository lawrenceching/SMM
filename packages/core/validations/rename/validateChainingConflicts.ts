import type { RenameOperation } from './types'

/**
 * Validate there is NOT chaining conflicts in the rename tasks.
 * Chaining conflicts are when a file is being renamed to a path that is
 * already the source of another rename in the same batch.
 */
export function validateChainingConflicts(tasks: RenameOperation[]): boolean {
  const sourcePaths = new Set<string>()

  for (const task of tasks) {
    sourcePaths.add(task.from)
  }

  for (const task of tasks) {
    if (sourcePaths.has(task.to)) {
      return false
    }
  }

  return true
}
