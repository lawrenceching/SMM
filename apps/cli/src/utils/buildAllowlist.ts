import { getUserConfig, getUserDataDir, getAppDataDir, getTmpDir } from '@/utils/config';
import { Path } from '@core/path';

/**
 * Builds the POSIX-format allowlist used by writeFile path validation.
 */
export async function buildAllowlist(): Promise<string[]> {
  const allowlist: string[] = [];

  allowlist.push(Path.posix(getUserDataDir()));
  allowlist.push(Path.posix(getAppDataDir()));
  allowlist.push(Path.posix(getTmpDir()));

  const userConfig = await getUserConfig();
  for (const folder of userConfig.folders) {
    if (folder === null) {
      console.error('illegal value in user config, null value in folders');
      continue;
    }
    allowlist.push(Path.posix(folder));
  }

  return allowlist;
}
