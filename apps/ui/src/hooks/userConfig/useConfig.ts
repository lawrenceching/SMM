import { useCallback, useMemo } from "react"
import type { AppConfig, UserConfig } from "@core/types"
import { defaultUserConfig } from "@/api/readUserConfig"
import { useAddMediaFolderMutation } from "./useAddMediaFolderMutation"
import { useHelloQuery } from "./useHelloQuery"
import { type ReloadCallback, useReloadAppConfig } from "./useReloadAppConfig"
import { useRefreshUserConfig } from "./useRefreshUserConfig"
import { useSaveUserConfigMutation } from "./useSaveUserConfigMutation"
import { useSetUserConfigInCache } from "./useSetUserConfigInCache"
import { useUserConfigQuery } from "./useUserConfigQuery"

export interface UseConfigResult {
  appConfig: AppConfig
  userConfig: UserConfig
  setUserConfig: (config: UserConfig | ((prevConfig: UserConfig) => UserConfig)) => void
  isLoading: boolean
  isUserConfigLoaded: boolean
  error: Error | null
  setAndSaveUserConfig: (traceId: string, config: UserConfig) => Promise<void>
  reload: (callback?: ReloadCallback) => void
  refreshUserConfig: () => Promise<void>
  addMediaFolderInUserConfig: (traceId: string, folder: string) => Promise<void>
}

function normalizeError(err: unknown): Error | null {
  if (err == null) return null
  return err instanceof Error ? err : new Error(String(err))
}

export function useConfig(): UseConfigResult {
  const helloQuery = useHelloQuery()
  const userDataDir = helloQuery.data?.userDataDir
  const userConfigQuery = useUserConfigQuery(userDataDir)
  const { reload, reloadLoading, reloadError } = useReloadAppConfig()
  const refreshUserConfig = useRefreshUserConfig()
  const setUserConfigInCache = useSetUserConfigInCache()
  const saveUserConfigMutation = useSaveUserConfigMutation()
  const addMediaFolderMutation = useAddMediaFolderMutation()

  const userConfig = userConfigQuery.data ?? defaultUserConfig

  const appConfig: AppConfig = useMemo(
    () => ({
      version: helloQuery.data?.version ?? "unknown",
      userDataDir: helloQuery.data?.userDataDir,
      reverseProxyUrl: helloQuery.data?.reverseProxyUrl ?? null,
    }),
    [helloQuery.data?.version, helloQuery.data?.userDataDir, helloQuery.data?.reverseProxyUrl],
  )

  const setAndSaveUserConfig = useCallback(
    async (traceId: string, config: UserConfig) => {
      console.log(`[${traceId}] saveUserConfig: Starting save operation`)
      await saveUserConfigMutation.mutateAsync({ traceId, config })
      console.log(`[${traceId}] saveUserConfig: User config written successfully`)
    },
    [saveUserConfigMutation],
  )

  const setUserConfig = useCallback(
    (config: UserConfig | ((prevConfig: UserConfig) => UserConfig)) => {
      setUserConfigInCache(config)
    },
    [setUserConfigInCache],
  )

  const addMediaFolderInUserConfig = useCallback(
    async (traceId: string, folder: string) => {
      console.log(`[${traceId}] addMediaFolderInUserConfig: Adding folder ${folder}`)
      await addMediaFolderMutation.mutateAsync({ traceId, folder })
    },
    [addMediaFolderMutation],
  )

  const isLoading =
    reloadLoading || (Boolean(userDataDir) && userConfigQuery.isPending)
  const isUserConfigLoaded = Boolean(userDataDir) && userConfigQuery.isSuccess

  const error =
    reloadError ??
    normalizeError(helloQuery.error) ??
    normalizeError(userConfigQuery.error) ??
    normalizeError(saveUserConfigMutation.error) ??
    normalizeError(addMediaFolderMutation.error)

  return {
    appConfig,
    userConfig,
    setUserConfig,
    isLoading,
    isUserConfigLoaded,
    error,
    setAndSaveUserConfig,
    reload,
    refreshUserConfig,
    addMediaFolderInUserConfig,
  }
}
