import { describe, expect, it } from "vitest"
import type { TFunction } from "i18next"
import { TmdbFetchError } from "@/api/tmdb"
import { HttpFailoverExhaustedError } from "@/lib/http"
import { localizeScrapeError, normalizeScrapeTaskError } from "./scrapeError"
import { TVDBv4Error } from "@smm/tvdb4"

function makeT(): TFunction<"dialogs"> {
  // Minimal mock of i18next's TFunction: returns the key itself so
  // tests can assert which i18n key was selected without needing
  // the full i18n bootstrap.
  return ((key: string) => key) as unknown as TFunction<"dialogs">
}

describe("localizeScrapeError", () => {
  const t = makeT()

  it("maps ETIMEDOUT to the timeout key", () => {
    expect(
      localizeScrapeError(
        "Failed to download image: fetch failed (ETIMEDOUT: connect ETIMEDOUT)",
        t,
      ),
    ).toBe("scrape.errors.imageUrlTimeout")
  })

  it("maps undici UND_ERR_*_TIMEOUT codes to the timeout key", () => {
    expect(
      localizeScrapeError(
        "Image URL fetch failed: fetch failed (UND_ERR_CONNECT_TIMEOUT)",
        t,
      ),
    ).toBe("scrape.errors.imageUrlTimeout")
    expect(
      localizeScrapeError(
        "fetch failed (UND_ERR_HEADERS_TIMEOUT)",
        t,
      ),
    ).toBe("scrape.errors.imageUrlTimeout")
    expect(
      localizeScrapeError(
        "fetch failed (UND_ERR_BODY_TIMEOUT)",
        t,
      ),
    ).toBe("scrape.errors.imageUrlTimeout")
  })

  it("maps a literal 'timed out' phrase to the timeout key", () => {
    expect(
      localizeScrapeError("Request timed out while downloading", t),
    ).toBe("scrape.errors.imageUrlTimeout")
  })

  it("maps ENOTFOUND to the DNS-not-found key", () => {
    expect(
      localizeScrapeError(
        "fetch failed (ENOTFOUND: getaddrinfo ENOTFOUND image.tmdb.org)",
        t,
      ),
    ).toBe("scrape.errors.imageUrlNotFound")
  })

  it("maps EAI_AGAIN to the DNS-not-found key", () => {
    expect(
      localizeScrapeError("fetch failed (EAI_AGAIN)", t),
    ).toBe("scrape.errors.imageUrlNotFound")
  })

  it("maps ECONNREFUSED to the connection-refused key", () => {
    expect(
      localizeScrapeError(
        "fetch failed (ECONNREFUSED: connect ECONNREFUSED)",
        t,
      ),
    ).toBe("scrape.errors.imageUrlConnectionRefused")
  })

  it("maps a generic fetch-failed to the network-failed key", () => {
    expect(
      localizeScrapeError("fetch failed", t),
    ).toBe("scrape.errors.imageUrlNetworkFailed")
  })

  it("maps ECONNRESET to the network-failed key", () => {
    expect(
      localizeScrapeError("fetch failed (ECONNRESET)", t),
    ).toBe("scrape.errors.imageUrlNetworkFailed")
  })

  it("maps a network-related phrase to the network-failed key", () => {
    expect(
      localizeScrapeError("Network error while fetching", t),
    ).toBe("scrape.errors.imageUrlNetworkFailed")
  })

  it("passes through normalized i18n keys", () => {
    expect(
      localizeScrapeError("scrape.errors.tvdbUnavailable", t),
    ).toBe("scrape.errors.tvdbUnavailable")
  })

  it("maps internal TypeError messages to the internal key", () => {
    expect(
      localizeScrapeError(
        "Cannot read properties of undefined (reading 'status')",
        t,
      ),
    ).toBe("scrape.errors.internal")
  })

  it("falls back to the unknown key for unrecognized errors", () => {
    expect(
      localizeScrapeError("Some completely unknown failure mode", t),
    ).toBe("scrape.errors.unknown")
  })

  it("falls back to the unknown key when the cause is just a non-network HTTP error", () => {
    expect(
      localizeScrapeError("HTTP error! status: 500", t),
    ).toBe("scrape.errors.unknown")
  })

  it("is case-insensitive", () => {
    expect(
      localizeScrapeError("fetch failed (etimedout)", t),
    ).toBe("scrape.errors.imageUrlTimeout")
  })

  it("recognizes Bun's ConnectionTimeout error code", () => {
    expect(
      localizeScrapeError(
        "Unable to connect. Is the computer able to access the url? (ConnectionTimeout)",
        t,
      ),
    ).toBe("scrape.errors.imageUrlTimeout")
  })

  it("recognizes Bun's ConnectionRefused error code", () => {
    expect(
      localizeScrapeError(
        "Unable to connect. Is the computer able to access the url? (ConnectionRefused)",
        t,
      ),
    ).toBe("scrape.errors.imageUrlConnectionRefused")
  })

  it("recognizes Bun's 'Unable to connect' message as a network failure", () => {
    expect(
      localizeScrapeError(
        "Unable to connect. Is the computer able to access the url?",
        t,
      ),
    ).toBe("scrape.errors.imageUrlNetworkFailed")
  })

  it("recognizes Bun's 'Was there a typo' message as a network failure", () => {
    expect(
      localizeScrapeError(
        "Failed to download image: Was there a typo in the url or port? (FailedToOpenSocket)",
        t,
      ),
    ).toBe("scrape.errors.imageUrlNetworkFailed")
  })

  it("recognizes Bun's FailedTo* error code naming convention", () => {
    expect(
      localizeScrapeError(
        "Failed to download image: Something happened (FailedToResolveHostname)",
        t,
      ),
    ).toBe("scrape.errors.imageUrlNetworkFailed")
  })

  it("does not match partial substrings like 'ETIMEDOUTED' or 'subnetwork'", () => {
    expect(
      localizeScrapeError("ETIMEDOUTED during reconnect", t),
    ).toBe("scrape.errors.unknown")
    expect(
      localizeScrapeError("subnetwork unreachable", t),
    ).toBe("scrape.errors.unknown")
  })
})

