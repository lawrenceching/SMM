import { describe, it, expect, beforeEach } from "vitest"
import {
  getCachedCookies,
  setCachedCookies,
  extractHostname,
  clearCookiesCache,
  type CachedCookies,
} from "./ytdlpCookiesCache"

const sampleEntry: CachedCookies = {
  cookiesText: "# HTTP Cookie File\n.example.com\tTRUE\t/\tFALSE\t0\tcookie\tvalue",
  useCookies: true,
  useCookiesFromBrowser: true,
  cookiesBrowser: "firefox",
}

describe("ytdlpCookiesCache", () => {
  beforeEach(() => {
    clearCookiesCache()
  })

  describe("setCachedCookies / getCachedCookies", () => {
    it("stores and retrieves a cache entry by hostname", () => {
      setCachedCookies("www.youtube.com", sampleEntry)
      expect(getCachedCookies("www.youtube.com")).toEqual(sampleEntry)
    })

    it("returns undefined for uncached hostname", () => {
      expect(getCachedCookies("www.example.com")).toBeUndefined()
    })

    it("does not cache entries with no cookies configured", () => {
      setCachedCookies("www.youtube.com", {
        cookiesText: "",
        useCookies: false,
        useCookiesFromBrowser: false,
        cookiesBrowser: "firefox",
      })
      expect(getCachedCookies("www.youtube.com")).toBeUndefined()
    })

    it("caches entries with only useCookiesFromBrowser enabled", () => {
      setCachedCookies("www.youtube.com", {
        cookiesText: "",
        useCookies: false,
        useCookiesFromBrowser: true,
        cookiesBrowser: "firefox",
      })
      expect(getCachedCookies("www.youtube.com")).toBeDefined()
    })

    it("overwrites existing entry for same hostname", () => {
      setCachedCookies("www.youtube.com", sampleEntry)
      const updated: CachedCookies = { ...sampleEntry, cookiesBrowser: "chrome" }
      setCachedCookies("www.youtube.com", updated)
      expect(getCachedCookies("www.youtube.com")?.cookiesBrowser).toBe("chrome")
    })
  })

  describe("extractHostname", () => {
    it("extracts hostname from a valid URL", () => {
      expect(extractHostname("https://www.youtube.com/watch?v=123")).toBe("www.youtube.com")
    })

    it("extracts hostname from a bilibili URL", () => {
      expect(extractHostname("https://www.bilibili.com/video/BV1xx")).toBe("www.bilibili.com")
    })

    it("returns null for invalid URL", () => {
      expect(extractHostname("not-a-url")).toBeNull()
    })

    it("returns null for empty string", () => {
      expect(extractHostname("")).toBeNull()
    })
  })

  describe("clearCookiesCache", () => {
    it("removes all cached entries", () => {
      setCachedCookies("www.youtube.com", sampleEntry)
      setCachedCookies("www.bilibili.com", sampleEntry)
      clearCookiesCache()
      expect(getCachedCookies("www.youtube.com")).toBeUndefined()
      expect(getCachedCookies("www.bilibili.com")).toBeUndefined()
    })
  })
})
