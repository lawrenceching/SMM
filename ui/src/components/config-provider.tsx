import React, { createContext, useContext, useEffect, useState } from "react"
import { RenameRules, TMDBInstance, type AppConfig, type UserConfig } from "@core/types"
import { join } from "@/lib/path"
import { readFileApi } from "@/api/readFile"

interface ConfigContextValue {
  appConfig: AppConfig
  userConfig: UserConfig
  isLoading: boolean
  error: Error | null
}

const ConfigContext = createContext<ConfigContextValue | undefined>(undefined)

interface ConfigProviderProps {
  appConfig?: AppConfig
  userConfig?: UserConfig
  children: React.ReactNode
}

interface HelloResponse {
  uptime: number;
  version: string;
  userDataDir: string;
}

async function getConfigFromElectronIpcChannel() {
  // 1. Check if it's in Electron environment
  // 2. If yes, call ExecuteChannel channel with name "get-config"
  // 3. Get the user config path from the response
}

const defaultUserConfig: UserConfig = {
  applicationLanguage: 'zh-CN',
  tmdb: {
    host: 'https://api.themoviedb.org/3',
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
  selectedTMDBIntance: TMDBInstance.public,
  folders: [],
  dryRun: false,
  selectedRenameRule: RenameRules.Plex.name,
  renameRules: [],
}

export function ConfigProvider({
  appConfig: initialAppConfig,
  userConfig = defaultUserConfig,
  children,
}: ConfigProviderProps) {
  const [appConfig, setAppConfig] = useState<AppConfig>(
    initialAppConfig || { version: "unknown" }
  )
  const [isLoading, setIsLoading] = useState(!initialAppConfig)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    // Only fetch if no initial config provided
    if (initialAppConfig) {
      return
    }

    const fetchAppConfig = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        const response = await fetch("/api/execute", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: "hello" }),
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch app config: ${response.statusText}`)
        }

        const data: HelloResponse = await response.json()
        const userDataDir = data.userDataDir;
        console.log(`userDataDir: ${userDataDir}`)

        const filePath = join(userDataDir, 'smm.json');
        console.log(`filePath: ${filePath}`)

        const config = await readFileApi(filePath);
        console.log(`config: `, config)

        // Map HelloResponse to AppConfig
        setAppConfig({
          version: data.version,
        })
      } catch (err) {
        console.error("Failed to fetch app config:", err)
        setError(err instanceof Error ? err : new Error("Unknown error"))
        // Keep the fallback version
      } finally {
        setIsLoading(false)
      }
    }

    fetchAppConfig()
  }, [initialAppConfig])

  const value: ConfigContextValue = {
    appConfig,
    userConfig,
    isLoading,
    error,
  }

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>
}

export function useConfig(): ConfigContextValue {
  const context = useContext(ConfigContext)
  if (context === undefined) {
    throw new Error("useConfig must be used within a ConfigProvider")
  }
  return context
}

