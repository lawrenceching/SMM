import { describe, it, expect, vi, beforeEach } from "vitest"
import { readFileSync } from "fs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

const {
  mockSeriesTranslationByLangCode,
  mockSeriesExtendedById,
  mockSeasonExtendedById,
  MockTVDBv4,
} = vi.hoisted(() => {
  const seriesTranslationByLangCode = vi.fn()
  const seriesExtendedById = vi.fn()
  const seasonExtendedById = vi.fn()
  class MockTVDBv4 {
    seriesTranslationByLangCode = seriesTranslationByLangCode
    seriesExtendedById = seriesExtendedById
    seasonExtendedById = seasonExtendedById
  }

  return {
    mockSeriesTranslationByLangCode: seriesTranslationByLangCode,
    mockSeriesExtendedById: seriesExtendedById,
    mockSeasonExtendedById: seasonExtendedById,
    MockTVDBv4,
  }
})

vi.mock("@smm/tvdb4", () => ({
  TVDBv4: MockTVDBv4,
}))

import { fetchTvdbAndBuildTvShowMediaMetadata } from "./TvdbUtils"

const currentDir = dirname(fileURLToPath(import.meta.url))

const loadJsonlData = (relativePath: string) => {
  const fullPath = join(currentDir, relativePath)
  const content = readFileSync(fullPath, "utf-8")
  const lines = content.trim().split("\n")
  const filteredLines = lines.filter((line: string) => line && !line.trim().startsWith("//"))
  const jsonContent = filteredLines.join("\n")
  return [JSON.parse(jsonContent)]
}

describe("fetchTvdbAndBuildTvShowMediaMetadata", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("happy flow builds TvShowMediaMetadata", async () => {
    const [translationData] = loadJsonlData("../../../../docs/tvdb/example/series_api_translations_zho_resp_example.jsonl")
    const [seriesData] = loadJsonlData("../../../../docs/tvdb/example/series_api_resp_example.jsonl")
    const [seasonData] = loadJsonlData("../../../../docs/tvdb/example/seasons_api_resp_example.jsonl")

    mockSeriesTranslationByLangCode.mockResolvedValue(translationData)
    mockSeriesExtendedById.mockResolvedValue(seriesData)
    mockSeasonExtendedById.mockImplementation((seasonId: number) => {
      if (seasonId === 2004592) {
        return Promise.resolve(seasonData)
      }
      return Promise.resolve({
        status: "success",
        data: {
          id: seasonId,
          episodes: [],
        },
      })
    })

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

    expect(mockSeriesTranslationByLangCode).toHaveBeenCalledWith(421069, "zho")
    expect(mockSeriesExtendedById).toHaveBeenCalledWith(421069)
    expect(mockSeasonExtendedById).toHaveBeenCalledWith(2004592)
    expect(onSeasonsAPIError).not.toHaveBeenCalled()
    expect(onSeriesAPIError).not.toHaveBeenCalled()

    expect(result).toEqual({
      id: "421069",
      name: "【我推的孩子】",
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
              name: "【推しの子】振り返り特番～【推しの子】は推せるときに推せ！～Vol.2",
            },
          ],
        },
        {
          season: 1,
          name: "",
          episodes: [],
        },
        {
          season: 2,
          name: "",
          episodes: [],
        },
        {
          season: 3,
          name: "",
          episodes: [],
        },
      ],
    })
  })
})
