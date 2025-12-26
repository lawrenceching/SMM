/**
 * Validate that no task has the same source and destination path.
 * @param tasks Array of rename operations
 * @returns Object containing isValid flag and identical paths if any
 */
export function validateNoIdenticalSourceAndDestFile(
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
): { isValid: boolean; identicals: string[] } {
  const identicals: string[] = [];

  for (const task of tasks) {
    if (task && task.from === task.to) {
      identicals.push(task.from);
    }
  }

  return {
    isValid: identicals.length === 0,
    identicals,
  };
}
