import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Path } from "@smm/core/path";
import type { UserConfig } from "@smm/core/types";
import type { CoreRoutesConfig } from "./types.ts";

const DEFAULT_USER_CONFIG: UserConfig = {
  folders: [],
};

export function resolveUserDataDir(config: CoreRoutesConfig): string | undefined {
  return config.hello?.userDataDir ?? config.appDataDir;
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

export async function writeUserConfigToDisk(
  config: CoreRoutesConfig,
  userConfig: UserConfig,
): Promise<void> {
  const userDataDir = resolveUserDataDir(config);
  if (!userDataDir) {
    throw new Error("userDataDir is not configured");
  }

  await mkdir(userDataDir, { recursive: true });
  await writeFile(
    path.join(userDataDir, "smm.json"),
    JSON.stringify(userConfig, null, 2),
    "utf-8",
  );
}
