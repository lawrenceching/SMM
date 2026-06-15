import type { RenameOperation } from './types'

/**
 * Validate that there are no duplicate source files in the rename tasks.
 */
export function validateNoDuplicatedSourceFile(
  tasks: RenameOperation[],
): { isValid: boolean; duplicates: string[] } {
  const sourcePaths = new Map<string, number[]>()

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]
    if (!task) continue

    const existing = sourcePaths.get(task.from) ?? []
    existing.push(i)
    sourcePaths.set(task.from, existing)
  }

  const duplicates: string[] = []
  for (const [path, indices] of sourcePaths) {
    if (indices.length > 1) {
      duplicates.push(path)
    }
  }

  return {
    isValid: duplicates.length === 0,
    duplicates,
  }
}
