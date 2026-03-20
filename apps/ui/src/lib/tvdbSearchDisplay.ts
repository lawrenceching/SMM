import type { SupportedLanguage } from "@/lib/i18n"

/**
 * TVDB `TranslationSimple` / search hits use ISO 639-2/B 3-letter codes (`eng`, `zho`, `yue`, …).
 * Return codes in **preference order** for the UI search language.
 */
export function tvdbTranslationCodesForUiLanguage(lang: SupportedLanguage): readonly string[] {
  switch (lang) {
    case "en":
      return ["eng"]
    case "zh-CN":
      return ["zho", "cmn", "chi"]
    case "zh-HK":
      return ["yue", "zho", "cmn", "chi"]
    case "zh-TW":
      return ["zho", "cmn", "chi", "yue"]
    default:
      return ["eng"]
  }
}

function pickFromStringMap(
  map: Record<string, unknown>,
  codes: readonly string[]
): string | undefined {
  for (const c of codes) {
    const v = map[c]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return undefined
}

function asTranslationMap(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function tryParseNameTranslatedJson(s: string): Record<string, string> | null {
  const t = s.trim()
  if (!t.startsWith("{")) return null
  try {
    const o = JSON.parse(t) as unknown
    if (!o || typeof o !== "object" || Array.isArray(o)) return null
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) out[k] = v.trim()
    }
    return Object.keys(out).length ? out : null
  } catch {
    return null
  }
}

function firstStringValue(map: Record<string, string>): string | undefined {
  for (const v of Object.values(map)) {
    if (v.trim()) return v
  }
  return undefined
}

/**
 * Resolve display title for a TVDB `SearchResult` row for the given UI language.
 */
export function getTvdbSearchResultName(
  item: Record<string, unknown>,
  codes: readonly string[],
  mediaType: "tv" | "movie"
): string {
  const translations = asTranslationMap(item.translations)
  if (translations) {
    const picked = pickFromStringMap(translations, codes)
    if (picked) return picked
  }

  const nt = item.name_translated
  if (typeof nt === "string") {
    const parsed = tryParseNameTranslatedJson(nt)
    if (parsed) {
      const picked = pickFromStringMap(parsed as Record<string, unknown>, codes)
      if (picked) return picked
      const any = firstStringValue(parsed)
      if (any) return any
    } else if (nt.trim()) {
      return nt.trim()
    }
  }

  if (mediaType === "tv") {
    return String(item.name ?? item.title ?? "N/A")
  }
  return String(item.title ?? item.name ?? "N/A")
}

/**
 * Pick overview text for the selected UI language.
 */
export function getTvdbSearchResultOverview(
  item: Record<string, unknown>,
  codes: readonly string[]
): string | undefined {
  const overviews = asTranslationMap(item.overviews)
  if (overviews) {
    const picked = pickFromStringMap(overviews, codes)
    if (picked) return picked
  }

  const ot = item.overview_translated
  if (Array.isArray(ot)) {
    for (const c of codes) {
      const prefix = `${c}:`
      for (const line of ot) {
        if (typeof line !== "string") continue
        const trimmed = line.trim()
        if (trimmed.toLowerCase().startsWith(prefix.toLowerCase())) {
          return trimmed.slice(prefix.length).trim()
        }
      }
    }
    for (const line of ot) {
      if (typeof line !== "string") continue
      const idx = line.indexOf(":")
      if (idx > 0 && idx <= 5) {
        const lang = line.slice(0, idx).trim()
        if (codes.includes(lang)) return line.slice(idx + 1).trim()
      }
    }
    const first = ot.find((x) => typeof x === "string" && x.trim()) as string | undefined
    if (first) {
      const stripped = first.replace(/^[a-z]{2,3}:\s*/i, "").trim()
      if (stripped) return stripped
    }
  }

  const overview = item.overview
  return typeof overview === "string" ? overview : undefined
}

/**
 * Subtitle line: native/original title when it differs from the localized display name.
 */
export function getTvdbSearchResultAlternateName(
  item: Record<string, unknown>,
  displayName: string,
  mediaType: "tv" | "movie"
): string | undefined {
  const base = mediaType === "tv" ? item.name : item.title
  if (typeof base === "string" && base.trim() && base.trim() !== displayName.trim()) {
    return base.trim()
  }
  const other =
    mediaType === "tv"
      ? item.original_name ?? item.originalTitle
      : item.original_title ?? item.originalTitle
  if (typeof other === "string" && typeof base === "string" && other !== base) return other
  return undefined
}
