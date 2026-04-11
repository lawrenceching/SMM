import { useState, useCallback, useEffect, useMemo } from "react"
import { ImmersiveSearchbox, type ImmersiveSearchResultItem } from "./ImmersiveSearchbox"
import { getTMDBImageUrl, searchTmdb } from "@/api/tmdb"
import { useConfig } from "@/hooks/userConfig"
import { useTranslation } from "@/lib/i18n"
import { SUPPORTED_APP_LANGUAGES, type SupportedLanguage } from "@/lib/i18n"
import type { TMDBTVShow, TMDBMovie, PrimaryDatabase, PreferMediaLanguage } from "@core/types"
import { TVDBv4, type TVDBv4Envelope, type TVDBv4SearchResult } from "@smm/tvdb4"
import {
  getTvdbSearchResultAlternateName,
  getTvdbSearchResultName,
  getTvdbSearchResultOverview,
  tvdbTranslationCodesForMediaLanguage,
} from "@/lib/tvdbSearchDisplay"
import { buildTvdbSearchResults, type TVDBSearchItem } from "@/lib/tvdbSearchNormalize"
import { useTvdbQueries } from "@/hooks/useTvdbQueries"

/** TMDB API language for search and get-by-id. */
export type TmdbSearchLanguage = "zh-CN" | "en-US" | "ja-JP"

/** Map app SupportedLanguage to TMDB search API language. Exported for callers that need a default (e.g. NFO / folder-name flow). */
export function mapSearchLanguageToTmdb(lang: SupportedLanguage): TmdbSearchLanguage {
  if (lang === "zh-CN") return "zh-CN"
  if (lang === "en") return "en-US"
  return "en-US"
}

function mediaSearchLanguageFromConfigFields(
  preferMediaLanguage: PreferMediaLanguage | undefined,
  applicationLanguage: string | undefined,
  validCodes: ReadonlySet<string>
): TmdbSearchLanguage {
  if (preferMediaLanguage) {
    return preferMediaLanguage
  }
  if (applicationLanguage && validCodes.has(applicationLanguage)) {
    return mapSearchLanguageToTmdb(applicationLanguage as SupportedLanguage)
  }
  return "zh-CN"
}

export type { TVDBSearchItem }

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
    () => new Set(SUPPORTED_APP_LANGUAGES.map((l) => l.code)),
    []
  )
  const [searchDatabase, setSearchDatabase] = useState<PrimaryDatabase>(() => {
    return (userConfig?.primaryDatabase || "TMDB") as PrimaryDatabase
  })
  const [searchLanguage, setSearchLanguage] = useState<TmdbSearchLanguage>(() =>
    mediaSearchLanguageFromConfigFields(userConfig?.preferMediaLanguage, userConfig?.applicationLanguage, validCodes)
  )
  const [searchQuery, setSearchQuery] = useState(value || "")
  const [searchResults, setSearchResults] = useState<(TMDBTVShow | TMDBMovie)[]>([])
  const [tvdbSearchResultsRaw, setTvdbSearchResultsRaw] = useState<TVDBSearchItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const { search: searchTvdb } = useTvdbQueries()

  useEffect(() => {
    const db = userConfig?.primaryDatabase
    if (db === "TMDB" || db === "TVDB") setSearchDatabase(db)
  }, [userConfig?.primaryDatabase])

  useEffect(() => {
    setSearchLanguage(
      mediaSearchLanguageFromConfigFields(
        userConfig?.preferMediaLanguage,
        userConfig?.applicationLanguage,
        validCodes
      )
    )
  }, [userConfig?.preferMediaLanguage, userConfig?.applicationLanguage, validCodes])

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

        const result: TVDBv4SearchResult[] | undefined = await searchTvdb({
          query: searchQuery.trim(),
          type: mediaType === "tv" ? "series" : "movie",
        })

        if(result === undefined || result.length === 0) {
          setSearchError(t("errors:searchNoResults"))
          return
        }

        const items = buildTvdbSearchResults(result);
        setTvdbSearchResultsRaw(items)

        return
      }

      const response = await searchTmdb(searchQuery.trim(), mediaType, searchLanguage)

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
          searchLanguage
        })
        return
      }
      onSearchResultSelected({
        database: "TMDB",
        result: item.raw as TMDBTVShow | TMDBMovie,
        searchLanguage,
      })
    },
    [onSearchResultSelected, searchLanguage, searchDatabase]
  )

  const uiSearchResults = useMemo<ImmersiveSearchResultItem[]>(() => {
    if (searchDatabase === "TVDB") {
      const tvdbCodes = tvdbTranslationCodesForMediaLanguage(searchLanguage)
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
