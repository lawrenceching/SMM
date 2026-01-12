import { getUserConfig, getUserDataDir } from '@/utils/config';
import { Path } from '@core/path';
import path from 'path';
import logger from '../../lib/logger';

/**
 * 
 * @param filePath path in POSIX format
 */
export async function validatePathIsInAllowlist(filePath: string): Promise<boolean> {
  /**
   * The allowlist of paths that are allowed to be accessed.
   * All paths are in POSIX format.
   */
  const allowlist = [];

  const userDataDir = getUserDataDir();
  allowlist.push(Path.posix(userDataDir));

  const userConfig = await getUserConfig();
  const folders = userConfig.folders;
  for (const folder of folders) {
    allowlist.push(Path.posix(folder));
  }

  logger.info({
    allowlist,
    filePath,
  }, `Validating path is in allowlist: ${filePath}`);

  return allowlist.some(allowlistItem => filePath.startsWith(allowlistItem));
}

/**
 * Validates that a file path is within the allowed user data directory.
 * Prevents directory traversal attacks by ensuring the resolved path
 * is contained within the base directory.
 * @deprecated use validatePathIsInAllowlist instead
 * @param filePath - The file path to validate (can be relative or absolute)
 * @param userDataDir - The base user data directory
 * @returns The validated absolute path
 * @throws Error if the path is outside the allowed directory
 */
export function validatePathInUserDataDir(filePath: string, userDataDir: string): string {
  // Resolve the user data dir to an absolute path
  const baseDir = path.resolve(userDataDir);
  
  // Resolve the file path relative to the base directory
  const resolvedPath = path.resolve(baseDir, filePath);
  
  // Normalize paths to handle different separators and resolve . and ..
  const normalizedBase = path.normalize(baseDir);
  const normalizedPath = path.normalize(resolvedPath);
  
  // Check if the resolved path is within the base directory
  // On Windows, we need to handle case-insensitive comparison
  const isWindows = process.platform === 'win32';
  const baseDirLower = isWindows ? normalizedBase.toLowerCase() : normalizedBase;
  const resolvedPathLower = isWindows ? normalizedPath.toLowerCase() : normalizedPath;
  
  // Ensure the resolved path starts with the base directory
  if (!resolvedPathLower.startsWith(baseDirLower + path.sep) && resolvedPathLower !== baseDirLower) {
    throw new Error(`Path "${filePath}" is outside the allowed user data directory`);
  }
  
  return resolvedPath;
}

