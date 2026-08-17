import type { UserConfig } from "@smm/core";
import type { FsPort } from "../ports/FsPort";
import { userConfigPath } from "./paths";

export const DEFAULT_USER_CONFIG: UserConfig = {
  folders: [],
  tmdb: {},
  tvdb: {},
  renameRules: [],
  dryRun: false,
  selectedRenameRule: "plex",
};

export async function readUserConfig(fs: FsPort, appDataDir: string): Promise<UserConfig> {
  const path = userConfigPath(appDataDir);
  if (!(await fs.exists(path))) return { ...DEFAULT_USER_CONFIG };
  const content = await fs.readTextFile(path);
  return { ...DEFAULT_USER_CONFIG, ...(JSON.parse(content) as Partial<UserConfig>) };
}

export async function writeUserConfig(fs: FsPort, appDataDir: string, config: UserConfig): Promise<void> {
  await fs.writeTextFile(userConfigPath(appDataDir), JSON.stringify(config, null, 2));
}
