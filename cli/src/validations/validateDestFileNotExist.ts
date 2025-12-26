import { stat } from 'node:fs/promises';
import { Path } from '@core/path';

/**
 * Validate that all destination files do not exist in the filesystem.
 * @param tasks Array of rename operations
 * @returns Object containing isValid flag and existing destination file paths if any
 */
export async function validateDestFileNotExist(
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
): Promise<{ isValid: boolean; existingFiles: string[] }> {
  const existingFiles: string[] = [];

  for (const task of tasks) {
    if (!task) continue;

    try {
      const platformPath = Path.toPlatformPath(task.to);
      const stats = await stat(platformPath);
      if (stats.isFile()) {
        existingFiles.push(task.to);
      }
    } catch (error) {
      // File doesn't exist, which is what we want - continue
      continue;
    }
  }

  return {
    isValid: existingFiles.length === 0,
    existingFiles,
  };
}

