import { describe, expect, it, vi } from "vitest"
import type { TFunction } from "i18next"
import { localizeScrapeError } from "./scrapeError"

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

  it("falls back to the raw message for unrecognized errors", () => {
    const raw = "Some completely unknown failure mode"
    expect(localizeScrapeError(raw, t)).toBe(raw)
  })

  it("falls back to the raw message when the cause is just a non-network HTTP error", () => {
    expect(
      localizeScrapeError("HTTP error! status: 500", t),
    ).toBe("HTTP error! status: 500")
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
    // ETIMEDOUT must be a standalone token; "ETIMEDOUTED" should
    // not be misclassified as timeout. Use the literal "timed out"
    // phrase matcher instead, which is more conservative.
    expect(
      localizeScrapeError("ETIMEDOUTED during reconnect", t),
    ).toBe("ETIMEDOUTED during reconnect")
    expect(
      localizeScrapeError("subnetwork unreachable", t),
    ).toBe("subnetwork unreachable")
  })
})