import { useState, useCallback, useEffect, useMemo } from "react"
import { ImmersiveSearchbox } from "./ImmersiveSearchbox"
import { searchTmdb } from "@/api/tmdb"
import { useConfig } from "@/providers/config-provider"
import { useTranslation } from "@/lib/i18n"
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/i18n"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import type { TMDBTVShow, TMDBMovie } from "@core/types"

/** Map app SupportedLanguage to TMDB search API language. Exported for callers that need a default (e.g. NFO / folder-name flow). */
export function mapSearchLanguageToTmdb(lang: SupportedLanguage): TmdbSearchLanguage {
  if (lang === "zh-CN") return "zh-CN"
  if (lang === "en") return "en-US"
  return "en-US"
}

/** TMDB API language for search and get-by-id. */
export type TmdbSearchLanguage = "zh-CN" | "en-US" | "ja-JP"

interface TMDBSearchboxProps {
  mediaType: "movie" | "tv"
  value?: string
  onSearchResultSelected: (result: TMDBTVShow | TMDBMovie, searchLanguage: TmdbSearchLanguage) => void
  placeholder?: string
  inputClassName?: string
  /** Shown in a hover card when the folder is unrecognized (no valid TMDB id). */
  unrecognizedHint?: string
}

export function TMDBSearchbox({
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
  const [searchLanguage, setSearchLanguage] = useState<SupportedLanguage>(() => {
    const appLang = userConfig?.applicationLanguage
    if (appLang && validCodes.has(appLang)) return appLang as SupportedLanguage
    return "zh-CN"
  })
  const [searchQuery, setSearchQuery] = useState(value || "")
  const [searchResults, setSearchResults] = useState<(TMDBTVShow | TMDBMovie)[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

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
      setSearchError(null)
      return
    }

    setIsSearching(true)
    setSearchError(null)
    setSearchResults([])

    try {
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
  }, [searchQuery, searchLanguage, mediaType, t])

  const tvShowResults: TMDBTVShow[] = mediaType === "tv" 
    ? (searchResults as TMDBTVShow[]) 
    : []

  const handleSelect = useCallback(
    (result: TMDBTVShow | TMDBMovie) => {
      onSearchResultSelected(result, mapSearchLanguageToTmdb(searchLanguage))
    },
    [onSearchResultSelected, searchLanguage]
  )

  const searchLanguageSlot = (
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
  )

  if (mediaType === "tv") {
    return (
      <ImmersiveSearchbox
        value={searchQuery}
        onChange={setSearchQuery}
        onSearch={handleSearch}
        onSelect={handleSelect}
        searchResults={tvShowResults}
        isSearching={isSearching}
        searchError={searchError}
        placeholder={placeholder}
        inputClassName={inputClassName}
        unrecognizedHint={unrecognizedHint}
        slotBetweenInputAndList={searchLanguageSlot}
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
      slotBetweenInputAndList={searchLanguageSlot}
    />
  )
}
