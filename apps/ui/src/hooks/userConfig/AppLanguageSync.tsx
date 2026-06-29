import { useEffect } from "react"
import { resolveAppLanguage } from "@core/locale"
import { changeLanguage } from "@/lib/i18n"
import { redactUserConfig } from "@/lib/redactUserConfig"
import { useHelloQuery } from "./useHelloQuery"
import { useUserConfigQuery } from "./useUserConfigQuery"

const debug = import.meta.env.DEV

/**
 * Keeps i18n in sync with the resolved application language priority chain:
 * smm.json > browser > OS > English.
 */
export function AppLanguageSync() {
  const helloQuery = useHelloQuery()
  const userDataDir = helloQuery.data?.userDataDir
  const userConfigQuery = useUserConfigQuery(userDataDir)
  const userConfig = userConfigQuery.data

  useEffect(() => {
    if (!userConfigQuery.isSuccess) return

    const resolved = resolveAppLanguage({
      configured: userConfig?.applicationLanguage,
      browserLocale: typeof navigator !== "undefined" ? navigator.language : undefined,
      osLocale: helloQuery.data?.osLocale,
    })

    changeLanguage(resolved).catch(console.error)
  }, [
    userConfigQuery.isSuccess,
    userConfig?.applicationLanguage,
    helloQuery.data?.osLocale,
  ])

  useEffect(() => {
    if (!debug || !userConfigQuery.isSuccess) return
    console.log("[AppLanguageSync] userConfig: " + JSON.stringify(redactUserConfig(userConfig)))
  }, [userConfig, userConfigQuery.isSuccess])

  return null
}
