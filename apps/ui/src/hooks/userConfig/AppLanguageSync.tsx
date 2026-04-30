import { useEffect } from "react"
import { changeLanguage } from "@/lib/i18n"
import { useHelloQuery } from "./useHelloQuery"
import { useUserConfigQuery } from "./useUserConfigQuery"

const debug = import.meta.env.DEV

/**
 * Keeps i18n in sync with persisted `applicationLanguage` (replaces the effect that lived in ConfigProvider).
 */
export function AppLanguageSync() {
  const helloQuery = useHelloQuery()
  const userDataDir = helloQuery.data?.userDataDir
  const userConfigQuery = useUserConfigQuery(userDataDir)
  const userConfig = userConfigQuery.data

  useEffect(() => {
    if (!userConfigQuery.isSuccess) return
    if (userConfig?.applicationLanguage) {
      changeLanguage(userConfig.applicationLanguage).catch(console.error)
    }
  }, [userConfigQuery.isSuccess, userConfig?.applicationLanguage])

  useEffect(() => {
    if (!debug || !userConfigQuery.isSuccess) return
    console.log("[AppLanguageSync] userConfig: " + JSON.stringify(userConfig))
  }, [userConfig, userConfigQuery.isSuccess])

  return null
}
