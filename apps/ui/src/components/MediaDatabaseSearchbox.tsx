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
  tvdbTranslationCodeForSearchLanguage,
} from "@/lib/tvdbSearchDisplay"
import { buildTvdbSearchResults, type TVDBSearchItem } from "@/lib/tvdbSearchNormalize"
import { searchTvdbDirect } from "@/lib/TvdbDirectSearch"
import { useMediaDatabaseBaseUrls } from "@/hooks/useMediaDatabaseBaseUrls"
import {
  useTmdbSearchLanguageOptions,
  TMDB_PRIORITY_LANGUAGE_CODES,
  type TmdbSearchLanguageOption,
} from "@/hooks/useTmdbLanguages"
import {
  useTvdbSearchLanguageOptions,
  TVDB_PRIORITY_LANGUAGE_CODES,
  type TvdbSearchLanguageOption,
} from "@/hooks/useTvdbLanguages"
import localStorages from "@/lib/localStorages"
import {
  preferMediaLanguageToTvdbCode,
  type TmdbSearchLanguage,
  type TvdbSearchLanguage,
  DEFAULT_TMDB_SEARCH_LANGUAGE,
  DEFAULT_TVDB_SEARCH_LANGUAGE,
} from "@/lib/searchLanguage"

/**
 * The current search language. Format depends on `database`:
 * - TMDB → IETF tag (e.g. "zh-CN", "en-US", "fr-FR")
 * - TVDB → ISO 639-3 code (e.g. "eng", "zho", "fra")
 */
