import { Path } from '@core/path';

/**
 * Returns the media folder path that the given file path belongs to,
 * or null if the file is not under any of the provided folder paths.
 */
export function getMediaFolder(filePath: string, folderPaths: string[]): string | null {
  const filePathNorm = new Path(filePath).abs('posix').replace(/^\/[A-Za-z](?::|\/)/, '');

  for (const folder of folderPaths) {
    const folderNorm = new Path(folder).abs('posix').replace(/^\/[A-Za-z](?::|\/)/, '');
    const prefix = folderNorm.endsWith('/') ? folderNorm : folderNorm + '/';

    if (filePathNorm === folderNorm || filePathNorm.startsWith(prefix)) {
      return folder;
    }
  }

  return null;
}
