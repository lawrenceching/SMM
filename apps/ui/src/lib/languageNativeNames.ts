/**
 * Native-language display names for the language search dropdown.
 *
 * Each language is displayed in its own script ("中文", "English", "日本語")
 * instead of the TMDB / TVDB API English names ("Mandarin", "Chinese - China").
 *
 * Covers ≈30 common languages in all three code formats:
 * - IETF (zh-CN, en-US, ja-JP) — used by TMDB
 * - ISO 639-1 (zh, en, ja) — pure language codes, also from TMDB
 * - ISO 639-3 (zho, eng, jpn) — used by TVDB
 *
 * Languages outside this map fall back to the API-provided English name,
 * or the raw code if no English name is available.
 */

const NATIVE_NAMES: ReadonlyArray<[string, string]> = [
  ["zh-CN", "中文"],
  ["zh", "中文"],
  ["zho", "中文"],

  ["en-US", "English"],
  ["en", "English"],
  ["eng", "English"],

  ["ja-JP", "日本語"],
  ["ja", "日本語"],
  ["jpn", "日本語"],

  ["fr-FR", "Français"],
  ["fr", "Français"],
  ["fra", "Français"],

  ["de-DE", "Deutsch"],
  ["de", "Deutsch"],
  ["deu", "Deutsch"],

  ["es-ES", "Español"],
  ["es", "Español"],
  ["spa", "Español"],

  ["pt-BR", "Português"],
  ["pt", "Português"],
  ["por", "Português"],

  ["it-IT", "Italiano"],
  ["it", "Italiano"],
  ["ita", "Italiano"],

  ["ko-KR", "한국어"],
  ["ko", "한국어"],
  ["kor", "한국어"],

  ["ru-RU", "Русский"],
  ["ru", "Русский"],
  ["rus", "Русский"],

  ["ar-SA", "العربية"],
  ["ar", "العربية"],
  ["ara", "العربية"],

  ["hi-IN", "हिन्दी"],
  ["hi", "हिन्दी"],
  ["hin", "हिन्दी"],

  ["th-TH", "ไทย"],
  ["th", "ไทย"],
  ["tha", "ไทย"],

  ["vi-VN", "Tiếng Việt"],
  ["vi", "Tiếng Việt"],
  ["vie", "Tiếng Việt"],

  ["tr-TR", "Türkçe"],
  ["tr", "Türkçe"],
  ["tur", "Türkçe"],

  ["nl-NL", "Nederlands"],
  ["nl", "Nederlands"],
  ["nld", "Nederlands"],

  ["pl-PL", "Polski"],
  ["pl", "Polski"],
  ["pol", "Polski"],

  ["sv-SE", "Svenska"],
  ["sv", "Svenska"],
  ["swe", "Svenska"],

  ["no-NO", "Norsk"],
  ["no", "Norsk"],
  ["nor", "Norsk"],

  ["da-DK", "Dansk"],
  ["da", "Dansk"],
  ["dan", "Dansk"],

  ["fi-FI", "Suomi"],
  ["fi", "Suomi"],
  ["fin", "Suomi"],

  ["cs-CZ", "Čeština"],
  ["cs", "Čeština"],
  ["ces", "Čeština"],

  ["ro-RO", "Română"],
  ["ro", "Română"],
  ["ron", "Română"],

  ["hu-HU", "Magyar"],
  ["hu", "Magyar"],
  ["hun", "Magyar"],

  ["el-GR", "Ελληνικά"],
  ["el", "Ελληνικά"],
  ["ell", "Ελληνικά"],

  ["uk-UA", "Українська"],
  ["uk", "Українська"],
  ["ukr", "Українська"],

  ["he-IL", "עברית"],
  ["he", "עברית"],
  ["heb", "עברית"],

  ["id-ID", "Bahasa Indonesia"],
  ["id", "Bahasa Indonesia"],
  ["ind", "Bahasa Indonesia"],

  ["ms-MY", "Bahasa Melayu"],
  ["ms", "Bahasa Melayu"],
  ["msa", "Bahasa Melayu"],

  ["fa-IR", "فارسی"],
  ["fa", "فارسی"],
  ["fas", "فارسی"],
]

const NATIVE_NAME_MAP = new Map<string, string>(NATIVE_NAMES)

/**
 * Resolve a human-readable display name for a language code, preferring the
 * language's own native name over the API-provided English name.
 *
 * Priority:
 * 1. Native name from the lookup map (e.g. "zh-CN" → "中文")
 * 2. `apiEnglishName` if provided (e.g. "Mandarin")
 * 3. The raw `code` (e.g. "fr-FR")
 *
 * Always includes the code in parentheses for disambiguation:
 * `"中文 (zh-CN)"`, `"English (en-US)"`, `"fr-FR"` (bare code only).
 */
export function getLanguageDisplayName(
  code: string,
  apiEnglishName?: string,
): string {
  const native = NATIVE_NAME_MAP.get(code)
  if (native) return `${native} (${code})`
  if (apiEnglishName) return `${apiEnglishName} (${code})`
  return code
}
