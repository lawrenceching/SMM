import type { UserConfig } from "@core/types";
import path from "path";
import { Path } from "@core/path";
import os from "os";

/**
 * Returns the directory path for user configuration files.
 * Follows platform-specific conventions:
 * - Windows: %APPDATA%\SMM
 * - macOS: ~/Library/Application Support/SMM
 * - Linux: ~/.config/smm or $XDG_CONFIG_HOME/smm
 */
export function getUserDataDir(): string {
    const dirFromEnv = process.env.USER_DATA_DIR;
    if (!!dirFromEnv) {
      return dirFromEnv;
    }
  
    const platform = os.platform();
    const homedir = os.homedir();
  
    switch (platform) {
      case 'win32':
        // Windows: %APPDATA%\SMM (for configuration files)
        return process.env.APPDATA ? path.join(process.env.APPDATA, 'SMM') : path.join(homedir, 'AppData', 'Roaming', 'SMM');
      case 'darwin':
        // macOS: ~/Library/Application Support/SMM (for configuration files)
        return path.join(homedir, 'Library', 'Application Support', 'SMM');
      case 'linux':
        // Linux: ~/.config/smm or $XDG_CONFIG_HOME/smm (for configuration files)
        return process.env.XDG_CONFIG_HOME ? path.join(process.env.XDG_CONFIG_HOME, 'smm') : path.join(homedir, '.config', 'smm');
      default:
        // Fallback for other platforms
        return path.join(homedir, '.config', 'smm');
    }
}

/**
 * Returns the directory path for application log files.
 * Follows platform-specific conventions:
 * - Windows: %LOCALAPPDATA%\SMM\logs
 * - macOS: ~/Library/Logs/SMM
 * - Linux: ~/.local/share/smm/logs
 */
export function getLogDir(): string {
    const dirFromEnv = process.env.LOG_DIR;
    if (!!dirFromEnv) {
      return dirFromEnv;
    }
  
    const platform = os.platform();
    const homedir = os.homedir();
  
    switch (platform) {
      case 'win32':
        // Windows: %LOCALAPPDATA%\SMM\logs
        return process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'SMM', 'logs') : path.join(homedir, 'AppData', 'Local', 'SMM', 'logs');
      case 'darwin':
        // macOS: ~/Library/Logs/SMM
        return path.join(homedir, 'Library', 'Logs', 'SMM');
      case 'linux':
        // Linux: ~/.local/share/smm/logs
        return process.env.XDG_DATA_HOME ? path.join(process.env.XDG_DATA_HOME, 'smm', 'logs') : path.join(homedir, '.local', 'share', 'smm', 'logs');
      default:
        // Fallback for other platforms
        return path.join(homedir, '.local', 'share', 'smm', 'logs');
    }
}

export function getUserConfigPath(): string {
    const userDataDir = getUserDataDir();
    return path.join(userDataDir, 'smm.json');
}

export async function getUserConfig(): Promise<UserConfig> {
    const configPath = getUserConfigPath();
    const file = Bun.file(configPath);
    const content = await file.text();
    return JSON.parse(content) as UserConfig;
}

export async function writeUserConfig(userConfig: UserConfig): Promise<void> {
    const configPath = getUserConfigPath();
    const file = Bun.file(configPath);
    await file.write(JSON.stringify(userConfig, null, 2));
}

/**
 * 
 * @param userConfig - the user config to rename the folder in
 * @param from - the source folder path in POSIX format
 * @param to - the destination folder path in POSIX format
 * @returns 
 */
export function renameFolderInUserConfig(userConfig: UserConfig, from: string, to: string): UserConfig {

    const actualFromPosix = Path.posix(from);
    const actualFromWindows = Path.win(from);
    const actualTo = Path.toPlatformPath(to);

    return {
        ...userConfig,
        folders: userConfig.folders
          .map(folder => folder === actualFromPosix ? actualTo : folder)
          .map(folder => folder === actualFromWindows ? actualTo : folder)
          ,
    }
}