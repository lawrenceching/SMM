import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"
import { useJobManager } from "./useJobManager"
import * as downloadTaskDb from "@/lib/downloadTaskDb"

describe("useJobManager", () => {
  const postMessage = vi.fn()
  const swListeners: Array<(e: MessageEvent) => void> = []

  beforeEach(() => {
    vi.spyOn(downloadTaskDb, "getJobsByTypeAndFolder").mockResolvedValue([])
    vi.spyOn(downloadTaskDb, "deleteJob").mockResolvedValue(undefined)
    vi.spyOn(downloadTaskDb, "notifyIndexedDbUpdated").mockImplementation(() => {})

    Object.defineProperty(globalThis.navigator, "serviceWorker", {
      configurable: true,
      value: {
        controller: { postMessage },
        addEventListener: (_ev: string, fn: (e: MessageEvent) => void) => {
          swListeners.push(fn)
        },
        removeEventListener: (_ev: string, fn: (e: MessageEvent) => void) => {
          const i = swListeners.indexOf(fn)
          if (i >= 0) swListeners.splice(i, 1)
        },
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    swListeners.length = 0
    postMessage.mockClear()
  })

  it("loads job records when platformFolder is set", async () => {
    const records = [
      {
        id: "j1",
        name: "T",
        status: "pending",
        progress: 0,
        type: "transcribe",
        folder: "C:\\m",
        data: "{}",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]
    vi.mocked(downloadTaskDb.getJobsByTypeAndFolder).mockResolvedValue(records as downloadTaskDb.TaskJobRecord[])

    const { result } = renderHook(() =>
      useJobManager({
        jobType: "transcribe",
        messagePrefix: "transcribe",
        platformFolder: "C:\\m",
        autoStartKey: "transcribe.autoStart.test",
        onJobSucceeded: vi.fn(),
      }),
    )

    await waitFor(() => {
      expect(result.current.jobRecords).toHaveLength(1)
    })
    expect(result.current.jobRecords[0]!.id).toBe("j1")
  })

  it("postMessage transcribe:start when startJob is called", () => {
    vi.mocked(downloadTaskDb.getJobsByTypeAndFolder).mockResolvedValue([])

    const { result } = renderHook(() =>
      useJobManager({
        jobType: "transcribe",
        messagePrefix: "transcribe",
        platformFolder: "C:\\m",
        autoStartKey: "transcribe.autoStart.test",
      }),
    )

    act(() => {
      result.current.startJob("abc")
    })
    expect(postMessage).toHaveBeenCalledWith({ event: "transcribe:start", id: "abc" })
  })
})
