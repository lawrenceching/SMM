/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import React from "react"
import { toast } from "sonner"
import { Path } from "@smm/utils/path"
import { ProcessPipelineDialog } from "./ProcessPipelineDialog"
import type { ProcessPipelineDialogRow } from "./types"
import { useVideoCaptionerStatus } from "@/hooks/useVideoCaptionerStatus"
import { useFeatures } from "@/hooks/useFeatures"
import { useBackgroundJobsStore } from "@/stores/backgroundJobsStore"

const h = vi.hoisted(() => ({
  createJob: vi.fn().mockResolvedValue("orch-id"),
  createJobs: vi.fn().mockResolvedValue({ successIds: [], failures: [] }),
  processSubtitleViaCore: vi.fn().mockResolvedValue("core-process-1"),
  pollSubtitleJob: vi.fn().mockResolvedValue({
    kind: "process-subtitle",
    id: "core-process-1",
    type: "process-subtitle",
    folder: "C:\\media\\show",
    mediaPath: "C:\\media\\show\\ep1.mkv",
    status: "succeeded",
    progress: 100,
    createdAt: 0,
    updatedAt: 0,
  }),
}))

vi.mock("@/api/processSubtitle", () => ({
  processSubtitleViaCore: h.processSubtitleViaCore,
}))

vi.mock("@/lib/pollSubtitleJob", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/pollSubtitleJob")>()
  return {
    ...actual,
    pollSubtitleJob: h.pollSubtitleJob,
  }
})

vi.mock("@/hooks/useJobManager", () => ({
  useJobManager: () => ({
    isReady: true,
    createJob: h.createJob,
    createJobs: h.createJobs,
    startJob: vi.fn(),
    stopJob: vi.fn(),
    removeJob: vi.fn(),
  }),
}))

vi.mock("@/hooks/useVideoCaptionerStatus", () => ({
  useVideoCaptionerStatus: vi.fn(),
}))

vi.mock("@/hooks/useFeatures", () => ({
  useFeatures: vi.fn(),
}))

vi.mock("@/hooks/userConfig", () => ({
  useConfig: () => ({
    userConfig: {
      aiProviders: [
        {
          name: "DeepSeek",
          baseURL: "https://api.deepseek.com",
          apiKey: "sk-secret-key",
          model: "deepseek-v4-flash",
        },
      ],
      selectedAIProvider: "DeepSeek",
    },
  }),
}))

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) => {
      const map: Record<string, string> = {
        cancel: "Cancel",
        "processPipelineDialog.noMediaFolder":
          "Media folder is not available; cannot start pipeline.",
        "processPipelineDialog.notEligible": "This item is not eligible for the pipeline.",
        "processPipelineDialog.partialFailure": `${options?.count ?? 0} pipeline job(s) could not be enqueued.`,
      }
      return map[key] ?? key
    },
  }),
}))

vi.mock("sonner")

