import { type UserConfig, RenameRules, type HelloResponseBody } from "@smm/types";
import { hello } from "@/api/hello";
import { readFile } from "@/api/readFile";
import { join } from "@/lib/path";
import { migrateAIConfig } from "@smm/core/configMigration";

export const defaultUserConfig: UserConfig = {
  tmdb: {
    host: '',
    apiKey: '',
    httpProxy: ''
  },
  tvdb: {
    host: '',
    apiKey: ''
  },
  primaryDatabase: 'TMDB',
  preferMediaLanguage: undefined,
  selectedTMDBIntance: 'public',
  folders: [],
  selectedFolder: undefined,
  renameRules: [],
  dryRun: false,
  selectedRenameRule: RenameRules.Plex.name,
  enableMcpServer: false,
  mcpHost: '127.0.0.1',
  mcpPort: 30001,
  useBundledFfmpegForVideoCaptioner: true,
};

/** Merge persisted config with defaults so required nested fields (tmdb, tvdb) always exist. */
export function normalizeUserConfig(raw: Partial<UserConfig>): UserConfig {
  return {
    ...defaultUserConfig,
    ...raw,
    tmdb: {
      ...defaultUserConfig.tmdb,
      ...(raw.tmdb ?? {}),
    },
    tvdb: {
      ...defaultUserConfig.tvdb,
      ...(raw.tvdb ?? {}),
    },
  }
}

export async function readUserConfigFromUserDataDir(userDataDir: string): Promise<UserConfig> {
  const filePath = join(userDataDir, "smm.json")
  const resp = await readFile(filePath)
  if (!resp.data) {
    return defaultUserConfig
  }
  const raw = JSON.parse(resp.data) as Partial<UserConfig>
  migrateAIConfig(raw as Record<string, unknown>)
  return normalizeUserConfig(raw)
}

export async function readUserConfig(helloResponse?: HelloResponseBody): Promise<UserConfig> {
  const data = helloResponse || (await hello())
  return readUserConfigFromUserDataDir(data.userDataDir)
}