import { describe, expect, it, vi } from "vitest"
import { ExistedFileError, existedFileError } from "@core/errors"
import type { DiscoverConfig } from "./discover"
import type { DownloadImageResponseBody } from "@core/types"

const config: DiscoverConfig = {
  mediaDatabases: [
    { type: "tmdb-asset", url: "https://tmdb-mirror.example", authorizationMethod: "none" },
  ],
  reverseProxies: [],
}

describe("downloadImageWithFailover", () => {
  it("returns first success without trying later candidates", async () => {
    const downloadImageApi = vi
      .fn<(url: string, path: string) => Promise<DownloadImageResponseBody>>()
      .mockResolvedValueOnce({ data: { url: "ok", path: "/p" } })

    const { downloadImageWithFailover } = await import("./downloadImageWithFailover")
    const result = await downloadImageWithFailover(
      "https://image.tmdb.org/t/p/original/a.jpg",
      "/media/poster.jpg",
      {
        fetchDiscoverConfig: async () => config,
        downloadImageApi,
      },
    )

    expect(result).toEqual({ data: { url: "ok", path: "/p" } })
    expect(downloadImageApi).toHaveBeenCalledTimes(1)
    expect(downloadImageApi).toHaveBeenCalledWith(
      "https://image.tmdb.org/t/p/original/a.jpg",
      "/media/poster.jpg",
      undefined,
    )
  })

  it("fails over to mirror when official returns an error", async () => {
    const downloadImageApi = vi
      .fn<(url: string, path: string) => Promise<DownloadImageResponseBody>>()
      .mockResolvedValueOnce({
        data: { url: "a", path: "/p" },
        error: "HTTP error! status: 503",
      })
      .mockResolvedValueOnce({ data: { url: "b", path: "/p" } })

    const { downloadImageWithFailover } = await import("./downloadImageWithFailover")
    const result = await downloadImageWithFailover(
      "https://image.tmdb.org/t/p/original/a.jpg",
      "/media/poster.jpg",
      {
        fetchDiscoverConfig: async () => config,
        downloadImageApi,
      },
    )

    expect(result.error).toBeUndefined()
    expect(downloadImageApi).toHaveBeenCalledTimes(2)
    expect(downloadImageApi).toHaveBeenNthCalledWith(
      2,
      "https://tmdb-mirror.example/t/p/original/a.jpg",
      "/media/poster.jpg",
      undefined,
    )
  })

  it("stops on ExistedFileError without trying mirrors", async () => {
    const downloadImageApi = vi
      .fn<(url: string, path: string) => Promise<DownloadImageResponseBody>>()
      .mockResolvedValueOnce({
        data: { url: "a", path: "/p" },
        error: existedFileError("/p"),
      })

    const { downloadImageWithFailover } = await import("./downloadImageWithFailover")
    const result = await downloadImageWithFailover(
      "https://image.tmdb.org/t/p/original/a.jpg",
      "/media/poster.jpg",
      {
        fetchDiscoverConfig: async () => config,
        downloadImageApi,
      },
    )

    expect(result.error?.startsWith(`${ExistedFileError}:`)).toBe(true)
    expect(downloadImageApi).toHaveBeenCalledTimes(1)
  })

  it("still downloads from original URL when fetchDiscoverConfig rejects", async () => {
    const downloadImageApi = vi
      .fn<(url: string, path: string) => Promise<DownloadImageResponseBody>>()
      .mockResolvedValueOnce({ data: { url: "ok", path: "/p" } })

    const { downloadImageWithFailover } = await import("./downloadImageWithFailover")
    const result = await downloadImageWithFailover(
      "https://image.tmdb.org/t/p/original/a.jpg",
      "/media/poster.jpg",
      {
        fetchDiscoverConfig: async () => {
          throw new Error("Discover request failed: 500 Internal Server Error")
        },
        downloadImageApi,
      },
    )

    expect(result).toEqual({ data: { url: "ok", path: "/p" } })
    expect(downloadImageApi).toHaveBeenCalledTimes(1)
    expect(downloadImageApi).toHaveBeenCalledWith(
      "https://image.tmdb.org/t/p/original/a.jpg",
      "/media/poster.jpg",
      undefined,
    )
  })

  it("returns last error when all candidates fail", async () => {
    const downloadImageApi = vi
      .fn<(url: string, path: string) => Promise<DownloadImageResponseBody>>()
      .mockResolvedValue({
        data: { url: "a", path: "/p" },
        error: "HTTP error! status: 500",
      })

    const { downloadImageWithFailover } = await import("./downloadImageWithFailover")
    const result = await downloadImageWithFailover(
      "https://image.tmdb.org/t/p/original/a.jpg",
      "/media/poster.jpg",
      {
        fetchDiscoverConfig: async () => config,
        downloadImageApi,
      },
    )

    expect(result.error).toBe("HTTP error! status: 500")
    expect(downloadImageApi).toHaveBeenCalledTimes(2)
  })

  it("passes httpProxy to downloadImageApi for every candidate", async () => {
    const downloadImageApi = vi
      .fn<(url: string, path: string, httpProxy?: string) => Promise<DownloadImageResponseBody>>()
      .mockResolvedValueOnce({
        data: { url: "a", path: "/p" },
        error: "HTTP error! status: 503",
      })
      .mockResolvedValue({ data: { url: "b", path: "/p" } })

    const { downloadImageWithFailover } = await import("./downloadImageWithFailover")
    const result = await downloadImageWithFailover(
      "https://image.tmdb.org/t/p/original/a.jpg",
      "/media/poster.jpg",
      {
        fetchDiscoverConfig: async () => config,
        downloadImageApi,
        httpProxy: "http://proxy:8080",
      },
    )

    expect(result.error).toBeUndefined()
    expect(downloadImageApi).toHaveBeenNthCalledWith(
      1,
      "https://image.tmdb.org/t/p/original/a.jpg",
      "/media/poster.jpg",
      "http://proxy:8080",
    )
    expect(downloadImageApi).toHaveBeenNthCalledWith(
      2,
      "https://tmdb-mirror.example/t/p/original/a.jpg",
      "/media/poster.jpg",
      "http://proxy:8080",
    )
  })
})
