import { APP_VERSION } from '../src/version';
import os from 'os';
import path from 'path';
import type { HelloResponseBody } from '@core/types';
import { getUserDataDir } from '@/utils/config';

/**
 * Returns the directory path for application data files (e.g., metadata cache).
 * Follows platform-specific conventions:
 * - Windows: %APPDATA%\SMM (same as config on Windows)
 * - macOS: ~/Library/Application Support/SMM (same as config on macOS)
 * - Linux: ~/.local/share/smm or $XDG_DATA_HOME/smm
 */
export function getAppDataDir(): string {
  const dirFromEnv = process.env.APP_DATA_DIR;
  if (!!dirFromEnv) {
    return dirFromEnv;
  }

  const platform = os.platform();
  const homedir = os.homedir();

  switch (platform) {
    case 'win32':
      // Windows: %APPDATA%\SMM (Windows doesn't typically separate config and data)
      return process.env.APPDATA ? path.join(process.env.APPDATA, 'SMM') : path.join(homedir, 'AppData', 'Roaming', 'SMM');
    case 'darwin':
      // macOS: ~/Library/Application Support/SMM (macOS doesn't typically separate config and data)
      return path.join(homedir, 'Library', 'Application Support', 'SMM');
    case 'linux':
      // Linux: ~/.local/share/smm or $XDG_DATA_HOME/smm (for data files per XDG spec)
      return process.env.XDG_DATA_HOME ? path.join(process.env.XDG_DATA_HOME, 'smm') : path.join(homedir, '.local', 'share', 'smm');
    default:
      // Fallback for other platforms
      return path.join(homedir, '.local', 'share', 'smm');
  }
}

export async function executeHelloTask(): Promise<HelloResponseBody> {
  return {
    uptime: process.uptime(),
    version: APP_VERSION,
    userDataDir: getUserDataDir(),
    appDataDir: getAppDataDir(),
  }
}