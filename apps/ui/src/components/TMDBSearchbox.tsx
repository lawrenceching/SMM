import { useState, useCallback, useEffect } from "react"
import { ImmersiveSearchbox } from "./ImmersiveSearchbox"
import { searchTmdb } from "@/api/tmdb"
import { useConfig } from "@/providers/config-provider"
import { useTranslation } from "@/lib/i18n"
import type { TMDBTVShow, TMDBMovie } from "@core/types"

interface TMDBSearchboxProps {
  mediaType: "movie" | "tv"
  value?: string
  onSearchResultSelected: (result: TMDBTVShow | TMDBMovie) => void
  placeholder?: string
  inputClassName?: string
}

export function TMDBSearchbox({
  mediaType,
  value,
  onSearchResultSelected,
  placeholder,
  inputClassName,
}: TMDBSearchboxProps) {
  const { t } = useTranslation(["errors"])
  const { userConfig } = useConfig()

  const [searchQuery, setSearchQuery] = useState(value || "")
  const [searchResults, setSearchResults] = useState<(TMDBTVShow | TMDBMovie)[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

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
      const language = (userConfig?.applicationLanguage || "en-US") as
        | "zh-CN"
        | "en-US"
        | "ja-JP"
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
  }, [searchQuery, userConfig, mediaType, t])

  const tvShowResults: TMDBTVShow[] = mediaType === "tv" 
    ? (searchResults as TMDBTVShow[]) 
    : []

  const handleSelect = useCallback(
    (result: TMDBTVShow | TMDBMovie) => {
      onSearchResultSelected(result)
    },
    [onSearchResultSelected]
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
    />
  )
}
