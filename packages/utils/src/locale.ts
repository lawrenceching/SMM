import type { LanguageCode, PreferMediaLanguage } from '@smm/types'
import { TMDB_PRIMARY_TRANSLATIONS } from '@smm/types/tmdbPrimaryTranslations'

const APP_LANGUAGE_FALLBACK: LanguageCode = 'en'
const MEDIA_LANGUAGE_FALLBACK: PreferMediaLanguage = 'en-US'

/** App-config media languages (`userConfig.preferMediaLanguage`). */
export const PREFER_MEDIA_LANGUAGES = ['zh-CN', 'en-US', 'ja-JP'] as const satisfies readonly PreferMediaLanguage[]

export function isPreferMediaLanguage(value: string): value is PreferMediaLanguage {
  return (PREFER_MEDIA_LANGUAGES as readonly string[]).includes(value)
}

/**
 * Validate an explicit TMDB search language against the static snapshot of
 * {@link https://developer.themoviedb.org/reference/configuration-primary-translations GET /3/configuration/primary_translations}
 * ({@link TMDB_PRIMARY_TRANSLATIONS}). Offline — no network.
 * Returns the canonical tag from the list (preserves TMDB casing).
 */
export function parseTmdbSearchLanguage(
  raw: string,
  primaryTranslations: readonly string[] = TMDB_PRIMARY_TRANSLATIONS,
): string {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error(
      'Missing --lang value. Use a TMDB language tag such as zh-CN, en-US, or ja-JP (example: --lang zh-CN).',
    )
  }

  const lower = trimmed.toLowerCase()
  const found = primaryTranslations.find((tag) => tag.toLowerCase() === lower)
  if (found) {
    return found
  }

  const suggested = suggestTmdbSearchLanguage(lower, primaryTranslations)
  if (suggested) {
    throw new Error(
      `Unsupported language "${trimmed}". Use a TMDB language tag such as zh-CN, en-US, or ja-JP.\nDid you mean: --lang ${suggested}`,
    )
  }

  throw new Error(
    `Unsupported language "${trimmed}". Use a TMDB language tag such as zh-CN, en-US, or ja-JP (example: --lang zh-CN).`,
  )
}

/**
 * Common short / mistaken inputs → preferred TMDB primary translation.
 * Note: TMDB also has `cn-CN` (Cantonese); bare `cn` almost always means Simplified Chinese.
 */
const TMDB_LANG_ALIASES: Record<string, string> = {
  cn: 'zh-CN',
  zh: 'zh-CN',
  'zh-hans': 'zh-CN',
  'zh-hant': 'zh-TW',
  en: 'en-US',
  eng: 'en-US',
  ja: 'ja-JP',
  jp: 'ja-JP',
  jpn: 'ja-JP',
  ko: 'ko-KR',
  kr: 'ko-KR',
  kor: 'ko-KR',
  fr: 'fr-FR',
  de: 'de-DE',
  es: 'es-ES',
  pt: 'pt-BR',
  ru: 'ru-RU',
}

function suggestTmdbSearchLanguage(
  lower: string,
  primaryTranslations: readonly string[],
): string | undefined {
  const alias = TMDB_LANG_ALIASES[lower]
  if (alias && primaryTranslations.some((tag) => tag.toLowerCase() === alias.toLowerCase())) {
    return alias
  }

  // Only suggest when the input looks like a language subtag of an existing tag
  // (e.g. "fr" → "fr-FR"), not accidental prefixes of unrelated codes.
  const regionMatches = primaryTranslations.filter((tag) => {
    const [lang] = tag.toLowerCase().split('-')
    return lang === lower
  })
  if (regionMatches.length === 1) {
    return regionMatches[0]
  }
  if (regionMatches.length > 1) {
    // Prefer *-US / *-CN style commons when multiple regions exist
    const preferred =
      regionMatches.find((t) => t.endsWith('-US') || t.endsWith('-CN') || t.endsWith('-JP')) ??
      regionMatches[0]
    return preferred
  }

  return undefined
}

/** @deprecated Use {@link parseTmdbSearchLanguage} */
export const matchTmdbPrimaryTranslation = parseTmdbSearchLanguage

/**
 * Maps an arbitrary locale tag to a supported app language code.
 * Returns null when the tag cannot be mapped.
 */
