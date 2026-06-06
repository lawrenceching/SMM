import { useMemo } from "react"
import type { LanguageCode, PreferMediaLanguage, UserConfig } from "@core/types"
import { resolveAppLanguage, resolveMediaLanguage, type ResolveAppLanguageOptions } from "@core/locale"
import { useConfig } from "@/hooks/userConfig"
import { useHelloQuery } from "@/hooks/userConfig/useHelloQuery"

export function getBrowserLocale(): string {
  if (typeof navigator !== "undefined") {
    return navigator.language
  }
  return ""
}

export interface ResolvedLanguages {
  appLanguage: LanguageCode
  mediaLanguage: PreferMediaLanguage
}

export function getResolvedLanguages(
  userConfig: Pick<UserConfig, "applicationLanguage" | "preferMediaLanguage">,
  opts?: { browserLocale?: string; osLocale?: string },
): ResolvedLanguages {
  const resolveOpts: ResolveAppLanguageOptions = {
    configured: userConfig.applicationLanguage,
    browserLocale: opts?.browserLocale ?? getBrowserLocale(),
    osLocale: opts?.osLocale,
  }

  return {
    appLanguage: resolveAppLanguage(resolveOpts),
    mediaLanguage: resolveMediaLanguage({
      ...resolveOpts,
      preferMediaLanguage: userConfig.preferMediaLanguage,
    }),
  }
}

export function useResolvedLanguages(): ResolvedLanguages {
  const { userConfig } = useConfig()
  const helloQuery = useHelloQuery()

  return useMemo(
    () =>
      getResolvedLanguages(userConfig, {
        browserLocale: getBrowserLocale(),
        osLocale: helloQuery.data?.osLocale,
      }),
    [
      userConfig.applicationLanguage,
      userConfig.preferMediaLanguage,
      helloQuery.data?.osLocale,
    ],
  )
}
