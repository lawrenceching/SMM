/**
 * Validate that there are no duplicate source files in the rename tasks.
 * @param tasks Array of rename operations
 * @returns Object containing isValid flag and duplicate paths if any
 */
export function validateNoDuplicatedSourceFile(
  tasks: {
    /**
     * absolute path of file to be renamed from
     */
    from: string;
    /**
     * absolute path of file to be renamed to
     */
    to: string;
  }[],
): { isValid: boolean; duplicates: string[] } {
  const sourcePaths = new Map<string, number[]>(); // path -> indices

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    if (!task) continue;

    const existing = sourcePaths.get(task.from) ?? [];
    existing.push(i);
    sourcePaths.set(task.from, existing);
  }

  const duplicates: string[] = [];
  for (const [path, indices] of sourcePaths) {
    if (indices.length > 1) {
      duplicates.push(path);
    }
  }

  return {
    isValid: duplicates.length === 0,
    duplicates,
  };
}
