import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import {
  getTmdbLanguages,
  getTmdbPrimaryTranslations,
  type TmdbLanguageEntry,
  type TmdbRequestOptions,
} from "@/api/tmdb"
import { useConfig } from "@/hooks/userConfig"
import { useQueryClient } from "@tanstack/react-query"
import { helloQueryKey } from "@/lib/appQueryKeys"
import type { HelloResponseBody } from "@core/types"
import { SMM_TMDB_DEFAULT_UPSTREAM } from "@/api/tmdb"
import { getLanguageDisplayName } from "@/lib/languageNativeNames"

const STALE_MS = 24 * 60 * 60 * 1000

function useTmdbRequestOptions(): TmdbRequestOptions {
  const queryClient = useQueryClient()
  const { appConfig, userConfig } = useConfig()
  const reverseProxyUrl =
    appConfig?.reverseProxyUrl ??
    queryClient.getQueryData<HelloResponseBody>(helloQueryKey)?.reverseProxyUrl ??
    null
  return {
    reverseProxyUrl,
    upstreamBaseURL: userConfig.tmdb?.host?.trim() || SMM_TMDB_DEFAULT_UPSTREAM,
    apiKey: userConfig.tmdb?.apiKey?.trim() || undefined,
  }
}

/**
 * Fetch TMDB's primary translation list (IETF tags, e.g. ["zh-CN", "en-US"]).
 * Cached for 24h.
 */
export function useTmdbPrimaryTranslations() {
  const options = useTmdbRequestOptions()
  return useQuery<string[]>({
    queryKey: ["tmdb", "primaryTranslations"],
    queryFn: () => getTmdbPrimaryTranslations(options),
    staleTime: STALE_MS,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    enabled: Boolean(options.reverseProxyUrl),
  })
}

/**
 * Fetch TMDB's ISO 639-1 language list with English and native names.
 * Cached for 24h.
 */
export function useTmdbLanguagesRaw() {
  const options = useTmdbRequestOptions()
  return useQuery<TmdbLanguageEntry[]>({
    queryKey: ["tmdb", "languages"],
    queryFn: () => getTmdbLanguages(options),
    staleTime: STALE_MS,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    enabled: Boolean(options.reverseProxyUrl),
  })
}

export interface TmdbSearchLanguageOption {
  /** IETF tag, e.g. "zh-CN" */
  code: string
  /** Display name, e.g. "Chinese (zh-CN)" or "中文 (zh-CN)" */
  name: string
}

/**
 * Build a deduped, sorted list of `{ code, name }` for the TMDB search-language dropdown.
 * Combines the primary-translation IETF tags with the ISO 639-1 language list to derive
 * a human-readable name. The first three items are the legacy defaults
 * (`zh-CN`, `en-US`, `ja-JP`) so the collapsed dropdown matches the current UI.
 */
export function useTmdbSearchLanguageOptions(): {
  data: TmdbSearchLanguageOption[] | undefined
  isLoading: boolean
  error: unknown
} {
  const primary = useTmdbPrimaryTranslations()
  const languages = useTmdbLanguagesRaw()

  const data = useMemo<TmdbSearchLanguageOption[] | undefined>(() => {
    if (!primary.data) return undefined
    const nameByIso6391 = new Map<string, TmdbLanguageEntry>()
    for (const lang of languages.data ?? []) {
      nameByIso6391.set(lang.iso_639_1, lang)
    }
    const seen = new Set<string>()
    const list: TmdbSearchLanguageOption[] = []
    for (const tag of primary.data) {
      if (seen.has(tag)) continue
      seen.add(tag)
      const iso6391 = tag.split("-")[0]?.toLowerCase() ?? ""
      const lang = nameByIso6391.get(iso6391)
      const english = lang?.english_name ?? iso6391.toUpperCase()
      list.push({ code: tag, name: getLanguageDisplayName(tag, english) })
    }
    return list
  }, [primary.data, languages.data])

  return {
    data,
    isLoading: primary.isLoading || languages.isLoading,
    error: primary.error ?? languages.error,
  }
}

export const TMDB_PRIORITY_LANGUAGE_CODES = ["zh-CN", "en-US", "ja-JP"] as const
