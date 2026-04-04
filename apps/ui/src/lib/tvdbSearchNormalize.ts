import type { TVDBv4SearchResult } from "@smm/tvdb4"

export type TVDBSearchItem = Record<string, unknown>

function extractTvdbIdFromUnknown(v: unknown): number | undefined {
  if (typeof v === "number") {
    return Number.isFinite(v) && v > 0 ? v : undefined
  }
  if (typeof v !== "string") return undefined
  const digits = v.match(/\d+/g)?.join("")
  if (!digits) return undefined
  const parsed = parseInt(digits, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

/**
 * Normalize TVDB v4 search hits into a stable subset of fields we rely on.
 *
 * TVDB官方搜索命中通常包含类似：
 * - `objectID`: "series-421069"
 * - `id`: "series-421069" (may also be number depending on proxy shape)
 * - `tvdb_id`: "421069"
 *
 * Some fields are optional/variant across responses, so we derive them conservatively
 * to avoid breaking downstream selection logic.
 */
export function buildTvdbSearchResults(raw: TVDBv4SearchResult[]): TVDBSearchItem[] {
  return raw.map((item) => {
    const out: Record<string, unknown> = { ...(item as Record<string, unknown>) }

    const objectId = (out as { objectID?: unknown }).objectID
    const rawTvdbId = (out as { tvdb_id?: unknown }).tvdb_id
    const rawTvdbIdCamel = (out as { tvdbId?: unknown }).tvdbId

    // Ensure `id` exists (TVShowPanel relies on `result.id` being string-like).
    if (out.id == null && objectId != null) out.id = objectId
    if (out.id == null && rawTvdbId != null) out.id = rawTvdbId
    if (out.id == null && rawTvdbIdCamel != null) out.id = rawTvdbIdCamel

    // Coerce `id` to string if present to avoid runtime `.replace` errors.
    if (out.id != null && typeof out.id !== "string") out.id = String(out.id)

    // Ensure `tvdb_id` exists (MoviePanel / key generation may use it).
    const hasAnyTvdbId = rawTvdbId != null || rawTvdbIdCamel != null
    if (!hasAnyTvdbId) {
      const derived = extractTvdbIdFromUnknown(out.id ?? objectId)
      if (derived != null) {
        out.tvdb_id = derived
        out.tvdbId = derived
      }
    } else {
      // Keep both snake_case and camelCase in sync when possible.
      if (rawTvdbId != null && rawTvdbIdCamel == null) out.tvdbId = rawTvdbId
      if (rawTvdbIdCamel != null && rawTvdbId == null) out.tvdb_id = rawTvdbIdCamel
    }

    return out as TVDBSearchItem
  })
}
