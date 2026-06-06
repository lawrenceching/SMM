import type { PreferMediaLanguage } from "@core/types"

/**
 * TMDB search language: an IETF BCP 47 tag, e.g. "zh-CN", "en-US", "fr-FR".
 * Returned by TMDB's `/3/configuration/primary_translations` endpoint.
 */
export type TmdbSearchLanguage = string

/**
 * TVDB search language: an ISO 639-3 code, e.g. "eng", "zho", "jpn".
 * Returned by TVDB's `/v4/languages` endpoint.
 */
export type TvdbSearchLanguage = string

/**
 * Map the user's `preferMediaLanguage` setting (IETF tag, used for
 * folder recognition and as a fallback) to TVDB's ISO 639-3 code.
 *
 * TVDB only exposes a coarse language code (no region), so the IETF region
 * is intentionally dropped.
 */
export function preferMediaLanguageToTvdbCode(
  lang: PreferMediaLanguage,
): TvdbSearchLanguage {
  switch (lang) {
    case "zh-CN":
      return "zho"
    case "en-US":
      return "eng"
    case "ja-JP":
      return "jpn"
  }
}

/**
 * Default TMDB search language when no preference is available.
 */
export const DEFAULT_TMDB_SEARCH_LANGUAGE: TmdbSearchLanguage = "en-US"

/**
 * Default TVDB search language when no preference is available.
 */
export const DEFAULT_TVDB_SEARCH_LANGUAGE: TvdbSearchLanguage = "eng"
