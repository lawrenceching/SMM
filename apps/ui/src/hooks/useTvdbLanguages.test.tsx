import { describe, expect, it, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// Mock the entire TvdbUtils module so we can stub `getTvdbLanguages` directly.
vi.mock("@/lib/TvdbUtils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/TvdbUtils")>()
  return {
    ...actual,
    getTvdbLanguages: vi.fn(),
  }
})

vi.mock("@/hooks/userConfig", () => ({
  useConfig: vi.fn(() => ({
    userConfig: { tvdb: { host: "", apiKey: "" } },
    appConfig: { reverseProxyUrl: "http://127.0.0.1:30001" },
  })),
}))

import * as TvdbUtils from "@/lib/TvdbUtils"
import { useTvdbSearchLanguageOptions } from "./useTvdbLanguages"

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

describe("useTvdbSearchLanguageOptions", () => {
  beforeEach(() => {
    vi.mocked(TvdbUtils.getTvdbLanguages).mockReset()
  })

  it("maps TVDB language records to {code, name} options", async () => {
    vi.mocked(TvdbUtils.getTvdbLanguages).mockResolvedValue([
      { id: "eng", name: "English", nativeName: "English" },
      { id: "zho", name: "Chinese", nativeName: "中文" },
      { id: "fra", name: "French", nativeName: "Français" },
    ])

    const { result } = renderHook(() => useTvdbSearchLanguageOptions(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data).toEqual([
      { code: "eng", name: "English (eng)" },
      { code: "zho", name: "中文 (zho)" },
      { code: "fra", name: "Français (fra)" },
    ])
  })

  it("skips entries with an empty id and dedupes by id", async () => {
    vi.mocked(TvdbUtils.getTvdbLanguages).mockResolvedValue([
      { id: "eng", name: "English" },
      { id: "eng", name: "English (duplicate)" },
      { id: "", name: "No code" },
    ] as any)

    const { result } = renderHook(() => useTvdbSearchLanguageOptions(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data).toEqual([{ code: "eng", name: "English (eng)" }])
  })

  it("returns undefined when the upstream reports failure", async () => {
    vi.mocked(TvdbUtils.getTvdbLanguages).mockResolvedValue(undefined)

    const { result } = renderHook(() => useTvdbSearchLanguageOptions(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toBeUndefined()
  })
})
