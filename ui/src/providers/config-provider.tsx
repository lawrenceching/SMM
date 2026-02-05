import React, { createContext, useCallback, useContext, useEffect, useState } from "react"
import { type AppConfig, type HelloResponseBody, type UserConfig } from "@core/types"
import { join } from "@/lib/path"
import { writeFile } from "@/api/writeFile"
import { changeLanguage } from "@/lib/i18n"
import { useLatest } from "react-use"
import { hello } from "@/api/hello"
import { defaultUserConfig, readUserConfig } from "@/api/readUserConfig"

interface ReloadCallback {
  onSuccess?: (config: UserConfig) => void | Promise<void>
  onError?: (error: Error) => void | Promise<void>
}

interface ConfigContextValue {
  appConfig: AppConfig
  userConfig: UserConfig
  isLoading: boolean
  error: Error | null
  setAndSaveUserConfig: (traceId: string, config: UserConfig) => Promise<void>
  reload: (callback?: ReloadCallback) => void
  addMediaFolderInUserConfig: (traceId: string, folder: string) => Promise<void>
}

const ConfigContext = createContext<ConfigContextValue | undefined>(undefined)

interface ConfigProviderProps {
  children: React.ReactNode
}

export function ConfigProvider({
  children,
}: ConfigProviderProps) {
  const [appConfig, setAppConfig] = useState<AppConfig>({ version: "unknown" }
  )
  const latestAppConfig = useLatest(appConfig)
  const [userConfig, setUserConfig] = useState<UserConfig>(defaultUserConfig)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const reload = useCallback(async (callback?: ReloadCallback) => {
    try {
      setIsLoading(true)
      setError(null)

      const data: HelloResponseBody = await hello()
      console.log(`[ConfigProvider] Reloaded user data directory: ${data.userDataDir}`)

      // Update appConfig with userDataDir and version
      setAppConfig((prev) => {
        return {
          ...prev,
          userDataDir: data.userDataDir,
          version: data.version,
        }
      })

      // Use readUserConfig to load user config
      const config = await readUserConfig(data);
      console.log('[ConfigProvider] Reloaded user config', config)
      setUserConfig(config)

      // Sync i18n language with config
      if (config.applicationLanguage) {
        await changeLanguage(config.applicationLanguage);
      }

      // Call onSuccess callback if provided
      if (callback?.onSuccess) {
        await callback.onSuccess(config)
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Unknown error")
      console.error("Failed to fetch app config:", err)
      setError(error)

      // Call onError callback if provided
      if (callback?.onError) {
        await callback.onError(error)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

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
    setAndSaveUserConfig: saveUserConfig,
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
