/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"
import { useProcessManager } from "./useProcessManager"

const mockUseJobManager = vi.fn()

vi.mock("@/hooks/useJobManager", () => ({
  useJobManager: (opts: unknown) => mockUseJobManager(opts),
}))

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

describe("useProcessManager", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseJobManager.mockReturnValue({
      jobRecords: [
        {
          id: "job-1",
          name: "Process: test",
          status: "running",
          progress: 0,
          type: "process",
          folder: "C:\\media",
          data: JSON.stringify({ mediaPath: "/media/a.mkv" }),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      hasRunningJob: true,
      startJob: vi.fn(),
      stopJob: vi.fn(),
      removeJob: vi.fn(),
    })
  })

  it("exposes processing path set from job records", () => {
    const { result } = renderHook(() =>
      useProcessManager({ platformFolder: "C:\\media" }),
    )
    expect(result.current.processingPaths.has("/media/a.mkv")).toBe(true)
    expect(result.current.jobIdByPath.get("/media/a.mkv")).toBe("job-1")
  })
})