describe("normalizeScrapeTaskError", () => {
  it("maps HttpFailoverExhaustedError to metadataNetworkFailed", () => {
    const error = new HttpFailoverExhaustedError(["https://example.com"])
    expect(normalizeScrapeTaskError(error)).toEqual({
      messageKey: "scrape.errors.metadataNetworkFailed",
      debugDetail: "All HTTP failover attempts failed",
    })
  })

  it("maps TmdbFetchError to tmdbUnavailable", () => {
    const error = new TmdbFetchError({
      kind: "no-response",
      statusCode: 0,
      statusText: "",
      responseBodyText: "",
      problemDetail: "",
    })
    expect(normalizeScrapeTaskError(error)).toEqual({
      messageKey: "scrape.errors.tmdbUnavailable",
      debugDetail: "Failed to search TMDB: all attempts failed",
    })
  })

  it("maps TVDBv4Error to tvdbUnavailable", () => {
    const error = new TVDBv4Error("TVDB request failed: 503 unavailable", {
      url: "https://example.com/artwork/types",
      status: 503,
    })
    expect(normalizeScrapeTaskError(error)).toEqual({
      messageKey: "scrape.errors.tvdbUnavailable",
      debugDetail: "TVDB request failed: 503 unavailable",
    })
  })

  it("maps internal TypeError messages to internal", () => {
    const error = new TypeError("Cannot read properties of undefined (reading 'status')")
    expect(normalizeScrapeTaskError(error)).toEqual({
      messageKey: "scrape.errors.internal",
      debugDetail: "Cannot read properties of undefined (reading 'status')",
    })
  })

  it("maps reverse proxy availability errors", () => {
    const error = new Error(
      "Reverse proxy URL is not available. Ensure the CLI started successfully and the hello task has completed.",
    )
    expect(normalizeScrapeTaskError(error)).toEqual({
      messageKey: "scrape.errors.reverseProxyUnavailable",
      debugDetail: error.message,
    })
  })

  it("maps legacy network strings to imageUrlNetworkFailed", () => {
    expect(normalizeScrapeTaskError(new Error("fetch failed"))).toEqual({
      messageKey: "scrape.errors.imageUrlNetworkFailed",
      debugDetail: "fetch failed",
    })
  })

  it("falls back to unknown for unrecognized errors", () => {
    expect(normalizeScrapeTaskError(new Error("HTTP error! status: 500"))).toEqual({
      messageKey: "scrape.errors.unknown",
      debugDetail: "HTTP error! status: 500",
    })
  })
})
