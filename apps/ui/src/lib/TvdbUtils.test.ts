import { describe, it, expect, vi, beforeEach } from "vitest"

const {
  mockSeriesExtendedById,
  mockSeasonExtendedById,
  MockTVDBv4,
} = vi.hoisted(() => {
  const seriesExtendedById = vi.fn()
  const seasonExtendedById = vi.fn()
  class MockTVDBv4 {
    seriesExtendedById = seriesExtendedById
    seasonExtendedById = seasonExtendedById
  }

  return {
    mockSeriesExtendedById: seriesExtendedById,
    mockSeasonExtendedById: seasonExtendedById,
    MockTVDBv4,
  }
})

vi.mock("@smm/tvdb4", () => ({
  TVDBv4: MockTVDBv4,
}))

import { fetchTvdbAndBuildTvShowMediaMetadata } from "./TvdbUtils"

describe("fetchTvdbAndBuildTvShowMediaMetadata", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("happy flow builds TvShowMediaMetadata", async () => {
    mockSeriesExtendedById.mockResolvedValue({
      status: "success",
      data: {
        name: "Oshi no Ko",
        nameTranslations: [],
        seasons: [
          {
            id: 2004592,
            number: 0,
            type: {
              name: "Aired Order",
            },
          },
        ],
      },
    } as any)

    mockSeasonExtendedById.mockResolvedValue({
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

    const result = await fetchTvdbAndBuildTvShowMediaMetadata(
      421069,
      "zh-CN",
      {
        onSeasonsAPIError,
        onSeriesAPIError,
      }
    )

    expect(mockSeriesExtendedById).toHaveBeenCalledWith(421069)
    expect(mockSeasonExtendedById).toHaveBeenCalledWith(2004592)
    expect(onSeasonsAPIError).not.toHaveBeenCalled()
    expect(onSeriesAPIError).not.toHaveBeenCalled()

    expect(result).toEqual({
      id: "421069",
      name: "Oshi no Ko",
      database: "TVDB",
      seasons: [
        {
          season: 0,
          name: "",
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

