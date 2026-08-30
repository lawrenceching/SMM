import { describe, expect, it, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"
import type { MediaMetadata, UserConfig } from "@smm/types"
import { defaultUserConfig } from "@/api/readUserConfig"

const mockTmdbMutateAsync = vi.fn().mockResolvedValue(undefined)
const mockTvdbMutateAsync = vi.fn().mockResolvedValue(undefined)

vi.mock("./useDownloadThumbnailFromTMDB", () => ({
  useDownloadThumbnailFromTMDB: () => ({ mutateAsync: mockTmdbMutateAsync }),
}))
vi.mock("./useDownloadThumbnailFromTVDB", () => ({
  useDownloadThumbnailFromTVDB: () => ({ mutateAsync: mockTvdbMutateAsync }),
}))

let useConfigValue: UserConfig = defaultUserConfig
vi.mock("./userConfig", () => ({
  useConfig: () => ({ appConfig: {}, userConfig: useConfigValue }),
}))

import { useScrapeThumbnailMutation } from "./useScrapeThumbnailMutation"

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
}

const tvShowMetadata: MediaMetadata = {
  type: "tvshow-folder",
  mediaFolderPath: "/media/TV",
  tvShow: { id: "123", database: "TMDB", name: "TV", seasons: [] },
  mediaFiles: [{ absolutePath: "/media/TV/s01e01.mkv", seasonNumber: 1, episodeNumber: 1 }],
} as MediaMetadata

describe("useScrapeThumbnailMutation", () => {
  beforeEach(() => {
    mockTmdbMutateAsync.mockClear()
    mockTvdbMutateAsync.mockClear()
    useConfigValue = {
      ...defaultUserConfig,
      tmdb: { host: "https://api.themoviedb.org", apiKey: "", httpProxy: "http://proxy:8080" },
    }
  })

  it("passes the resolved proxy to the TMDB thumbnail downloader", async () => {
    const { result } = renderHook(() => useScrapeThumbnailMutation(), { wrapper: createWrapper() })
    await result.current.mutateAsync({ mediaMetadata: tvShowMetadata })
    expect(mockTmdbMutateAsync).toHaveBeenCalledWith({
      seriesId: 123,
      mediaFiles: tvShowMetadata.mediaFiles,
      httpProxy: "http://proxy:8080",
    })
  })

  it("passes no proxy when none is configured", async () => {
    useConfigValue = { ...defaultUserConfig, tmdb: { host: "", apiKey: "", httpProxy: "" } }
    const { result } = renderHook(() => useScrapeThumbnailMutation(), { wrapper: createWrapper() })
    await result.current.mutateAsync({ mediaMetadata: tvShowMetadata })
    expect(mockTmdbMutateAsync).toHaveBeenCalledWith({
      seriesId: 123,
      mediaFiles: tvShowMetadata.mediaFiles,
      httpProxy: undefined,
    })
  })

  it("passes the resolved proxy to the TVDB thumbnail downloader", async () => {
    useConfigValue = {
      ...defaultUserConfig,
      tvdb: { host: "https://api4.thetvdb.com", apiKey: "", httpProxy: "http://proxy:9090" },
    }
    const tvdbMetadata: MediaMetadata = {
      type: "tvshow-folder",
      mediaFolderPath: "/media/TV",
      tvShow: { id: "321", database: "TVDB", name: "TV", seasons: [] },
      mediaFiles: [{ absolutePath: "/media/TV/s01e01.mkv", seasonNumber: 1, episodeNumber: 1 }],
    } as MediaMetadata
    const { result } = renderHook(() => useScrapeThumbnailMutation(), { wrapper: createWrapper() })
    await result.current.mutateAsync({ mediaMetadata: tvdbMetadata })
    expect(mockTvdbMutateAsync).toHaveBeenCalledWith({
      seriesId: 321,
      mediaFiles: tvdbMetadata.mediaFiles,
      httpProxy: "http://proxy:9090",
    })
  })
})
