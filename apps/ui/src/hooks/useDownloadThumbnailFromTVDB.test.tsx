import { describe, expect, it, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"

const mockDownloadImageWithFailover = vi.fn()
vi.mock("@/api/downloadImageWithFailover", () => ({
  downloadImageWithFailover: (...args: unknown[]) => mockDownloadImageWithFailover(...args),
}))

vi.mock("@/hooks/useTvdbQueries", () => ({
  useTvdbQueries: () => ({
    getArtworkTypes: vi.fn().mockResolvedValue([{ id: 11, name: "16:9 Screencap", recordType: "series" }]),
    getSeriesExtended: vi.fn().mockResolvedValue({ seasons: [{ id: 101, number: 1 }] }),
    getSeasonExtended: vi.fn().mockResolvedValue({
      episodes: [
        { id: 1, number: 1, seasonNumber: 1, image: "https://artworks.thetvdb.com/still1.jpg", imageType: 11 },
      ],
    }),
  }),
}))

import { useDownloadThumbnailFromTVDB } from "./useDownloadThumbnailFromTVDB"

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
}

describe("useDownloadThumbnailFromTVDB", () => {
  beforeEach(() => {
    mockDownloadImageWithFailover.mockClear()
    mockDownloadImageWithFailover.mockResolvedValue({ data: { url: "u", path: "/p" } })
  })

  it("passes the resolved httpProxy through to downloadImageWithFailover", async () => {
    const { result } = renderHook(() => useDownloadThumbnailFromTVDB(), { wrapper: createWrapper() })
    await result.current.mutateAsync({
      seriesId: 1,
      mediaFiles: [
        { absolutePath: "/media/TV/s01e01.mkv", seasonNumber: 1, episodeNumber: 1 },
      ],
      httpProxy: "http://proxy:9090",
    })
    expect(mockDownloadImageWithFailover).toHaveBeenCalledWith(
      expect.stringContaining("/still1.jpg"),
      expect.stringContaining("s01e01"),
      { httpProxy: "http://proxy:9090" },
    )
  })
})
