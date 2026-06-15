import type { RenameOperation } from './types'

/**
 * Validate that there are no duplicate destination files in the rename tasks.
 */
export function validateNoDuplicatedDestFile(
  tasks: RenameOperation[],
): { isValid: boolean; duplicates: string[] } {
  const destPaths = new Map<string, number[]>()

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]
    if (!task) continue

    const existing = destPaths.get(task.to) ?? []
    existing.push(i)
    destPaths.set(task.to, existing)
  }

  const duplicates: string[] = []
  for (const [path, indices] of destPaths) {
    if (indices.length > 1) {
      duplicates.push(path)
    }
  }

  return {
    isValid: duplicates.length === 0,
    duplicates,
  }
}
