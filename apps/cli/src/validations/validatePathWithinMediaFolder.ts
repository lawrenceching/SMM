import { Path } from '@core/path';

/**
 * Validate both "from" and "to" are within the media folder.
 * To avoid accidentally touch files outside the media folder.
 * Or move/rename file to somewhere outside the media folder.
 *
 * @param mediaFolderPath The media folder path (normalized to POSIX)
 * @param tasks Array of rename operations
 * @returns Object containing isValid flag and paths outside media folder if any
 */
export function validatePathWithinMediaFolder(
  mediaFolderPath: string,
  tasks: {
    from: string;
    to: string;
  }[],
): { isValid: boolean; invalidPaths: { path: string; type: 'source' | 'destination' }[] } {
  const invalidPaths: { path: string; type: 'source' | 'destination' }[] = [];

  // Normalize media folder path and get the normalized path for comparison
  const mediaFolderObj = new Path(mediaFolderPath);
  const mediaFolderNormalized = mediaFolderObj.abs('posix');
  const mediaFolderWithoutDrive = mediaFolderNormalized.replace(/^\/[A-Za-z](?::|\/)/, '');

  for (const task of tasks) {
    if (!task) continue;

    // Check source path
    const fromPathObj = new Path(task.from);
    const fromNormalized = fromPathObj.abs('posix');
    const fromWithoutDrive = fromNormalized.replace(/^\/[A-Za-z](?::|\/)/, '');
    if (!fromWithoutDrive.startsWith(mediaFolderWithoutDrive)) {
      invalidPaths.push({ path: task.from, type: 'source' });
    }

    // Check destination path
    const toPathObj = new Path(task.to);
    const toNormalized = toPathObj.abs('posix');
    const toWithoutDrive = toNormalized.replace(/^\/[A-Za-z](?::|\/)/, '');
    if (!toWithoutDrive.startsWith(mediaFolderWithoutDrive)) {
      invalidPaths.push({ path: task.to, type: 'destination' });
    }
  }

  return {
    isValid: invalidPaths.length === 0,
    invalidPaths,
  };
}