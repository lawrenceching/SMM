import { dirname } from 'node:path';
import { Path } from '@core/path';
import type { UserConfig } from '@core/types';
import { getUserConfig } from '@/utils/config';

/**
 * Normalize path to POSIX and strip Windows drive prefix for comparison.
 */
function normalizedPosixStripDrive(pathStr: string): string {
  const p = new Path(pathStr);
  const normalized = p.abs('posix');
  return normalized.replace(/^\/[A-Za-z](?::|\/)/, '');
}

/**
 * Returns true if pathStr is under one of the allowed folder roots (platform-aware).
 */
function isUnderOneOfFolders(pathStr: string, folders: string[]): boolean {
  const pathNorm = normalizedPosixStripDrive(pathStr);
  for (const folder of folders) {
    const folderNorm = normalizedPosixStripDrive(folder);
    const prefix = folderNorm.endsWith('/') ? folderNorm : folderNorm + '/';
    if (pathNorm === folderNorm || pathNorm.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

/**
 * Returns true if from and to have the same parent directory (platform-specific).
 */
function isSameDirectory(fromStr: string, toStr: string): boolean {
  try {
    const fromParent = dirname(new Path(fromStr).platformAbsPath());
    const toParent = dirname(new Path(toStr).platformAbsPath());
    return fromParent === toParent;
  } catch {
    return false;
  }
}

export interface ValidateRenameFilesResult {
  valid: Array<{ from: string; to: string }>;
  failed: Array<{ path: string; error: string }>;
}

/**
 * Validate rename-files-api request: each "from" must be under one of userConfig.folders,
 * and each "to" must be in the same directory as its "from".
 * Uses getUserConfig() for the allowed folders.
 */
export async function validateRenameFilesRequest(
  files: Array<{ from: string; to: string }>,
): Promise<ValidateRenameFilesResult> {
  const userConfig: UserConfig = await getUserConfig();
  const folders = userConfig.folders ?? [];
  const valid: Array<{ from: string; to: string }> = [];
  const failed: Array<{ path: string; error: string }> = [];

  for (const { from, to } of files) {
    if (!from?.trim() || !to?.trim()) {
      failed.push({ path: from || to || '', error: 'from and to are required' });
      continue;
    }

    if (!isUnderOneOfFolders(from, folders)) {
      failed.push({ path: from, error: 'Source path is not under any opened media folder' });
      continue;
    }

    if (!isSameDirectory(from, to)) {
      failed.push({ path: to, error: 'Destination must be in the same folder as the source' });
      continue;
    }

    valid.push({ from, to });
  }

  return { valid, failed };
}
