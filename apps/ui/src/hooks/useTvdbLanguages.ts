import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo } from "react"
import type { TVDBv4LanguageRecord } from "@smm/tvdb4/types"
import { getTvdbLanguages, SMM_TVDB_DEFAULT_UPSTREAM, type GetTVDBv4ClientOverrides } from "@/lib/TvdbUtils"
import { useConfig } from "@/hooks/userConfig"
import { helloQueryKey } from "@/lib/appQueryKeys"
import type { HelloResponseBody } from "@core/types"
import { getLanguageDisplayName } from "@/lib/languageNativeNames"

const STALE_MS = 24 * 60 * 60 * 1000

function useTvdbRequestOptions(): GetTVDBv4ClientOverrides {
  const queryClient = useQueryClient()
  const { appConfig, userConfig } = useConfig()
  const reverseProxyUrl =
    appConfig?.reverseProxyUrl ??
    queryClient.getQueryData<HelloResponseBody>(helloQueryKey)?.reverseProxyUrl ??
    null
  return {
    reverseProxyUrl,
    upstreamBaseURL: userConfig.tvdb?.host?.trim() || SMM_TVDB_DEFAULT_UPSTREAM,
    apiKey: userConfig.tvdb?.apiKey?.trim() || undefined,
  }
}

/**
 * Fetch TVDB's full list of supported languages (ISO 639-3 records).
 * Cached for 24h.
 */
export function useTvdbLanguages() {
  const options = useTvdbRequestOptions()
  return useQuery<TVDBv4LanguageRecord[] | undefined>({
    queryKey: ["tvdb", "languages"],
    queryFn: () => getTvdbLanguages(options),
    staleTime: STALE_MS,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    enabled: Boolean(options.reverseProxyUrl),
  })
}

export interface TvdbSearchLanguageOption {
  /** ISO 639-3 code, e.g. "eng" */
  code: string
  /** Display name, e.g. "English" or "English (eng)" */
  name: string
}

/**
 * Build a deduped, sorted list of `{ code, name }` for the TVDB search-language dropdown.
 * The first three items are the legacy defaults (`eng`, `zho`, `jpn`) so the collapsed
 * dropdown matches the current UI.
 */
export function useTvdbSearchLanguageOptions(): {
  data: TvdbSearchLanguageOption[] | undefined
  isLoading: boolean
  error: unknown
} {
  const languages = useTvdbLanguages()

  const data = useMemo<TvdbSearchLanguageOption[] | undefined>(() => {
    if (!languages.data) return undefined
    const seen = new Set<string>()
    const list: TvdbSearchLanguageOption[] = []
    for (const lang of languages.data) {
      if (!lang.id || seen.has(lang.id)) continue
      seen.add(lang.id)
      const english = lang.name?.trim() || lang.id
      list.push({ code: lang.id, name: getLanguageDisplayName(lang.id, english) })
    }
    return list
  }, [languages.data])

  return {
    data,
    isLoading: languages.isLoading,
    error: languages.error,
  }
}

export const TVDB_PRIORITY_LANGUAGE_CODES = ["eng", "zho", "jpn"] as const
