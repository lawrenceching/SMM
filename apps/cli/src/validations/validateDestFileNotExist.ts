import { stat } from 'node:fs/promises';
import { Path } from '@core/path';

/**
 * Wrapper for stat with timeout to prevent hanging on invalid paths
 */
async function statWithTimeout(path: string, timeoutMs: number = 1000): Promise<ReturnType<typeof stat>> {
  return Promise.race([
    stat(path),
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error(`stat timeout for path: ${path}`)), timeoutMs)
    ),
  ]);
}

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
      const stats = await statWithTimeout(platformPath);
      // Only check for files, not directories
      if (stats.isFile()) {
        existingFiles.push(task.to);
      }
    } catch (error) {
      // File doesn't exist or timeout occurred, which is what we want - continue
      continue;
    }
  }

  return {
    isValid: existingFiles.length === 0,
    existingFiles,
  };
}

