import React, { createContext, useContext } from "react"
import type { AppConfig, UserConfig } from "@core/types"

interface ConfigContextValue {
  appConfig: AppConfig
  userConfig: UserConfig
}

const ConfigContext = createContext<ConfigContextValue | undefined>(undefined)

interface ConfigProviderProps {
  appConfig: AppConfig
  userConfig?: UserConfig
  children: React.ReactNode
}

export function ConfigProvider({
  appConfig,
  userConfig = {},
  children,
}: ConfigProviderProps) {
  const value: ConfigContextValue = {
    appConfig,
    userConfig,
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