export function normalizeToAppLanguage(raw: string): LanguageCode | null {
  const lng = raw.trim()
  if (!lng) return null

  const lower = lng.toLowerCase()

  if (lower.startsWith('zh')) {
    if (lower === 'zh-hk' || lower.startsWith('zh-hk')) {
      return 'zh-HK'
    }
    if (lower === 'zh-tw' || lower.startsWith('zh-tw')) {
      return 'zh-TW'
    }
    return 'zh-CN'
  }

  if (lower.startsWith('en')) {
    return 'en'
  }

  return null
}

export interface ResolveAppLanguageOptions {
  configured?: LanguageCode
  browserLocale?: string
  osLocale?: string
}

/**
 * Resolves UI language with priority:
 * 1. smm.json explicit config
 * 2. Browser locale
 * 3. OS locale
 * 4. English
 */
export function resolveAppLanguage(opts: ResolveAppLanguageOptions): LanguageCode {
  if (opts.configured) {
    return opts.configured
  }

  if (opts.browserLocale) {
    const fromBrowser = normalizeToAppLanguage(opts.browserLocale)
    if (fromBrowser) return fromBrowser
  }

  if (opts.osLocale) {
    const fromOs = normalizeToAppLanguage(opts.osLocale)
    if (fromOs) return fromOs
  }

  return APP_LANGUAGE_FALLBACK
}

export interface ResolveMediaLanguageOptions extends ResolveAppLanguageOptions {
  preferMediaLanguage?: PreferMediaLanguage
}

/**
 * Maps a resolved app language to TMDB/TVDB media language codes.
 */
export function appLanguageToMediaLanguage(lang: LanguageCode): PreferMediaLanguage {
  if (lang === 'zh-CN' || lang === 'zh-HK' || lang === 'zh-TW') {
    return 'zh-CN'
  }
  return MEDIA_LANGUAGE_FALLBACK
}

/**
 * Resolves media search/metadata language with priority:
 * 1. preferMediaLanguage (explicit smm.json config)
 * 2. Resolved app language chain (applicationLanguage → browser → OS → en)
 * 3. en-US
 */
export function resolveMediaLanguage(opts: ResolveMediaLanguageOptions): PreferMediaLanguage {
  if (opts.preferMediaLanguage) {
    return opts.preferMediaLanguage
  }

  // Japanese is not an app UI language but may appear in browser/OS locale tags
  // when applicationLanguage is not explicitly configured.
  if (!opts.configured) {
    for (const raw of [opts.browserLocale, opts.osLocale]) {
      if (raw?.trim().toLowerCase().startsWith('ja')) {
        return 'ja-JP'
      }
    }
  }

  const appLang = resolveAppLanguage(opts)
  return appLanguageToMediaLanguage(appLang)
}

/**
 * Detects the OS locale in Node/Bun environments.
 */
export function detectOsLocale(): string {
  const fromIntl = Intl.DateTimeFormat().resolvedOptions().locale
  if (fromIntl) {
    return fromIntl
  }

  const envLocale =
    process.env.LC_ALL ??
    process.env.LC_MESSAGES ??
    process.env.LANG

  if (envLocale) {
    // LANG may be "en_US.UTF-8" — take the locale portion before encoding suffix.
    return envLocale.split('.')[0]?.replace('_', '-') ?? envLocale
  }

  return ''
}

/** IETF BCP 47 media language → TVDB ISO 639-3 code (kept in @smm/core for offline resolution). */
export function mediaLanguageToTvdbCode(lang: PreferMediaLanguage): string {
  switch (lang) {
    case 'zh-CN':
      return 'zho'
    case 'ja-JP':
      return 'jpn'
    default:
      return 'eng'
  }
}

/**
 * Resolve the TVDB search/metadata language (ISO 639-3) with priority:
 * 1. preferMediaLanguage (explicit smm.json config) → mapped to ISO 639-3
 * 2. Resolved media language chain (applicationLanguage → OS → en)
 * 3. eng
 */
export function resolveTvdbSearchLanguage(opts: ResolveMediaLanguageOptions): string {
  if (opts.preferMediaLanguage) {
    return mediaLanguageToTvdbCode(opts.preferMediaLanguage)
  }
  const mediaLang = resolveMediaLanguage(opts)
  return mediaLanguageToTvdbCode(mediaLang)
}
