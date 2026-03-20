import { useState, useCallback, useEffect, useMemo } from "react"
import { ImmersiveSearchbox, type ImmersiveSearchResultItem } from "./ImmersiveSearchbox"
import { getTMDBImageUrl, searchTmdb } from "@/api/tmdb"
import { useConfig } from "@/providers/config-provider"
import { useTranslation } from "@/lib/i18n"
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/i18n"
import type { TMDBTVShow, TMDBMovie, PrimaryDatabase } from "@core/types"
import { TVDBv4, type TVDBv4Envelope, type TVDBv4SearchResult } from "@smm/tvdb4"
import {
  getTvdbSearchResultAlternateName,
  getTvdbSearchResultName,
  getTvdbSearchResultOverview,
  tvdbTranslationCodesForUiLanguage,
} from "@/lib/tvdbSearchDisplay"

/** Map app SupportedLanguage to TMDB search API language. Exported for callers that need a default (e.g. NFO / folder-name flow). */
export function mapSearchLanguageToTmdb(lang: SupportedLanguage): TmdbSearchLanguage {
  if (lang === "zh-CN") return "zh-CN"
  if (lang === "en") return "en-US"
  return "en-US"
}

/** TMDB API language for search and get-by-id. */
export type TmdbSearchLanguage = "zh-CN" | "en-US" | "ja-JP"

export type TVDBSearchItem = Record<string, unknown>

