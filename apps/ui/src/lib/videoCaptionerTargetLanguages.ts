/**
 * Target language codes accepted by `videocaptioner translate --target-language`
 * (mirrors `_LANG_MAP` in videocaptioner/cli/commands/subtitle.py). Any other code
 * makes the CLI exit with "Unknown target language".
 */
export const VIDEOCAPTIONER_TARGET_LANGUAGES = [
  "zh-Hans",
  "zh-Hant",
  "en",
  "en-US",
  "en-GB",
  "ja",
  "ko",
  "yue",
  "th",
  "vi",
  "id",
  "ms",
  "tl",
  "fr",
  "de",
  "es",
  "es-419",
  "ru",
  "pt",
  "pt-BR",
  "pt-PT",
  "it",
  "nl",
  "pl",
  "tr",
  "el",
  "cs",
  "sv",
  "da",
  "fi",
  "nb",
  "hu",
  "ro",
  "bg",
  "uk",
  "ar",
  "he",
  "fa",
] as const

export type VideoCaptionerTargetLanguage = (typeof VIDEOCAPTIONER_TARGET_LANGUAGES)[number]

export const DEFAULT_VIDEOCAPTIONER_TARGET_LANGUAGE: VideoCaptionerTargetLanguage = "zh-Hans"

const LANGUAGE_ALIASES: Record<string, VideoCaptionerTargetLanguage> = {
  zh: "zh-Hans",
  "zh-cn": "zh-Hans",
  "zh-sg": "zh-Hans",
  "zh-tw": "zh-Hant",
  "zh-hk": "zh-Hant",
  "zh-mo": "zh-Hant",
  no: "nb",
  iw: "he",
  in: "id",
  fil: "tl",
}

/**
 * Maps a free-form code (e.g. a previously typed `zh-CN`) to a supported VideoCaptioner
 * code, falling back to the default when there is no sensible match.
 */
export function normalizeVideoCaptionerTargetLanguage(
  code: string | undefined,
): VideoCaptionerTargetLanguage {
  const lower = code?.trim().toLowerCase()
  if (!lower) return DEFAULT_VIDEOCAPTIONER_TARGET_LANGUAGE
  const exact = VIDEOCAPTIONER_TARGET_LANGUAGES.find((c) => c.toLowerCase() === lower)
  if (exact) return exact
  return LANGUAGE_ALIASES[lower] ?? DEFAULT_VIDEOCAPTIONER_TARGET_LANGUAGE
}

/** Human-readable label such as "简体中文 (zh-Hans)", localized to `displayLocale`. */
export function formatVideoCaptionerTargetLanguage(
  code: VideoCaptionerTargetLanguage,
  displayLocale: string | undefined,
): string {
  try {
    const name = new Intl.DisplayNames(displayLocale ? [displayLocale] : [], { type: "language" }).of(code)
    if (name && name !== code) return `${name} (${code})`
  } catch {
    // Intl.DisplayNames unavailable or locale invalid
  }
  return code
}