describe("ProcessPipelineDialog", () => {
  const mockOnClose = vi.fn()
  const platformFolder = "C:\\media\\show"

  function eligibleRow(
    overrides?: Partial<ProcessPipelineDialogRow>,
  ): ProcessPipelineDialogRow {
    return {
      id: "row-1",
      mediaPath: "/show/ep1.mkv",
      displayPath: "ep1.mkv",
      title: "Episode 1",
      eligible: true,
      ...overrides,
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    useBackgroundJobsStore.setState({ jobs: [] })
    window.localStorage.clear()
    vi.mocked(toast.error).mockImplementation(() => "id")
    vi.mocked(toast.success).mockImplementation(() => "id")
    vi.mocked(useVideoCaptionerStatus).mockReturnValue({
      isAvailable: true,
      isChecking: false,
    })
    vi.mocked(useFeatures).mockReturnValue({
      isTranscribeEnabled: true,
      isVideoCaptionerAsrOptionsEnabled: false,
      setVideoCaptionerAsrOptionsEnabled: vi.fn(),
      isTencentAsrTranscribeEnabled: false,
      setTencentAsrTranscribeEnabled: vi.fn(),
    })
    h.processSubtitleViaCore.mockResolvedValue("core-process-1")
  })

  it("shows error and does not enqueue when folder is missing", async () => {
    render(<ProcessPipelineDialog isOpen onClose={mockOnClose} rows={[eligibleRow()]} />)

    fireEvent.click(screen.getByTestId("process-pipeline-confirm"))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Media folder is not available; cannot start pipeline.",
      )
    })
    expect(mockOnClose).not.toHaveBeenCalled()
    expect(h.processSubtitleViaCore).not.toHaveBeenCalled()
    expect(h.createJob).not.toHaveBeenCalled()
    expect(h.createJobs).not.toHaveBeenCalled()
  })

  it("enqueues via Core without createJob and closes on success", async () => {
    render(
      <ProcessPipelineDialog
        isOpen
        onClose={mockOnClose}
        rows={[eligibleRow()]}
        folder={platformFolder}
      />,
    )

    fireEvent.click(screen.getByTestId("process-pipeline-confirm"))

    await waitFor(() => {
      expect(h.processSubtitleViaCore).toHaveBeenCalledTimes(1)
    })
    expect(h.createJob).not.toHaveBeenCalled()
    expect(h.createJobs).not.toHaveBeenCalled()
    const arg = h.processSubtitleViaCore.mock.calls[0]![0]
    expect(arg.folder).toBe(platformFolder)
    expect(arg.mediaPath).toBe(Path.toPlatformPath(Path.posix("/show/ep1.mkv")))
    expect(arg.title).toBe("Episode 1")
    expect(arg.asr).toBe("bijian")
    expect(arg.translator).toBe("google")
    expect(arg).not.toHaveProperty("llm")
    expect(mockOnClose).toHaveBeenCalledTimes(1)

    const jobs = useBackgroundJobsStore.getState().jobs
    expect(jobs).toHaveLength(1)
    expect(jobs[0]!.type).toBe("process-subtitle")
    expect(jobs[0]!.status).toBe("pending")
    expect(jobs[0]!.data).not.toHaveProperty("llm")
  })

  it("passes llm only to Core HTTP and never into Zustand", async () => {
    window.localStorage.setItem("processPipeline.translator", "llm")
    window.localStorage.setItem("processPipeline.llmSourceMode", "configured")
    window.localStorage.setItem("processPipeline.llmProviderName", "DeepSeek")

    render(
      <ProcessPipelineDialog
        isOpen
        onClose={mockOnClose}
        rows={[eligibleRow()]}
        folder={platformFolder}
      />,
    )

    fireEvent.click(screen.getByTestId("process-pipeline-confirm"))

    await waitFor(() => {
      expect(h.processSubtitleViaCore).toHaveBeenCalledTimes(1)
    })
    expect(h.createJob).not.toHaveBeenCalled()
    expect(h.createJobs).not.toHaveBeenCalled()
    const arg = h.processSubtitleViaCore.mock.calls[0]![0]
    expect(arg.translator).toBe("llm")
    expect(arg.llm).toEqual(
      expect.objectContaining({
        apiKey: "sk-secret-key",
      }),
    )

    const jobs = useBackgroundJobsStore.getState().jobs
    expect(jobs).toHaveLength(1)
    expect(jobs[0]!.data).not.toHaveProperty("llm")
  })

  it("does not close when selected rows are ineligible", async () => {
    render(
      <ProcessPipelineDialog
        isOpen
        onClose={mockOnClose}
        folder={platformFolder}
        rows={[
          {
            id: "x",
            mediaPath: "",
            title: "No media",
            eligible: false,
            disabledReason: "processPipelineDialog.noMediaPath",
          },
        ]}
        defaultSelectedIds={["x"]}
      />,
    )

    const confirm = screen.getByTestId("process-pipeline-confirm")
    if (!confirm.hasAttribute("disabled")) {
      fireEvent.click(confirm)
    }

    expect(h.processSubtitleViaCore).not.toHaveBeenCalled()
    expect(h.createJob).not.toHaveBeenCalled()
    expect(h.createJobs).not.toHaveBeenCalled()
    expect(mockOnClose).not.toHaveBeenCalled()
  })

  it("skips ineligible rows but enqueues eligible ones", async () => {
    render(
      <ProcessPipelineDialog
        isOpen
        onClose={mockOnClose}
        folder={platformFolder}
        rows={[
          {
            id: "a",
            mediaPath: "",
            title: "Bad",
            eligible: false,
            disabledReason: "processPipelineDialog.noMediaPath",
          },
          eligibleRow({ id: "b", title: "Good", mediaPath: "/ok.mkv", displayPath: "ok.mkv" }),
        ]}
      />,
    )

    fireEvent.click(screen.getByTestId("process-pipeline-confirm"))

    await waitFor(() => {
      expect(h.processSubtitleViaCore).toHaveBeenCalledTimes(1)
    })
    expect(h.processSubtitleViaCore.mock.calls[0]![0].title).toBe("Good")
    expect(h.createJob).not.toHaveBeenCalled()
    expect(h.createJobs).not.toHaveBeenCalled()
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })
})
