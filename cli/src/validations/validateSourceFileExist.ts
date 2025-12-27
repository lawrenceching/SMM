import { stat } from 'node:fs/promises';
import { Path } from '@core/path';

/**
 * Validate that all source files or directories exist in the filesystem.
 * @param tasks Array of rename operations
 * @returns Object containing isValid flag and missing source file/directory paths if any
 */
export async function validateSourceFileExist(
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
): Promise<{ isValid: boolean; missingFiles: string[] }> {
  const missingFiles: string[] = [];

  for (const task of tasks) {
    if (!task) continue;

    try {
      const platformPath = Path.toPlatformPath(task.from);
      const stats = await stat(platformPath);
      // Accept both files and directories
      if (!stats.isFile() && !stats.isDirectory()) {
        missingFiles.push(task.from);
      }
    } catch (error) {
      // File doesn't exist or can't be accessed
      missingFiles.push(task.from);
    }
  }

  return {
    isValid: missingFiles.length === 0,
    missingFiles,
  };
}

