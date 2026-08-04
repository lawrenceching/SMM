import { describe, expect, it, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"

const mockDownloadImageWithFailover = vi.fn()
vi.mock("@/api/downloadImageWithFailover", () => ({
  downloadImageWithFailover: (...args: unknown[]) => mockDownloadImageWithFailover(...args),
}))

vi.mock("@/hooks/useTmdbQueries", () => ({
  useTmdbQueries: () => ({
    getTvShowById: vi.fn().mockResolvedValue({ seasons: [{ season_number: 1 }] }),
    getTvShowSeasonDetails: vi.fn().mockResolvedValue({
      episodes: [{ episode_number: 1, still_path: "/still1.jpg" }],
    }),
  }),
}))

import { useDownloadThumbnailFromTMDB } from "./useDownloadThumbnailFromTMDB"

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
}

describe("useDownloadThumbnailFromTMDB", () => {
  beforeEach(() => {
    mockDownloadImageWithFailover.mockClear()
    mockDownloadImageWithFailover.mockResolvedValue({ data: { url: "u", path: "/p" } })
  })

  it("passes the resolved httpProxy through to downloadImageWithFailover", async () => {
    const { result } = renderHook(() => useDownloadThumbnailFromTMDB(), { wrapper: createWrapper() })
    await result.current.mutateAsync({
      seriesId: 1,
      mediaFiles: [
        { absolutePath: "/media/TV/s01e01.mkv", seasonNumber: 1, episodeNumber: 1 },
      ],
      httpProxy: "http://proxy:8080",
    })
    expect(mockDownloadImageWithFailover).toHaveBeenCalledWith(
      expect.stringContaining("/still1.jpg"),
      expect.stringContaining("s01e01"),
      { httpProxy: "http://proxy:8080" },
    )
  })
})
