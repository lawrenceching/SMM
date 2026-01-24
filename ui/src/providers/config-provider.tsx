import React, { createContext, useCallback, useContext, useEffect, useState } from "react"
import { RenameRules, type AppConfig, type UserConfig } from "@core/types"
import { join } from "@/lib/path"
import { readFileApi } from "@/api/readFile"
import { writeFile } from "@/api/writeFile"
import { changeLanguage } from "@/lib/i18n"
import { useLatest } from "react-use"

interface ConfigContextValue {
  appConfig: AppConfig
  userConfig: UserConfig
  isLoading: boolean
  error: Error | null
  setUserConfig: (config: UserConfig) => void
  reload: () => void
  addMediaFolderInUserConfig: (folder: string) => void
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
  selectedRenameRule: RenameRules.Plex.name,
}

export function ConfigProvider({
  appConfig: initialAppConfig,
  userConfig: initialUserConfig = defaultUserConfig,
  children,
}: ConfigProviderProps) {
  const [appConfig, setAppConfig] = useState<AppConfig>(
    initialAppConfig || { version: "unknown" }
  )
  const latestAppConfig = useLatest(appConfig)
  const [userConfig, setUserConfig] = useState<UserConfig>(initialUserConfig || defaultUserConfig)
  const [isLoading, setIsLoading] = useState(!initialAppConfig)
  const [error, setError] = useState<Error | null>(null)

  const reload = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      // TODO: use the hello.ts
      
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
      console.log(`[ConfigProvider] Reloaded user data directory: ${userDataDir}`)
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
    if(!latestAppConfig.current.userDataDir) {
      debugger;
      throw new Error("User data directory not found")
    }
    
    // Sync i18n language if language changed
    if (config.applicationLanguage !== userConfig.applicationLanguage) {
      await changeLanguage(config.applicationLanguage);
    }
    
    writeFile(join(latestAppConfig.current.userDataDir, 'smm.json'), JSON.stringify(config))
    .then(() => {
      console.log("User config written successfully")
      setUserConfig(config)
    })
    .catch((err) => {
      console.error("Failed to write user config:", err)
      setError(err instanceof Error ? err : new Error("Unknown error"))
    })
  }, [appConfig.userDataDir, userConfig.applicationLanguage])

  const addMediaFolderInUserConfig = useCallback((folder: string) => {
    // Check if folder already exists
    if (userConfig.folders.includes(folder)) {
      return
    }
    
    // Add folder to the array and save
    const updatedConfig: UserConfig = {
      ...userConfig,
      folders: [...userConfig.folders, folder]
    }
    
    saveUserConfig(updatedConfig)
  }, [userConfig, saveUserConfig])
  
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
    addMediaFolderInUserConfig,
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
