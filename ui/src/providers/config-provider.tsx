import React, { createContext, useCallback, useContext, useEffect, useState } from "react"
import { RenameRules, type AppConfig, type UserConfig } from "@core/types"
import { join } from "@/lib/path"
import { readFile, readFileApi } from "@/api/readFile"
import { writeFile } from "@/api/writeFile"
import { changeLanguage } from "@/lib/i18n"
import { useLatest } from "react-use"

interface ConfigContextValue {
  appConfig: AppConfig
  userConfig: UserConfig
  isLoading: boolean
  error: Error | null
  setUserConfig: (traceId: string, config: UserConfig) => Promise<void>
  reload: () => void
  addMediaFolderInUserConfig: (traceId: string, folder: string) => Promise<void>
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
  enableMcpServer: false,
  mcpHost: '127.0.0.1',
  mcpPort: 30001,
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

      const resp = await readFile(filePath);
      const config = resp.data ? JSON.parse(resp.data) as UserConfig : defaultUserConfig;
      console.log('[ConfigProvider] Reloaded user config', config)
      setUserConfig(config)
      
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

  const saveUserConfig = useCallback(async (traceId: string, config: UserConfig) => {
    console.log(`[${traceId}] saveUserConfig: Starting save operation`)

    if(!latestAppConfig.current.userDataDir) {
      console.error(`[${traceId}] saveUserConfig: User data directory not found`)
      debugger;
      throw new Error("User data directory not found")
    }

    // Sync i18n language if language changed
    if (config.applicationLanguage !== userConfig.applicationLanguage) {
      console.log(`[${traceId}] saveUserConfig: Changing language to ${config.applicationLanguage}`)
      await changeLanguage(config.applicationLanguage);
    }

    const filePath = join(latestAppConfig.current.userDataDir, 'smm.json');
    console.log(`[${traceId}] saveUserConfig: Writing config to ${filePath}`)

    writeFile(filePath, JSON.stringify(config), traceId)
    .then(() => {
      console.log(`[${traceId}] saveUserConfig: User config written successfully`)
      setUserConfig(config)
    })
    .catch((err) => {
      console.error(`[${traceId}] saveUserConfig: Failed to write user config:`, err)
      setError(err instanceof Error ? err : new Error("Unknown error"))
    })
  }, [appConfig.userDataDir, userConfig.applicationLanguage, latestAppConfig])

  const addMediaFolderInUserConfig = useCallback(async (traceId: string, folder: string) => {
    // Use functional state update to always get the latest config
    // This avoids the closure trap where the function captures an outdated userConfig
    setUserConfig((prevConfig) => {
      // Check if folder already exists using the latest config
      if (prevConfig.folders.includes(folder)) {
        console.log(`[${traceId}] addMediaFolderInUserConfig: Folder ${folder} already exists in latest config, skipping`)
        return prevConfig
      }

      console.log(`[${traceId}] addMediaFolderInUserConfig: Adding folder ${folder}`)

      const updatedConfig: UserConfig = {
        ...prevConfig,
        folders: [...new Set([...prevConfig.folders, folder])]
      }

      console.log(`[${traceId}] addMediaFolderInUserConfig: Updated config with ${updatedConfig.folders.length} folders`)

      // Also save to file
      const userDataDir = latestAppConfig.current.userDataDir
      if (!userDataDir) {
        console.error(`[${traceId}] addMediaFolderInUserConfig: User data directory not found`)
        return prevConfig
      }

      const filePath = join(userDataDir, 'smm.json');

      writeFile(filePath, JSON.stringify(updatedConfig), traceId)
        .then(() => {
          console.log(`[${traceId}] addMediaFolderInUserConfig: User config written successfully`)
        })
        .catch((err) => {
          console.error(`[${traceId}] addMediaFolderInUserConfig: Failed to write user config:`, err)
          setError(err instanceof Error ? err : new Error("Unknown error"))
        })

      return updatedConfig
    })
  }, [latestAppConfig, setError])
  
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
