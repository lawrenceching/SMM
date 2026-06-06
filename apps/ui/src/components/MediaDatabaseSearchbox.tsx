import { useState, useCallback, useEffect, useMemo } from "react"
import { ImmersiveSearchbox, type ImmersiveSearchResultItem } from "./ImmersiveSearchbox"
import { getTMDBImageUrl } from "@/api/tmdb"
import { searchTmdbDirect } from "@/api/tmdbDirect"
import { useConfig } from "@/hooks/userConfig"
import { useResolvedLanguages } from "@/hooks/useResolvedLanguages"
import { useTranslation } from "@/lib/i18n"
import type { TMDBTVShow, TMDBMovie, PrimaryDatabase, PreferMediaLanguage } from "@core/types"
import { type TVDBv4SearchResult } from "@smm/tvdb4"
import {
  getTvdbSearchResultAlternateName,
  getTvdbSearchResultName,
  getTvdbSearchResultOverview,
  tvdbTranslationCodesForMediaLanguage,
} from "@/lib/tvdbSearchDisplay"
import { buildTvdbSearchResults, type TVDBSearchItem } from "@/lib/tvdbSearchNormalize"
import { searchTvdbDirect } from "@/lib/TvdbDirectSearch"
import { useMediaDatabaseBaseUrls } from "@/hooks/useMediaDatabaseBaseUrls"

/** TMDB API language for search and get-by-id. */
export type TmdbSearchLanguage = PreferMediaLanguage

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
  const { mediaLanguage: resolvedMediaLanguage } = useResolvedLanguages()

  const [searchDatabase, setSearchDatabase] = useState<PrimaryDatabase>(() => {
    return (userConfig?.primaryDatabase || "TMDB") as PrimaryDatabase
  })
  const [searchLanguage, setSearchLanguage] = useState<TmdbSearchLanguage>(resolvedMediaLanguage)
  const [searchQuery, setSearchQuery] = useState(value || "")
  const [searchResults, setSearchResults] = useState<(TMDBTVShow | TMDBMovie)[]>([])
  const [tvdbSearchResultsRaw, setTvdbSearchResultsRaw] = useState<TVDBSearchItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  // Get the prioritized, deduplicated list of base URLs to try.
  const tmdbBaseUrls = useMediaDatabaseBaseUrls("tmdb")
  const tvdbBaseUrls = useMediaDatabaseBaseUrls("tvdb")

  useEffect(() => {
    const db = userConfig?.primaryDatabase
    if (db === "TMDB" || db === "TVDB") setSearchDatabase(db)
  }, [userConfig?.primaryDatabase])

  useEffect(() => {
    setSearchLanguage(resolvedMediaLanguage)
  }, [resolvedMediaLanguage])

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

    const errors: string[] = []
    try {
      if (searchDatabase === "TVDB") {
        const query = searchQuery.trim()
        const type = mediaType === "tv" ? "series" : "movie"

        for (const base of tvdbBaseUrls) {
          try {
            const result: TVDBv4SearchResult[] | undefined = await searchTvdbDirect(
              { query, type },
              {
                baseUrl: base.url,
                authorizationMethod: base.authorizationMethod,
              },
            )

            if (result && result.length > 0) {
              const items = buildTvdbSearchResults(result)
              setTvdbSearchResultsRaw(items)
              return
            }
            // Empty results are not an error — keep trying the next URL
            // in case a different upstream has more matches.
          } catch (err) {
            errors.push(err instanceof Error ? err.message : String(err))
          }
        }

        // All URLs tried; either all returned empty results or all failed.
        setSearchError(
          errors.length > 0
            ? t("errors:searchFailed")
            : t("errors:searchNoResults"),
        )
        return
      }

      // TMDB: try each base URL in order, stop on first success
      for (const base of tmdbBaseUrls) {
        try {
          const response = await searchTmdbDirect(
            searchQuery.trim(),
            mediaType,
            searchLanguage,
            {
              baseUrl: base.url,
              authorizationMethod: base.authorizationMethod,
            },
          )

          if (response.error) {
            errors.push(response.error)
            continue
          }

          const results = response.results.filter(
            (item): item is TMDBTVShow | TMDBMovie =>
              mediaType === "tv" ? "name" in item : "title" in item
          )
          setSearchResults(results)

          if (results.length === 0) {
            // Empty results: try next URL.
            continue
          }
          return
        } catch (err) {
          errors.push(err instanceof Error ? err.message : String(err))
        }
      }

      // All TMDB URLs exhausted.
      setSearchResults([])
      setSearchError(
        errors.length > 0
          ? t("errors:searchFailed")
          : t("errors:searchNoResults"),
      )
    } catch (error) {
      console.error("Search failed:", error)
      const errorMessage =
        error instanceof Error ? error.message : t("errors:searchFailed")
      setSearchError(errorMessage)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [searchQuery, searchLanguage, searchDatabase, mediaType, t, tmdbBaseUrls, tvdbBaseUrls])

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
