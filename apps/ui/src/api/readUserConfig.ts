import { type UserConfig, RenameRules, type HelloResponseBody } from "@core/types";
import { hello } from "@/api/hello";
import { readFile } from "@/api/readFile";
import { join } from "@/lib/path";
import { migrateAIConfig } from "@core/configMigration";

export const defaultUserConfig: UserConfig = {
  applicationLanguage: 'zh-CN',
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

export async function readUserConfigFromUserDataDir(userDataDir: string): Promise<UserConfig> {
  const filePath = join(userDataDir, "smm.json")
  const resp = await readFile(filePath)
  const raw = resp.data ? (JSON.parse(resp.data)) : defaultUserConfig
  if (resp.data) {
    migrateAIConfig(raw)
  }
  return raw as UserConfig
}

export async function readUserConfig(helloResponse?: HelloResponseBody): Promise<UserConfig> {
  const data = helloResponse || (await hello())
  return readUserConfigFromUserDataDir(data.userDataDir)
}