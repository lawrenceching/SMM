import type { UserConfig } from "@core/types";
import { RenameRules } from "@core/types";
import { renameFolderInUserConfig } from "@core/userConfig";
import path from "path";
import os from "os";
import { Mutex } from 'es-toolkit';
import { withTimeout } from 'es-toolkit/promise';

const updateMutex = new Mutex();

export { renameFolderInUserConfig };

const DEFAULT_USER_CONFIG: UserConfig = {
  applicationLanguage: 'zh-CN',
  tmdb: {
    host: '',
    apiKey: '',
    httpProxy: ''
  },
  ai: {
    deepseek: {
      baseURL: 'https://api.deepseek.com',
      apiKey: '',
      model: 'deepseek-chat'
    },
    openAI: {
      baseURL: 'https://api.openai.com/v1',
      apiKey: '',
      model: 'gpt-4o'
    },
    openrouter: {
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: '',
      model: 'deepseek/deepseek-chat'
    },
    glm: {
      baseURL: 'https://open.bigmodel.cn/api/paas/v4',
      apiKey: '',
      model: 'GLM-4.5'
    },
    other: {
      baseURL: '',
      apiKey: '',
      model: ''
    }
  },
  selectedAI: 'DeepSeek',
  selectedTMDBIntance: 'public',
  folders: [],
  renameRules: [],
  dryRun: false,
  selectedRenameRule: RenameRules.Plex.name,
  enableMcpServer: false,
  mcpHost: '127.0.0.1',
  mcpPort: 30001,
};

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

export function getTmpDir(): string {
    const platform = os.platform();
    const homedir = os.homedir();

    switch (platform) {
        case 'win32':
            return process.env.TMP ? path.join(process.env.TMP, 'smm') : path.join(homedir, 'AppData', 'Local', 'Temp', 'smm');
        case 'darwin':
            return path.join(homedir, 'Library', 'Caches', 'smm');
        case 'linux':
            return path.join(homedir, '.cache', 'smm');
        default:
            return path.join(homedir, '.cache', 'smm');
    }
}

export async function getUserConfig(): Promise<UserConfig> {
    const configPath = getUserConfigPath();
    const file = Bun.file(configPath);
    const exists = await file.exists();
    if (!exists) {
        return DEFAULT_USER_CONFIG;
    }
    const content = await file.text();
    try {
        return JSON.parse(content) as UserConfig;
    } catch (parseError) {
        throw new Error(
            `Failed to parse user config file at "${configPath}": ${parseError instanceof Error ? parseError.message : 'Invalid JSON format'}`
        );
    }
}

async function writeUserConfigUnderMutex(userConfig: UserConfig): Promise<void> {
    const configPath = getUserConfigPath();
    const file = Bun.file(configPath);
    await file.write(JSON.stringify(userConfig, null, 2));
}

export async function writeUserConfig(userConfig: UserConfig): Promise<void> {
    try {
        await updateMutex.acquire();
        await writeUserConfigUnderMutex(userConfig);
    } finally {
        updateMutex.release();
    }
}

export async function safeUpdateUserConfig(userConfig: UserConfig): Promise<void> {
    await withTimeout(async () => {
        try {
            await updateMutex.acquire();
            await writeUserConfigUnderMutex(userConfig);
        } finally {
            updateMutex.release();
        }
    }, 10000);
}
