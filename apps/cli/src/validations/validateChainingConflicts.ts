/**
 * Validate there is NOT chaining conflicts in the rename tasks.
 * Chaining conflicts are when a file is being renamed to a path that is already the target of a previous rename task.
 * For example, if the tasks are:
 * - /path/to/A → /path/to/B
 * - /path/to/B → /path/to/C
 * 
 * @param tasks 
 * @returns 
 */
export function validateChainingConflicts(
  tasks: {
    /**
     * absolute path of file to be renamed from, in platform-specific format
     */
    from: string;
    /**
     * absolute path of file to be renamed to, in platform-specific format
     */
    to: string;
  }[],
): boolean {
  // Build a set of all source paths and target paths
  const sourcePaths = new Set<string>();
  const targetPaths = new Set<string>();

  for (const task of tasks) {
    sourcePaths.add(task.from);
    targetPaths.add(task.to);
  }

  // Check if any target path is also a source path (chaining conflict)
  // A → B and B → C creates a conflict because B is both a target and source
  for (const task of tasks) {
    if (sourcePaths.has(task.to)) {
      return false;
    }
  }

  return true;
}