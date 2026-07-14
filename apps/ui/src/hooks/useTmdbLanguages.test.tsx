import { describe, expect, it, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

vi.mock("@/api/readUserConfig", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/readUserConfig")>()
  return {
    ...actual,
    readUserConfig: vi.fn(),
  }
})

vi.mock("@/api/hello", () => ({
  hello: vi.fn(),
}))

vi.mock("@/api/discover", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/discover")>()
  return {
    ...actual,
    fetchDiscoverConfig: vi.fn(),
  }
})

import { readUserConfig, defaultUserConfig } from "@/api/readUserConfig"
import { hello } from "@/api/hello"
import { fetchDiscoverConfig } from "@/api/discover"
import { useTmdbSearchLanguageOptions } from "./useTmdbLanguages"

const mockReadUserConfig = vi.mocked(readUserConfig)
const mockHello = vi.mocked(hello)
const mockFetchDiscoverConfig = vi.mocked(fetchDiscoverConfig)

const REVERSE_PROXY_URL = "http://127.0.0.1:30001"
const TEST_DEFAULT_UPSTREAM = "http://127.0.0.1:39998/api/tmdb"

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const fetchSpy = vi.fn()
vi.stubGlobal("fetch", fetchSpy)

function mockFetchOnce(body: unknown) {
  fetchSpy.mockResolvedValueOnce(
    new Response(JSON.stringify(body), { status: 200 }),
  )
}

describe("useTmdbSearchLanguageOptions", () => {
  beforeEach(() => {
    fetchSpy.mockReset()
    mockReadUserConfig.mockResolvedValue({
      ...defaultUserConfig,
      tmdb: { host: "", apiKey: "", httpProxy: "" },
    })
    mockHello.mockResolvedValue({
      reverseProxyUrl: REVERSE_PROXY_URL,
      userDataDir: "/tmp/smm",
    } as Awaited<ReturnType<typeof hello>>)
    mockFetchDiscoverConfig.mockResolvedValue({
      mediaDatabases: [
        {
          type: "tmdb",
          url: TEST_DEFAULT_UPSTREAM,
          authorizationMethod: "none",
        },
      ],
      reverseProxies: [],
    })
  })

  it("combines primary translations with the language-name list to produce {code, name} options", async () => {
    // First call: primary_translations. Second call: languages.
    mockFetchOnce(["en-US", "zh-CN", "fr-FR"])
    mockFetchOnce([
      { iso_639_1: "en", english_name: "English", name: "English" },
      { iso_639_1: "zh", english_name: "Chinese", name: "中文" },
      { iso_639_1: "fr", english_name: "French", name: "Français" },
    ])

    const { result } = renderHook(() => useTmdbSearchLanguageOptions(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data).toEqual([
      { code: "en-US", name: "English (en-US)" },
      { code: "zh-CN", name: "中文 (zh-CN)" },
      { code: "fr-FR", name: "Français (fr-FR)" },
    ])
  })

  it("falls back to the ISO 639-1 prefix when the language name is missing", async () => {
    mockFetchOnce(["xx-XX"])
    mockFetchOnce([])

    const { result } = renderHook(() => useTmdbSearchLanguageOptions(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.data).toBeDefined())

    // `xx` is not in the language list, so the name is the uppercase prefix
    expect(result.current.data).toEqual([{ code: "xx-XX", name: "XX (xx-XX)" }])
  })

  it("deduplicates entries that appear more than once in the primary-translation list", async () => {
    mockFetchOnce(["en-US", "en-US", "zh-CN"])
    mockFetchOnce([
      { iso_639_1: "en", english_name: "English", name: "English" },
      { iso_639_1: "zh", english_name: "Chinese", name: "中文" },
    ])

    const { result } = renderHook(() => useTmdbSearchLanguageOptions(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data).toEqual([
      { code: "en-US", name: "English (en-US)" },
      { code: "zh-CN", name: "中文 (zh-CN)" },
    ])
  })
})
