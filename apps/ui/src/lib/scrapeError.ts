import type { TFunction } from "i18next"
import { TmdbFetchError } from "@/api/tmdb"
import { HttpFailoverExhaustedError } from "@/lib/http"
import { TVDBv4Error } from "@smm/tvdb4"

export type ScrapeErrorKey =
  | "scrape.errors.imageUrlTimeout"
  | "scrape.errors.imageUrlNotFound"
  | "scrape.errors.imageUrlConnectionRefused"
  | "scrape.errors.imageUrlNetworkFailed"
  | "scrape.errors.metadataNetworkFailed"
  | "scrape.errors.tmdbUnavailable"
  | "scrape.errors.tvdbUnavailable"
  | "scrape.errors.reverseProxyUnavailable"
  | "scrape.errors.internal"
  | "scrape.errors.unknown"

export interface ScrapeTaskErrorDisplay {
  messageKey: ScrapeErrorKey
  debugDetail: string
}

const SCRAPE_ERROR_KEY_PREFIX = "scrape.errors."

function isScrapeErrorKey(value: string): value is ScrapeErrorKey {
  return value.startsWith(SCRAPE_ERROR_KEY_PREFIX)
}

function classifyScrapeErrorMessage(raw: string): ScrapeErrorKey | undefined {
  const lower = raw.toLowerCase()

  if (
    /\betimedout\b/.test(lower) ||
    /\bund_err_(connect|headers|body)_timeout\b/.test(lower) ||
    /\bconnectiontimeout\b/.test(lower) ||
    /\btimed out\b/.test(lower)
  ) {
    return "scrape.errors.imageUrlTimeout"
  }

  if (/\benotfound\b/.test(lower) || /\beai_again\b/.test(lower)) {
    return "scrape.errors.imageUrlNotFound"
  }

  if (/\beconnrefused\b/.test(lower) || /\bconnectionrefused\b/.test(lower)) {
    return "scrape.errors.imageUrlConnectionRefused"
  }

  if (
    /\bfetch failed\b/.test(lower) ||
    /\bunable to connect\b/.test(lower) ||
    /\bwas there a typo\b/.test(lower) ||
    /\bfailedto\w+\b/.test(lower) ||
    /\beconnreset\b/.test(lower) ||
    /\bnetwork\b/.test(lower) ||
    /\ball http failover attempts failed\b/.test(lower)
  ) {
    return "scrape.errors.imageUrlNetworkFailed"
  }

  if (/cannot read propert(y|ies) of (undefined|null)/i.test(raw)) {
    return "scrape.errors.internal"
  }

  return undefined
}

export function normalizeScrapeTaskError(error: unknown): ScrapeTaskErrorDisplay {
  const debugDetail = error instanceof Error ? error.message : String(error)

  if (error instanceof HttpFailoverExhaustedError) {
    return { messageKey: "scrape.errors.metadataNetworkFailed", debugDetail }
  }

  if (error instanceof TmdbFetchError) {
    return { messageKey: "scrape.errors.tmdbUnavailable", debugDetail }
  }

  if (error instanceof TVDBv4Error) {
    return { messageKey: "scrape.errors.tvdbUnavailable", debugDetail }
  }

  if (error instanceof TypeError && /cannot read propert(y|ies) of (undefined|null)/i.test(debugDetail)) {
    return { messageKey: "scrape.errors.internal", debugDetail }
  }

  if (/reverse proxy url is not available/i.test(debugDetail)) {
    return { messageKey: "scrape.errors.reverseProxyUnavailable", debugDetail }
  }

  const classified = classifyScrapeErrorMessage(debugDetail)
  if (classified) {
    return { messageKey: classified, debugDetail }
  }

  return { messageKey: "scrape.errors.unknown", debugDetail }
}

/**
 * Map a scrape task failure to a localized message for the ScrapeDialog
 * status column.
 *
 * `failedReason` may be either a normalized i18n key (`scrape.errors.*`) or a
 * legacy raw error string from older code paths.
 */
export function localizeScrapeError(
  raw: string,
  t: TFunction<"dialogs">,
): string {
  if (isScrapeErrorKey(raw)) {
    return t(raw)
  }

  const classified = classifyScrapeErrorMessage(raw)
  if (classified) {
    return t(classified)
  }

  return t("scrape.errors.unknown")
}
