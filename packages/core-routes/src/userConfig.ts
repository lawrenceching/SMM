import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { migrateAIConfig } from "@smm/core/configMigration";
import { Path } from "@smm/utils/path";
import type { UserConfig } from "@smm/types";
import type { CoreRoutesConfig } from "./types.ts";

const DEFAULT_USER_CONFIG: UserConfig = {
  folders: [],
  tmdb: {},
  tvdb: {},
  renameRules: [],
  dryRun: false,
  selectedRenameRule: "plex",
};

const fileLocks = new Map<string, Promise<void>>();

export function resolveUserDataDir(config: CoreRoutesConfig): string | undefined {
  return config.hello?.userDataDir ?? config.appDataDir;
}

export function userConfigFilePath(userDataDir: string): string {
  return path.join(userDataDir, "smm.json");
}

export async function acquireUserConfigLock(filePath: string): Promise<() => void> {
  const previousLock = fileLocks.get(filePath) ?? Promise.resolve();
  let releaseLock!: () => void;
  const newLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  fileLocks.set(filePath, newLock);
  try {
    await previousLock;
  } catch {
    // Previous holder failed; this caller still proceeds.
  }
  return () => {
    releaseLock();
    if (fileLocks.get(filePath) === newLock) {
      fileLocks.delete(filePath);
    }
  };
}

/** True when the path names the user config file, regardless of directory. */
export function isUserConfigFilePath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  const base = normalized.slice(normalized.lastIndexOf("/") + 1);
  return base.toLowerCase() === "smm.json";
}

export function resolveAppDataDir(config: CoreRoutesConfig): string | undefined {
  return config.appDataDir ?? config.hello?.appDataDir;
}

export async function readUserConfig(
  config: CoreRoutesConfig,
): Promise<UserConfig> {
  const userDataDir = resolveUserDataDir(config);
  if (!userDataDir) {
    return DEFAULT_USER_CONFIG;
  }

  const configPath = path.join(userDataDir, "smm.json");
  try {
    const content = await readFile(configPath, "utf-8");
    return JSON.parse(content) as UserConfig;
  } catch {
    return DEFAULT_USER_CONFIG;
  }
}

export async function isMediaFolderManaged(
  mediaFolderPath: string,
  config: CoreRoutesConfig,
): Promise<boolean> {
  const userConfig = await readUserConfig(config);
  const folders = userConfig.folders ?? [];
  if (folders.length === 0) {
    return false;
  }

  const targetPlatform = Path.toPlatformPath(mediaFolderPath);
  const targetPosix = Path.posix(mediaFolderPath);
  return folders.some(
    (folder) =>
      Path.toPlatformPath(folder) === targetPlatform ||
      Path.posix(folder) === targetPosix,
  );
}

export async function readUserConfigDocument(
  userDataDir: string,
): Promise<{ config: UserConfig } | { error: string }> {
  try {
    const content = await readFile(userConfigFilePath(userDataDir), "utf-8");
    let raw: unknown;
    try {
      raw = JSON.parse(content);
    } catch (parseError) {
      const detail = parseError instanceof Error ? parseError.message : "Invalid JSON";
      return { error: `Failed to parse user config: ${detail}` };
    }
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      return { error: "Failed to parse user config: root value must be an object" };
    }
    const record = raw as Record<string, unknown>;
    migrateAIConfig(record);
    return { config: record as unknown as UserConfig };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return { config: {} as UserConfig };
    }
    return { error: error instanceof Error ? error.message : "Failed to read user config" };
  }
}

export async function writeUserConfigFile(
  userDataDir: string,
  userConfig: UserConfig,
): Promise<void> {
  await mkdir(userDataDir, { recursive: true });
  await writeFile(userConfigFilePath(userDataDir), JSON.stringify(userConfig, null, 2), "utf-8");
}

export async function writeUserConfigToDisk(
  config: CoreRoutesConfig,
  userConfig: UserConfig,
): Promise<void> {
  const userDataDir = resolveUserDataDir(config);
  if (!userDataDir) {
    throw new Error("userDataDir is not configured");
  }

  const release = await acquireUserConfigLock(userConfigFilePath(userDataDir));
  try {
    await writeUserConfigFile(userDataDir, userConfig);
  } finally {
    release();
  }
}
