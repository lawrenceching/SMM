import type { RenameOperation } from './types'

/**
 * Validate that no task has the same source and destination path.
 */
export function validateNoIdenticalSourceAndDestFile(
  tasks: RenameOperation[],
): { isValid: boolean; identicals: string[] } {
  const identicals: string[] = []

  for (const task of tasks) {
    if (task && task.from === task.to) {
      identicals.push(task.from)
    }
  }

  return {
    isValid: identicals.length === 0,
    identicals,
  }
}
