import { useState, useCallback, useEffect, useMemo } from "react"
import { ImmersiveSearchbox } from "./ImmersiveSearchbox"
import { searchTmdb } from "@/api/tmdb"
import { useConfig } from "@/providers/config-provider"
import { useTranslation } from "@/lib/i18n"
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/i18n"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import type { TMDBTVShow, TMDBMovie, PrimaryDatabase } from "@core/types"
import { ImmersiveSearchboxTvdb } from "./ImmersiveSearchboxTvdb"
import { TVDBv4, type TVDBv4Envelope, type TVDBv4SearchResult } from "@smm/tvdb4"

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
  const [tvdbSearchResults, setTvdbSearchResults] = useState<Array<Record<string, unknown>>>([])
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
      setTvdbSearchResults([])
      setSearchError(null)
      return
    }

    setIsSearching(true)
    setSearchError(null)
    setSearchResults([])
    setTvdbSearchResults([])

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
          setTvdbSearchResults(items)
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
    (result: TMDBTVShow | TMDBMovie) => {
      onSearchResultSelected({
        database: "TMDB",
        result,
        searchLanguage: mapSearchLanguageToTmdb(searchLanguage),
      })
    },
    [onSearchResultSelected, searchLanguage, searchDatabase]
  )

  const handleSelectTvdb = useCallback(
    (result: Record<string, unknown>) => {
      onSearchResultSelected({
        database: "TVDB",
        result,
        searchLanguage: mapSearchLanguageToTmdb(searchLanguage),
      })
    },
    [onSearchResultSelected, searchLanguage, searchDatabase]
  )

  const searchOptionsSlot = (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">
          {t("components:tmdbSearchbox.database" as "components:movie.searchPlaceholder")}
        </Label>
        <Select
          value={searchDatabase}
          onValueChange={(v) => setSearchDatabase(v as PrimaryDatabase)}
        >
          <SelectTrigger id="tmdb-search-database" size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TMDB">TMDB</SelectItem>
            <SelectItem value="TVDB">TVDB</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">
          {t("components:tmdbSearchbox.searchLanguage" as "components:movie.searchPlaceholder")}
        </Label>
        <Select
          value={searchLanguage}
          onValueChange={(v) => setSearchLanguage(v as SupportedLanguage)}
        >
          <SelectTrigger id="tmdb-search-language" size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <SelectItem key={lang.code} value={lang.code}>
                {lang.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )

  if (searchDatabase === "TVDB") {
    return (
      <ImmersiveSearchboxTvdb
        value={searchQuery}
        onChange={setSearchQuery}
        onSearch={handleSearch}
        onSelect={handleSelectTvdb}
        searchResults={tvdbSearchResults}
        isSearching={isSearching}
        searchError={searchError}
        placeholder={placeholder}
        inputClassName={inputClassName}
        unrecognizedHint={unrecognizedHint}
        slotBetweenInputAndList={searchOptionsSlot}
        mediaType={mediaType}
        searchLanguage={searchLanguage}
      />
    )
  }

  return (
    <ImmersiveSearchbox
      value={searchQuery}
      onChange={setSearchQuery}
      onSearch={handleSearch}
      onSelect={handleSelect}
      searchResults={searchResults}
      isSearching={isSearching}
      searchError={searchError}
      placeholder={placeholder}
      inputClassName={inputClassName}
      unrecognizedHint={unrecognizedHint}
      slotBetweenInputAndList={searchOptionsSlot}
    />
  )
}
