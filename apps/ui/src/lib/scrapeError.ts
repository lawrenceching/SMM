import type { TFunction } from "i18next";

/**
 * Map a raw server-side error string to a localized message for
 * the ScrapeDialog status column. The server
 * (`packages/core-routes/src/downloadImage.ts:describeFetchError`)
 * preserves the underlying network failure cause inside the error
 * string, so we grep for known patterns here.
 *
 * If the raw message does not match any known pattern, it is
 * returned verbatim (the user still gets useful diagnostic info).
 */
export function localizeScrapeError(
  raw: string,
  t: TFunction<"dialogs">,
): string {
  const lower = raw.toLowerCase();

  // Timeout family — Node `ETIMEDOUT`, undici `UND_ERR_*_TIMEOUT`,
  // Bun `connectiontimeout`, and any literal "timed out" substring.
  // Use word boundaries so "ETIMEDOUTED" does not match `ETIMEDOUT`.
  if (
    /\betimedout\b/.test(lower) ||
    /\bund_err_(connect|headers|body)_timeout\b/.test(lower) ||
    /\bconnectiontimeout\b/.test(lower) ||
    /\btimed out\b/.test(lower)
  ) {
    return t("scrape.errors.imageUrlTimeout");
  }

  // DNS family — `ENOTFOUND` (Node), `EAI_AGAIN` (Linux getaddrinfo).
  if (/\benotfound\b/.test(lower) || /\beai_again\b/.test(lower)) {
    return t("scrape.errors.imageUrlNotFound");
  }

  // Connection refused — Node `ECONNREFUSED` or Bun `ConnectionRefused`.
  if (/\beconnrefused\b/.test(lower) || /\bconnectionrefused\b/.test(lower)) {
    return t("scrape.errors.imageUrlConnectionRefused");
  }

  // Generic network / fetch failures — covers Bun's
  // "Unable to connect..." / "Was there a typo..." messages,
  // Node's "fetch failed", and Bun's `FailedTo*` error codes
  // (e.g. `FailedToOpenSocket`).
  if (
    /\bfetch failed\b/.test(lower) ||
    /\bunable to connect\b/.test(lower) ||
    /\bwas there a typo\b/.test(lower) ||
    /\bfailedto\w+\b/.test(lower) ||
    /\beconnreset\b/.test(lower) ||
    /\bnetwork\b/.test(lower)
  ) {
    return t("scrape.errors.imageUrlNetworkFailed");
  }

  // Fallback: surface the raw message so the user still sees
  // something useful.
  return raw;
}