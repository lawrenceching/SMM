import { beforeEach, describe, expect, it, vi } from "vitest"

const mockDoDownloadImageAsFile = vi.hoisted(() => vi.fn())
const mockCreateProxiedFetch = vi.hoisted(() => vi.fn())

vi.mock("@smm/core-routes", () => ({
  doDownloadImageAsFile: mockDoDownloadImageAsFile,
  createProxiedFetch: mockCreateProxiedFetch,
}))

vi.mock("@/utils/buildAllowlist", () => ({
  buildAllowlist: vi.fn().mockResolvedValue(["/media"]),
}))

import { processDownloadImageAsFile } from "./DownloadImageAsFile"

describe("processDownloadImageAsFile", () => {
  beforeEach(() => {
    mockDoDownloadImageAsFile.mockReset()
    mockCreateProxiedFetch.mockReset()
    mockDoDownloadImageAsFile.mockResolvedValue({ data: { url: "u", path: "p" } })
  })

  it("fetches through the configured proxy when body.httpProxy is set", async () => {
    const proxiedFetch = vi.fn()
    mockCreateProxiedFetch.mockReturnValue(proxiedFetch)

    const result = await processDownloadImageAsFile({
      url: "https://image.tmdb.org/t/p/original/x.jpg",
      path: "/media/poster.jpg",
      httpProxy: "http://proxy:8080",
    })

    expect(mockCreateProxiedFetch).toHaveBeenCalledTimes(1)
    expect(mockCreateProxiedFetch).toHaveBeenCalledWith("http://proxy:8080", expect.any(Object))
    expect(mockDoDownloadImageAsFile).toHaveBeenCalledWith(
      expect.objectContaining({ httpProxy: "http://proxy:8080" }),
      expect.objectContaining({ fetchImpl: proxiedFetch }),
    )
    expect(result).toEqual({ data: { url: "u", path: "p" } })
  })

  it("uses the global fetch when body.httpProxy is absent", async () => {
    await processDownloadImageAsFile({
      url: "https://image.tmdb.org/t/p/original/x.jpg",
      path: "/media/poster.jpg",
    })

    expect(mockCreateProxiedFetch).not.toHaveBeenCalled()
    expect(mockDoDownloadImageAsFile).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://image.tmdb.org/t/p/original/x.jpg",
        path: "/media/poster.jpg",
      }),
      expect.objectContaining({ fetchImpl: undefined }),
    )
  })

  it("ignores a blank httpProxy", async () => {
    await processDownloadImageAsFile({
      url: "https://image.tmdb.org/t/p/original/x.jpg",
      path: "/media/poster.jpg",
      httpProxy: "   ",
    })

    expect(mockCreateProxiedFetch).not.toHaveBeenCalled()
  })
})
