import { describe, expect, it, vi } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

vi.mock("@/hooks/userConfig", () => ({
  useConfig: vi.fn(() => ({
    userConfig: { tmdb: { host: "", apiKey: "" } },
    appConfig: { reverseProxyUrl: "http://127.0.0.1:30001" },
  })),
}))

import { useTmdbSearchLanguageOptions } from "./useTmdbLanguages"

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
    },
  })
  // eslint-disable-next-line react/display-name
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
  it("combines primary translations with the language-name list to produce {code, name} options", async () => {
    // First call: primary_translations. Second call: languages.
    fetchSpy.mockReset()
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
    fetchSpy.mockReset()
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
    fetchSpy.mockReset()
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
