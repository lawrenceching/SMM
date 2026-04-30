import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { readFileSync } from "fs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

const {
  mockMovieTranslationByLangCode,
  mockMovieExtendedById,
  mockSeriesTranslationByLangCode,
  mockSeriesExtendedById,
  mockSeasonExtendedById,
  MockTVDBv4,
  mockTvdbConstructor,
} = vi.hoisted(() => {
  const movieTranslationByLangCode = vi.fn()
  const movieExtendedById = vi.fn()
  const seriesTranslationByLangCode = vi.fn()
  const seriesExtendedById = vi.fn()
  const seasonExtendedById = vi.fn()
  const episodeTranslationByLangCode = vi.fn().mockResolvedValue({
    status: "failure" as const,
    message: "not used in this test file",
  })
  const constructorSpy = vi.fn()
  class MockTVDBv4 {
    constructor(options: unknown) {
      constructorSpy(options)
    }
    movieTranslationByLangCode = movieTranslationByLangCode
    movieExtendedById = movieExtendedById
    seriesTranslationByLangCode = seriesTranslationByLangCode
    seriesExtendedById = seriesExtendedById
    seasonExtendedById = seasonExtendedById
    episodeTranslationByLangCode = episodeTranslationByLangCode
  }

  return {
    mockMovieTranslationByLangCode: movieTranslationByLangCode,
    mockMovieExtendedById: movieExtendedById,
    mockSeriesTranslationByLangCode: seriesTranslationByLangCode,
    mockSeriesExtendedById: seriesExtendedById,
    mockSeasonExtendedById: seasonExtendedById,
    MockTVDBv4,
    mockTvdbConstructor: constructorSpy,
  }
})

vi.mock("@smm/tvdb4", () => ({
  TVDBv4: MockTVDBv4,
}))

import {
  fetchTvdbAndBuildMovieMediaMetadata,
  fetchTvdbAndBuildTvShowMediaMetadata,
  getTVDBv4Client,
  _resetTvdbClientCacheForTesting,
} from "./TvdbUtils"

const REVERSE_PROXY_URL = "http://127.0.0.1:30005"
const SMM_TVDB_DEFAULT_UPSTREAM = "https://tmdb-mcp-server.imlc.me/api/tvdb"
const TVDB_DIRECT_UPSTREAM = "https://api4.thetvdb.com/v4"

beforeEach(() => {
  vi.clearAllMocks()
  _resetTvdbClientCacheForTesting()
})

afterEach(() => {
})