export type SearchLanguage = string

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
  | { database: "TMDB"; result: TMDBTVShow | TMDBMovie; searchLanguage: SearchLanguage }
  | { database: "TVDB"; result: TVDBSearchItem; searchLanguage: SearchLanguage }

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
  const [searchLanguage, setSearchLanguage] = useState<SearchLanguage>(() => {
    const initialDb = (userConfig?.primaryDatabase || "TMDB") as PrimaryDatabase
    return resolveInitialSearchLanguage(initialDb, resolvedMediaLanguage)
  })
  const [searchQuery, setSearchQuery] = useState(value || "")
  const [searchResults, setSearchResults] = useState<(TMDBTVShow | TMDBMovie)[]>([])
  const [tvdbSearchResultsRaw, setTvdbSearchResultsRaw] = useState<TVDBSearchItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false)
  const [showAllLanguages, setShowAllLanguages] = useState(false)

  // Get the prioritized, deduplicated list of base URLs to try.
  const tmdbBaseUrls = useMediaDatabaseBaseUrls("tmdb")
  const tvdbBaseUrls = useMediaDatabaseBaseUrls("tvdb")

  // Fetch the full language lists for both databases.
  const tmdbLanguageOptions = useTmdbSearchLanguageOptions()
  const tvdbLanguageOptions = useTvdbSearchLanguageOptions()

  // The dropdown content (priority subset + show all) and current value depend
  // on the active database.
  const activeLanguageOptions = useMemo<
    | ReadonlyArray<TmdbSearchLanguageOption | TvdbSearchLanguageOption>
    | undefined
  >(() => {
    if (searchDatabase === "TMDB") return tmdbLanguageOptions.data
    return tvdbLanguageOptions.data
  }, [searchDatabase, tmdbLanguageOptions.data, tvdbLanguageOptions.data])

  const displayedLanguageOptions = useMemo<
    ReadonlyArray<TmdbSearchLanguageOption | TvdbSearchLanguageOption>
  >(() => {
    const priority =
      searchDatabase === "TMDB"
        ? (TMDB_PRIORITY_LANGUAGE_CODES as readonly string[])
        : (TVDB_PRIORITY_LANGUAGE_CODES as readonly string[])
    const prioritySet = new Set(priority)

    // Build the priority list from known codes. When `activeLanguageOptions` is
    // still loading (`undefined`), we fall back to `{ code, name: code }` so that
    // `SelectItem`s are rendered immediately — this ensures `<SelectValue />` (bare)
    // can always find a matching item via Radix's item-text lookup.
    const priorityList: Array<TmdbSearchLanguageOption | TvdbSearchLanguageOption> = []
    for (const code of priority) {
      const found = activeLanguageOptions?.find((o) => o.code === code)
      if (found) priorityList.push(found)
      else priorityList.push({ code, name: code })
    }

    // Also include the currently selected language if it is NOT in the priority
    // set (e.g. it was previously saved to localStorage as a non-priority
    // language such as "fr-FR"). Without this, `<SelectValue />` would find no
    // matching item and display empty.
    // When the API data is available, use the API entry so the proper name
    // (e.g. "French (fr-FR)") is shown instead of the fallback code-as-name.
    const selectedNotInPriority = prioritySet.has(searchLanguage)
      ? undefined
      : (activeLanguageOptions?.find((o) => o.code === searchLanguage) ?? {
          code: searchLanguage,
          name: searchLanguage,
        })

    if (!showAllLanguages) {
      // Collapsed: 3 priority items + the selected non-priority item (if any).
      return selectedNotInPriority
        ? [...priorityList, selectedNotInPriority]
        : priorityList
    }

    // Expanded: keep the 3 default languages pinned at the top, then
    // append the rest of the languages. When `activeLanguageOptions` is still
    // loading, `rest` is empty (the fallback item is prepended below).
    const rest = activeLanguageOptions
      ? activeLanguageOptions.filter((o) => !prioritySet.has(o.code))
      : []

    // Only prepend the fallback item when data is still loading (the API has no
    // entry for this language yet, so we use the code-as-name placeholder).
    // When the API has the entry, `rest` already contains it with the proper name,
    // and no duplicate is prepended.
    return selectedNotInPriority && !activeLanguageOptions
      ? [...priorityList, selectedNotInPriority, ...rest]
      : [...priorityList, ...rest]
  }, [activeLanguageOptions, searchDatabase, showAllLanguages, searchLanguage])

  // Sync `searchDatabase` with `userConfig.primaryDatabase` changes.
  useEffect(() => {
    const db = userConfig?.primaryDatabase
    if (db === "TMDB" || db === "TVDB") setSearchDatabase(db)
  }, [userConfig?.primaryDatabase])

  // When `searchDatabase` changes (via user toggle or via userConfig), reload
  // the search language from the right source: localStorage → userConfig → default.
  useEffect(() => {
    setSearchLanguage(resolveInitialSearchLanguage(searchDatabase, resolvedMediaLanguage))
    setShowAllLanguages(false)
    // Only react to changes in `searchDatabase` or `resolvedMediaLanguage`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDatabase, resolvedMediaLanguage])

  useEffect(() => {
    setSearchQuery(value || "")
  }, [value])

  const handleSearchLanguageChange = useCallback((next: string) => {
    // Defensive filter: the dropdown's "show all / show fewer" toggle is now
    // a non-`SelectItem` element, so this branch should not be reachable in
    // practice. We keep the guard to make sure a stale sentinel value from
    // an older build can never be persisted to localStorage or used as the
    // active search language.
    if (next === "__show_all_languages__" || next === "__show_fewer_languages__") {
      return
    }
    if (searchDatabase === "TMDB") {
      localStorages.lastSelectedTmdbLanguage = next
    } else {
      localStorages.lastSelectedTvdbLanguage = next
    }
    setSearchLanguage(next)
  }, [searchDatabase])

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
              { query, type, language: searchLanguage },
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
      const tvdbCodes = tvdbTranslationCodeForSearchLanguage(searchLanguage as TvdbSearchLanguage)
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
      onSearchLanguageChange={handleSearchLanguageChange}
      searchLanguageOptions={displayedLanguageOptions}
      showAllLanguages={showAllLanguages}
      onShowAllLanguagesChange={setShowAllLanguages}
      onSearchboxOpenChange={setIsLanguageDropdownOpen}
      isSearchboxOpen={isLanguageDropdownOpen}
    />
  )
}

/**
 * Resolve the initial search language for the given database.
 * Priority: localStorage → userConfig.preferMediaLanguage → default.
 */
function resolveInitialSearchLanguage(
  database: PrimaryDatabase,
  resolvedMediaLanguage: PreferMediaLanguage,
): SearchLanguage {
  if (database === "TMDB") {
    const stored = localStorages.lastSelectedTmdbLanguage
    if (stored) return stored as TmdbSearchLanguage
    return resolvedMediaLanguage
  }
  const stored = localStorages.lastSelectedTvdbLanguage
  if (stored) return stored as TvdbSearchLanguage
  return preferMediaLanguageToTvdbCode(resolvedMediaLanguage) || DEFAULT_TVDB_SEARCH_LANGUAGE
}

export { DEFAULT_TMDB_SEARCH_LANGUAGE, DEFAULT_TVDB_SEARCH_LANGUAGE }
