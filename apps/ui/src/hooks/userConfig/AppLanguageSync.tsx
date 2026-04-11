import { useEffect } from "react"
import { defaultUserConfig } from "@/api/readUserConfig"
import { changeLanguage } from "@/lib/i18n"
import { useHelloQuery } from "./useHelloQuery"
import { useUserConfigQuery } from "./useUserConfigQuery"

const debug = true

/**
 * Keeps i18n in sync with persisted `applicationLanguage` (replaces the effect that lived in ConfigProvider).
 */
export function AppLanguageSync() {
  const helloQuery = useHelloQuery()
  const userDataDir = helloQuery.data?.userDataDir
  const userConfigQuery = useUserConfigQuery(userDataDir)
  const userConfig = userConfigQuery.data ?? defaultUserConfig

  useEffect(() => {
    if (userConfig.applicationLanguage) {
      changeLanguage(userConfig.applicationLanguage).catch(console.error)
    }
  }, [userConfig.applicationLanguage])

  useEffect(() => {
    if (debug) {
      console.log("[AppLanguageSync] userConfig: " + JSON.stringify(userConfig))
    }
  }, [userConfig])

  return null
}