function extractTvdbIdFromUnknown(v: unknown): number | undefined {
  if (typeof v === "number") {
    return Number.isFinite(v) && v > 0 ? v : undefined
  }
  if (typeof v !== "string") return undefined
  const digits = v.match(/\d+/g)?.join("")
  if (!digits) return undefined
  const parsed = parseInt(digits, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

/**
 * Normalize TVDB v4 search hits into a stable subset of fields we rely on.
 *
 * TVDB官方搜索命中通常包含类似：
 * - `objectID`: "series-421069"
 * - `id`: "series-421069" (may also be number depending on proxy shape)
 * - `tvdb_id`: "421069"
 *
 * Some fields are optional/variant across responses, so we derive them conservatively
 * to avoid breaking downstream selection logic.
 */
function buildTvdbSearchResults(raw: TVDBv4SearchResult[]): TVDBSearchItem[] {
  return raw.map((item) => {
    const out: Record<string, unknown> = { ...(item as Record<string, unknown>) }

    const objectId = (out as any).objectID as unknown
    const rawTvdbId = (out as any).tvdb_id as unknown
    const rawTvdbIdCamel = (out as any).tvdbId as unknown

    // Ensure `id` exists (TVShowPanel relies on `result.id` being string-like).
    if (out.id == null && objectId != null) out.id = objectId
    if (out.id == null && rawTvdbId != null) out.id = rawTvdbId
    if (out.id == null && rawTvdbIdCamel != null) out.id = rawTvdbIdCamel

    // Coerce `id` to string if present to avoid runtime `.replace` errors.
    if (out.id != null && typeof out.id !== "string") out.id = String(out.id)

    // Ensure `tvdb_id` exists (MoviePanel / key generation may use it).
    const hasAnyTvdbId = rawTvdbId != null || rawTvdbIdCamel != null
    if (!hasAnyTvdbId) {
      const derived = extractTvdbIdFromUnknown(out.id ?? objectId)
      if (derived != null) {
        out.tvdb_id = derived
        out.tvdbId = derived
      }
    } else {
      // Keep both snake_case and camelCase in sync when possible.
      if (rawTvdbId != null && rawTvdbIdCamel == null) out.tvdbId = rawTvdbId
      if (rawTvdbIdCamel != null && rawTvdbId == null) out.tvdb_id = rawTvdbIdCamel
    }

    return out as TVDBSearchItem
  })
}

function formatDate(dateString: string | undefined): string | undefined {
  if (!dateString) return undefined
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  } catch {
    return dateString
  }
}

export type SearchResultSelectedArgs =
  | { database: "TMDB"; result: TMDBTVShow | TMDBMovie; searchLanguage: TmdbSearchLanguage }
  | { database: "TVDB"; result: TVDBSearchItem; searchLanguage: TmdbSearchLanguage }

interface TMDBSearchboxProps {
  mediaType: "movie" | "tv"
  value?: string
  onSearchResultSelected: (args: SearchResultSelectedArgs) => void
  placeholder?: string
  inputClassName?: string
  /** Shown in a hover card when the folder is unrecognized (no valid TMDB id). */
  unrecognizedHint?: string
}

export function MediaDatabaseSearchbox({
  mediaType,
  value,
  onSearchResultSelected,
  placeholder,
  inputClassName,
  unrecognizedHint,
}: TMDBSearchboxProps) {
  const { t } = useTranslation(["errors", "components"])
  const { userConfig } = useConfig()

  const validCodes = useMemo(
    () => new Set(SUPPORTED_LANGUAGES.map((l) => l.code)),
    []
  )
  const [searchDatabase, setSearchDatabase] = useState<PrimaryDatabase>(() => {
    return (userConfig?.primaryDatabase || "TMDB") as PrimaryDatabase
  })
  const [searchLanguage, setSearchLanguage] = useState<SupportedLanguage>(() => {
    const appLang = userConfig?.applicationLanguage
    if (appLang && validCodes.has(appLang)) return appLang as SupportedLanguage
    return "zh-CN"
  })
  const [searchQuery, setSearchQuery] = useState(value || "")
  const [searchResults, setSearchResults] = useState<(TMDBTVShow | TMDBMovie)[]>([])
  const [tvdbSearchResultsRaw, setTvdbSearchResultsRaw] = useState<TVDBSearchItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  useEffect(() => {
    const db = userConfig?.primaryDatabase
    if (db === "TMDB" || db === "TVDB") setSearchDatabase(db)
  }, [userConfig?.primaryDatabase])

  useEffect(() => {
    const appLang = userConfig?.applicationLanguage
    if (appLang && validCodes.has(appLang)) {
      setSearchLanguage(appLang as SupportedLanguage)
    }
  }, [userConfig?.applicationLanguage, validCodes])

  useEffect(() => {
    setSearchQuery(value || "")
  }, [value])

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      setTvdbSearchResultsRaw([])
      setSearchError(null)
      return
    }

    setIsSearching(true)
    setSearchError(null)
    setSearchResults([])
    setTvdbSearchResultsRaw([])

    try {
      if (searchDatabase === "TVDB") {

        const tvdb = new TVDBv4({
          baseUrl: `${window.location.protocol}//${window.location.hostname}:${window.location.port}/api/tvdb`,
          // `fetch` 作为裸函数被传递后，在某些运行环境里会丢失 `this` 绑定，
          // 导致 `TypeError: Failed to execute 'fetch' on 'Window': Illegal invocation`。
          // 绑定到 `window` 后可避免该问题。
          fetchImpl: window.fetch.bind(window),
        })

        const resp: TVDBv4Envelope<TVDBv4SearchResult[]> = await tvdb.search({
          query: searchQuery.trim(),
          type: mediaType === "tv" ? "series" : "movie",
        })

        if(resp.status === 'success') {

          if(resp.data.length === 0) {
            setSearchError(t("errors:searchNoResults"))
            return
          }

          const items = buildTvdbSearchResults(resp.data);
          setTvdbSearchResultsRaw(items)
        } else {
          setSearchError(`TVDB Search Failure: ${resp.message}`)
        }

        return
      }

      const language = mapSearchLanguageToTmdb(searchLanguage)
      const response = await searchTmdb(searchQuery.trim(), mediaType, language)

      if (response.error) {
        setSearchError(response.error)
        setSearchResults([])
        return
      }

      const results = response.results.filter(
        (item): item is TMDBTVShow | TMDBMovie =>
          mediaType === "tv" ? "name" in item : "title" in item
      )
      setSearchResults(results)

      if (results.length === 0) {
        setSearchError(t("errors:searchNoResults"))
      }
    } catch (error) {
      console.error("Search failed:", error)
      const errorMessage =
        error instanceof Error ? error.message : t("errors:searchFailed")
      setSearchError(errorMessage)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [searchQuery, searchLanguage, searchDatabase, mediaType, t])

  const handleSelect = useCallback(
    (item: ImmersiveSearchResultItem) => {
      if (searchDatabase === "TVDB") {
        onSearchResultSelected({
          database: "TVDB",
          result: item.raw as TVDBSearchItem,
          searchLanguage: mapSearchLanguageToTmdb(searchLanguage),
        })
        return
      }
      onSearchResultSelected({
        database: "TMDB",
        result: item.raw as TMDBTVShow | TMDBMovie,
        searchLanguage: mapSearchLanguageToTmdb(searchLanguage),
      })
    },
    [onSearchResultSelected, searchLanguage, searchDatabase]
  )

  const uiSearchResults = useMemo<ImmersiveSearchResultItem[]>(() => {
    if (searchDatabase === "TVDB") {
      const tvdbCodes = tvdbTranslationCodesForUiLanguage(searchLanguage)
      return tvdbSearchResultsRaw.map((item, idx) => {
        const displayName = getTvdbSearchResultName(item, tvdbCodes, mediaType)
        const originalName = getTvdbSearchResultAlternateName(item, displayName, mediaType)
        const dateText =
          mediaType === "tv"
            ? formatDate(typeof item.first_air_time === "string" ? item.first_air_time : undefined)
            : formatDate(
                typeof item.release_date === "string"
                  ? item.release_date
                  : typeof item.year === "string"
                    ? item.year
                    : undefined
              )
        const posterUrl =
          (typeof item.image_url === "string" && item.image_url) ||
          (typeof item.poster === "string" && item.poster) ||
          (typeof item.thumbnail === "string" && item.thumbnail) ||
          null
        const id =
          typeof item.tvdb_id === "number" || typeof item.tvdb_id === "string"
            ? String(item.tvdb_id)
            : typeof item.id === "string" || typeof item.id === "number"
              ? String(item.id)
              : String(idx)
        return {
          id,
          displayName,
          originalName,
          overview: getTvdbSearchResultOverview(item, tvdbCodes),
          posterUrl,
          dateText,
          raw: item,
        }
      })
    }

    return searchResults.map((result) => {
      const displayName = "name" in result ? result.name : result.title
      const originalName = "original_name" in result ? result.original_name : result.original_title
      const dateText = "first_air_date" in result ? result.first_air_date : result.release_date
      return {
        id: result.id,
        displayName,
        originalName,
        overview: result.overview || undefined,
        posterUrl: getTMDBImageUrl(result.poster_path, "w200"),
        dateText,
        voteAverage: result.vote_average ?? 0,
        raw: result,
      }
    })
  }, [searchDatabase, searchLanguage, mediaType, searchResults, tvdbSearchResultsRaw])

  return (
    <ImmersiveSearchbox
      value={searchQuery}
      onChange={setSearchQuery}
      onSearch={handleSearch}
      onSelect={handleSelect}
      searchResults={uiSearchResults}
      isSearching={isSearching}
      searchError={searchError}
      placeholder={placeholder}
      inputClassName={inputClassName}
      unrecognizedHint={unrecognizedHint}
      searchDatabase={searchDatabase}
      onSearchDatabaseChange={setSearchDatabase}
      searchLanguage={searchLanguage}
      onSearchLanguageChange={setSearchLanguage}
    />
  )
}
