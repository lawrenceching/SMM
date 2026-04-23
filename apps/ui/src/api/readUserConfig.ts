import { type UserConfig, RenameRules, type HelloResponseBody } from "@core/types";
import { hello } from "@/api/hello";
import { readFile } from "@/api/readFile";
import { join } from "@/lib/path";

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
  selectedFolder: undefined,
  renameRules: [],
  dryRun: false,
  selectedRenameRule: RenameRules.Plex.name,
  enableMcpServer: false,
  mcpHost: '127.0.0.1',
  mcpPort: 30001,
};

export async function readUserConfigFromUserDataDir(userDataDir: string): Promise<UserConfig> {
  const filePath = join(userDataDir, "smm.json")
  const resp = await readFile(filePath)
  const config = resp.data ? (JSON.parse(resp.data) as UserConfig) : defaultUserConfig
  return config
}

export async function readUserConfig(helloResponse?: HelloResponseBody): Promise<UserConfig> {
  const data = helloResponse || (await hello())
  return readUserConfigFromUserDataDir(data.userDataDir)
}