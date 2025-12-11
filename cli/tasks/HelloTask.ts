import { APP_VERSION } from '../src/version';
import os from 'os';
import path from 'path';

export interface HelloResponse {
    /**
     * application uptime in seconds
     */
    uptime: number;
    version: string;
    userDataDir: string;
}

export function getUserDataDir(): string {

  const dirFromEnv = process.env.USER_DATA_DIR;
  if (!!dirFromEnv) {
    return dirFromEnv;
  }

  const platform = os.platform();
  const homedir = os.homedir();

  switch (platform) {
    case 'win32':
      // Windows: %APPDATA%
      return process.env.APPDATA ? path.join(process.env.APPDATA, 'SMM') : path.join(homedir, 'AppData', 'Roaming', 'SMM');
    case 'darwin':
      // macOS: ~/Library/Application Support
      return path.join(homedir, 'Library', 'Application Support');
    case 'linux':
      // Linux: ~/.local/share or $XDG_DATA_HOME
      return process.env.XDG_DATA_HOME || path.join(homedir, '.local', 'share');
    default:
      // Fallback for other platforms
      return path.join(homedir, '.config');
  }
}

export async function executeHelloTask(): Promise<HelloResponse> {
  return {
    uptime: process.uptime(),
    version: APP_VERSION,
    userDataDir: getUserDataDir(),
  }
}