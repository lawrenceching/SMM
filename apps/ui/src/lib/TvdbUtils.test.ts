import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/api/tvdb", () => ({
  getTvdbSeriesById: vi.fn(),
  getTvdbSeriesSeasonById: vi.fn(),
}))

import { fetchTvdbAndBuildTvShowMediaMetadata } from "./TvdbUtils"
import { getTvdbSeriesById, getTvdbSeriesSeasonById } from "@/api/tvdb"

describe("fetchTvdbAndBuildTvShowMediaMetadata", () => {
  const mockGetTvdbSeriesById = getTvdbSeriesById as ReturnType<typeof vi.fn>
  const mockGetTvdbSeriesSeasonById = getTvdbSeriesSeasonById as ReturnType<
    typeof vi.fn
  >

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("happy flow builds TvShowMediaMetadata", async () => {
    // Parsed from `docs/tvdb/example/series_api_resp_example.json` and normalized
    // to the shape `fetchTvdbAndBuildTvShowMediaMetadata` expects.
    mockGetTvdbSeriesById.mockResolvedValue({
      status: "success",
      data: {
        seasons: [
          {
            id: 2004592,
            name: "Aired Order",
            seasonNumber: 0,
          },
        ],
      },
    } as any)

    // Parsed from `docs/tvdb/example/seasons_api_resp_example.json` (episode fields
    // already match the shape `fetchTvdbAndBuildTvShowMediaMetadata` expects).
    mockGetTvdbSeriesSeasonById.mockResolvedValue({
      status: "success",
      data: {
        episodes: [
          {
            seasonNumber: 0,
            number: 1,
            name: "振り返り特番～【推しの子】は推せるときに推せ!～",
          },
          {
            seasonNumber: 0,
            number: 2,
            name: "【推しの子】振り返り特番～【推しの子】は推せ！～Vol.2",
          },
        ],
      },
    } as any)

    const onSeasonsAPIError = vi.fn()
    const onSeriesAPIError = vi.fn()

    const result = await fetchTvdbAndBuildTvShowMediaMetadata(421069, {
      onSeasonsAPIError,
      onSeriesAPIError,
    })

    expect(mockGetTvdbSeriesById).toHaveBeenCalledWith(421069)
    expect(mockGetTvdbSeriesSeasonById).toHaveBeenCalledWith(2004592)
    expect(onSeasonsAPIError).not.toHaveBeenCalled()
    expect(onSeriesAPIError).not.toHaveBeenCalled()

    expect(result).toEqual({
      id: "421069",
      database: "TVDB",
      seasons: [
        {
          season: 0,
          name: "Aired Order",
          episodes: [
            {
              season: 0,
              episode: 1,
              name: "振り返り特番～【推しの子】は推せるときに推せ!～",
            },
            {
              season: 0,
              episode: 2,
              name: "【推しの子】振り返り特番～【推しの子】は推せ！～Vol.2",
            },
          ],
        },
      ],
    })
  })
})

