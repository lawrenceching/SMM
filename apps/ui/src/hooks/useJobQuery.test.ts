import React from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ScrapeJob } from "@/api/getJob"
import { isJobTerminalStatus, useJobQuery } from "./useJobQuery"

const getJobViaCoreMock = vi.fn()

vi.mock("@/api/getJob", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/getJob")>()
  return {
    ...actual,
    getJobViaCore: (...args: unknown[]) => getJobViaCoreMock(...args),
  }
})

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

function scrapeJob(overrides: Partial<ScrapeJob> = {}): ScrapeJob {
  return {
    kind: "scrape",
    id: "job-1",
    folderPath: "/media/Movie",
    status: "running",
    tasks: {
      poster: { status: "running" },
      fanart: { status: "pending" },
      thumbnails: { status: "skipped" },
      nfo: { status: "pending" },
    },
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

describe("useJobQuery", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
  })

  afterEach(() => {
    queryClient.clear()
  })

  it("isJobTerminalStatus covers succeeded, failed, and aborted only", () => {
    expect(isJobTerminalStatus("succeeded")).toBe(true)
    expect(isJobTerminalStatus("failed")).toBe(true)
    expect(isJobTerminalStatus("aborted")).toBe(true)
    expect(isJobTerminalStatus("pending")).toBe(false)
    expect(isJobTerminalStatus("running")).toBe(false)
  })

  it("polls until the job reaches a terminal status, then stops", async () => {
    getJobViaCoreMock
      .mockResolvedValueOnce(scrapeJob({ status: "running" }))
      .mockResolvedValueOnce(scrapeJob({ status: "running" }))
      .mockResolvedValueOnce(scrapeJob({ status: "succeeded" }))

    const { result } = renderHook(
      () => useJobQuery({ jobId: "job-1", refetchIntervalMs: 20 }),
      { wrapper: createWrapper(queryClient) },
    )

    await waitFor(() => {
      expect(result.current.data?.status).toBe("succeeded")
      expect(result.current.isTerminal).toBe(true)
    })

    const callsAfterTerminal = getJobViaCoreMock.mock.calls.length
    await new Promise((r) => setTimeout(r, 80))
    expect(getJobViaCoreMock.mock.calls.length).toBe(callsAfterTerminal)
  })
})
