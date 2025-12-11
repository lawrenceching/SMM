import React, { createContext, useContext, useEffect, useState } from "react"
import type { AppConfig, UserConfig } from "@core/types"

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
  uptime: number
  version: string
}

async function getConfigFromElectronIpcChannel() {
  // 1. Check if it's in Electron environment
  // 2. If yes, call ExecuteChannel channel with name "get-config"
  // 3. Get the user config path from the response
}

export function ConfigProvider({
  appConfig: initialAppConfig,
  userConfig = {},
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

