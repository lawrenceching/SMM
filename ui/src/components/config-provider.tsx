import React, { createContext, useCallback, useContext, useEffect, useState } from "react"
import { RenameRules, type AppConfig, type UserConfig } from "@core/types"
import { join } from "@/lib/path"
import { readFileApi } from "@/api/readFile"
import { writeFile } from "@/api/writeFile"
import { changeLanguage } from "@/lib/i18n"

interface ConfigContextValue {
  appConfig: AppConfig
  userConfig: UserConfig
  isLoading: boolean
  error: Error | null
  setUserConfig: (config: UserConfig) => void
  reload: () => void
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
  selectedTMDBIntance: 'public',
  folders: [],
  dryRun: false,
  selectedRenameRule: RenameRules.Plex.name,
  renameRules: [],
}

export function ConfigProvider({
  appConfig: initialAppConfig,
  userConfig: initialUserConfig = defaultUserConfig,
  children,
}: ConfigProviderProps) {
  const [appConfig, setAppConfig] = useState<AppConfig>(
    initialAppConfig || { version: "unknown" }
  )
  const [userConfig, setUserConfig] = useState<UserConfig>(initialUserConfig || defaultUserConfig)
  const [isLoading, setIsLoading] = useState(!initialAppConfig)
  const [error, setError] = useState<Error | null>(null)

  const reload = useCallback(async () => {
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
      setAppConfig((prev) => {
        return {
          ...prev,
          userDataDir: userDataDir,
        }
      })

      const filePath = join(userDataDir, 'smm.json');

      const config = await readFileApi(filePath);
      console.log('[ConfigProvider] Reloaded user config', config)
      setUserConfig(config);
      
      // Sync i18n language with config
      if (config.applicationLanguage) {
        await changeLanguage(config.applicationLanguage);
      }

      // Map HelloResponse to AppConfig
      setAppConfig((prev) => {
        return {
          ...prev,
          version: data.version,
        }
      })
    } catch (err) {
      console.error("Failed to fetch app config:", err)
      setError(err instanceof Error ? err : new Error("Unknown error"))
      // Keep the fallback version
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // Only fetch if no initial config provided
    if (initialAppConfig) {
      return
    }

    reload()
  }, [initialAppConfig])

  const saveUserConfig = useCallback(async (config: UserConfig) => {
    if(!appConfig.userDataDir) {
      throw new Error("User data directory not found")
    }
    
    // Sync i18n language if language changed
    if (config.applicationLanguage !== userConfig.applicationLanguage) {
      await changeLanguage(config.applicationLanguage);
    }
    
    writeFile(join(appConfig.userDataDir, 'smm.json'), JSON.stringify(config))
    .then(() => {
      console.log("User config written successfully")
      setUserConfig(config)
    })
    .catch((err) => {
      console.error("Failed to write user config:", err)
      setError(err instanceof Error ? err : new Error("Unknown error"))
    })
  }, [appConfig.userDataDir, userConfig.applicationLanguage])
  
  // Sync i18n language on initial load
  useEffect(() => {
    if (userConfig.applicationLanguage) {
      changeLanguage(userConfig.applicationLanguage).catch(console.error)
    }
  }, []) // Only run on mount

  const value: ConfigContextValue = {
    appConfig,
    userConfig,
    isLoading,
    error,
    setUserConfig: saveUserConfig,
    reload,
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

