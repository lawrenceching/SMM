import type { LanguageCode, PreferMediaLanguage } from './types'

const APP_LANGUAGE_FALLBACK: LanguageCode = 'en'
const MEDIA_LANGUAGE_FALLBACK: PreferMediaLanguage = 'en-US'

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