describe("getTVDBv4Client", () => {
  it("targets reverse proxy and SMM-managed default upstream when no TVDB host is configured", () => {
    getTVDBv4Client({ reverseProxyUrl: REVERSE_PROXY_URL })
    expect(mockTvdbConstructor).toHaveBeenCalledTimes(1)
    const options = mockTvdbConstructor.mock.calls[0][0] as { baseUrl?: string; disableAuth?: boolean; apiKey?: string }
    expect(options.baseUrl).toBe(REVERSE_PROXY_URL)
    expect(options.disableAuth).toBe(true)
    expect(options.apiKey).toBe("")
  })

  it("enables auth and forwards apiKey when configured TVDB host is direct and apiKey is set", () => {
    getTVDBv4Client({
      reverseProxyUrl: REVERSE_PROXY_URL,
      upstreamBaseURL: TVDB_DIRECT_UPSTREAM,
      apiKey: "tvdb-api-key",
    })
    expect(mockTvdbConstructor).toHaveBeenCalledTimes(1)
    const options = mockTvdbConstructor.mock.calls[0][0] as { baseUrl?: string; disableAuth?: boolean; apiKey?: string }
    expect(options.baseUrl).toBe(REVERSE_PROXY_URL)
    expect(options.disableAuth).toBe(false)
    expect(options.apiKey).toBe("tvdb-api-key")
  })

  it("keeps auth disabled when configured TVDB host is direct but no apiKey is set", () => {
    getTVDBv4Client({ reverseProxyUrl: REVERSE_PROXY_URL, upstreamBaseURL: TVDB_DIRECT_UPSTREAM })
    expect(mockTvdbConstructor).toHaveBeenCalledTimes(1)
    const options = mockTvdbConstructor.mock.calls[0][0] as { disableAuth?: boolean }
    expect(options.disableAuth).toBe(true)
  })

  it("memoizes the client per (reverseProxyUrl, upstreamBaseURL, apiKey)", () => {
    const options = {
      reverseProxyUrl: REVERSE_PROXY_URL,
      upstreamBaseURL: TVDB_DIRECT_UPSTREAM,
      apiKey: "tvdb-api-key",
    }
    const a = getTVDBv4Client(options)
    const b = getTVDBv4Client(options)
    expect(a).toBe(b)
    expect(mockTvdbConstructor).toHaveBeenCalledTimes(1)
  })

  it("throws when no reverse proxy URL is available", () => {
    expect(() => getTVDBv4Client({ reverseProxyUrl: null })).toThrow(/Reverse proxy URL is not available/)
  })

  it("injects X-SMM-Proxy-Upstream-BaseURL on every fetchImpl call (SMM-managed upstream)", async () => {
    const fetchSpy = vi
      .spyOn(window, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }))
    getTVDBv4Client({ reverseProxyUrl: REVERSE_PROXY_URL })
    const options = mockTvdbConstructor.mock.calls[0][0] as { fetchImpl?: typeof window.fetch }
    expect(options.fetchImpl).toBeTypeOf("function")
    await options.fetchImpl!("http://127.0.0.1:30005/series/123/extended", { method: "GET" })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const init = fetchSpy.mock.calls[0][1] as RequestInit
    const headers = init.headers as Headers
    expect(headers.get("X-SMM-Proxy-Upstream-BaseURL")).toBe(SMM_TVDB_DEFAULT_UPSTREAM)
  })

  it("injects X-SMM-Proxy-Upstream-BaseURL with configured TVDB host", async () => {
    const fetchSpy = vi
      .spyOn(window, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }))
    getTVDBv4Client({
      reverseProxyUrl: REVERSE_PROXY_URL,
      upstreamBaseURL: TVDB_DIRECT_UPSTREAM,
      apiKey: "tvdb-api-key",
    })
    const options = mockTvdbConstructor.mock.calls[0][0] as { fetchImpl?: typeof window.fetch }
    await options.fetchImpl!("http://127.0.0.1:30005/login", {
      method: "POST",
      body: JSON.stringify({ apikey: "tvdb-api-key" }),
    })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const init = fetchSpy.mock.calls[0][1] as RequestInit
    const headers = init.headers as Headers
    expect(headers.get("X-SMM-Proxy-Upstream-BaseURL")).toBe(TVDB_DIRECT_UPSTREAM)
  })
})

describe("fetchTvdbAndBuildMovieMediaMetadata", () => {
  it("maps TVDB movie and uses first_release.first as airDate", async () => {
    mockMovieTranslationByLangCode.mockResolvedValue({
      status: "success",
      data: { name: "TVDB Movie Name" },
    })
    mockMovieExtendedById.mockResolvedValue({
      status: "success",
      data: {
        name: "Default Name",
        first_release: { first: "2021-10-22" },
      },
    })

    const ret = await fetchTvdbAndBuildMovieMediaMetadata(
      15778,
      "en-US",
      {},
      { reverseProxyUrl: REVERSE_PROXY_URL },
    )

    expect(ret).toEqual({
      id: "15778",
      name: "TVDB Movie Name",
      airDate: "2021-10-22",
      database: "TVDB",
    })
  })

  it("falls back to release_date when first_release.first is missing", async () => {
    mockMovieTranslationByLangCode.mockResolvedValue({
      status: "success",
      data: { name: "" },
    })
    mockMovieExtendedById.mockResolvedValue({
      status: "success",
      data: {
        name: "Fallback Name",
        release_date: "2020-05-01",
      },
    })

    const ret = await fetchTvdbAndBuildMovieMediaMetadata(
      15778,
      "en-US",
      {},
      { reverseProxyUrl: REVERSE_PROXY_URL },
    )

    expect(ret).toEqual({
      id: "15778",
      name: "Fallback Name",
      airDate: "2020-05-01",
      database: "TVDB",
    })
  })
})

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
      },
      { reverseProxyUrl: REVERSE_PROXY_URL },
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
      airDate: "2023-04-12",
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
