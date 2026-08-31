import React from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useScrapeMutation } from "./useScrapeMutation"

const scrapeFolderViaCoreMock = vi.fn()

vi.mock("@/api/scrapeV3", () => ({
  scrapeFolderViaCore: (...args: unknown[]) => scrapeFolderViaCoreMock(...args),
}))

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

describe("useScrapeMutation", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })
  })

  afterEach(() => {
    queryClient.clear()
  })

  it("returns the scrape job id from scrapeFolderViaCore", async () => {
    scrapeFolderViaCoreMock.mockResolvedValue("job-42")

    const { result } = renderHook(() => useScrapeMutation(), {
      wrapper: createWrapper(queryClient),
    })

    let jobId = ""
    await act(async () => {
      jobId = await result.current.mutateAsync({
        path: "/media/Movie",
        language: "zh-CN",
      })
    })

    expect(jobId).toBe("job-42")
    expect(scrapeFolderViaCoreMock).toHaveBeenCalledWith({
      path: "/media/Movie",
      language: "zh-CN",
    })
  })
})
