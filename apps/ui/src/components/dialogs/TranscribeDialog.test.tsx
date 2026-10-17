import { describe, it, expect, vi, beforeEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import React from "react"
import { toast } from "sonner"
import { Path } from "@smm/utils/path"
import { TranscribeDialog } from "./TranscribeDialog"
import type { TranscribeDialogRow } from "./types"
import { useFeatures } from "@/hooks/useFeatures"
import { useVideoCaptionerStatus } from "@/hooks/useVideoCaptionerStatus"
import { useBackgroundJobsStore } from "@/stores/backgroundJobsStore"

const h = vi.hoisted(() => ({
  createJob: vi.fn().mockResolvedValue("orch-id"),
  transcribeSubtitleViaCore: vi.fn().mockResolvedValue("core-transcribe-1"),
  pollSubtitleJob: vi.fn().mockResolvedValue({
    kind: "transcribe-subtitle",
    id: "core-transcribe-1",
    type: "transcribe-subtitle",
    folder: "C:\\media\\music",
    mediaPath: "C:\\media\\music\\track1.mp3",
    asr: "bijian",
    status: "succeeded",
    progress: 100,
    createdAt: 0,
    updatedAt: 0,
  }),
}))

vi.mock("@/api/transcribeSubtitle", () => ({
  transcribeSubtitleViaCore: h.transcribeSubtitleViaCore,
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
    createJobs: vi.fn().mockResolvedValue({ successIds: [], failures: [] }),
    startJob: vi.fn(),
    stopJob: vi.fn(),
    removeJob: vi.fn(),
  }),
}))
vi.mock("@/hooks/useJobOrchestrator", () => ({
  useJobOrchestrator: () => ({
    isReady: true,
    createJob: h.createJob,
    createJobs: vi.fn().mockResolvedValue({ successIds: [], failures: [] }),
    startJob: vi.fn(),
    stopJob: vi.fn(),
    removeJob: vi.fn(),
  }),
  useFileStatuses: vi.fn(() => ({
    runningPaths: new Set<string>(),
    pendingPaths: new Set<string>(),
    failedPaths: new Set<string>(),
    jobIdsByPath: new Map<string, string[]>(),
    primaryJobIdByPath: new Map<string, string>(),
  })),
  useJobs: vi.fn(() => []),
}))

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { ns?: string }) => {
      if (options?.ns === "common") {
        const common: Record<string, string> = { cancel: "Cancel" }
        return common[key] ?? key
      }
      const dialogs: Record<string, string> = {
        "transcribe.defaultTitle": "Transcribe",
        "transcribe.defaultDescription": "Description",
        "transcribe.confirm": "Confirm",
        "transcribe.selectAllAria": "Select all",
        "transcribe.columns.filePath": "File",
        "transcribe.advancedOptions.label": "Advanced options",
        "transcribe.noFiles": "No files",
        "transcribe.asr.label": "ASR engine",
        "transcribe.asr.bijian": "Bijian",
        "transcribe.asr.jianying": "Jianying",
        "transcribe.asr.whisperCpp": "Whisper CPP",
        "transcribe.provider.label": "Provider",
        "transcribe.provider.videoCaptioner": "VideoCaptioner",
        "transcribe.provider.tencentAsr": "Tencent ASR",
        "transcribe.language.label": "Language",
        "transcribe.language.placeholder": "auto",
        "transcribe.wordTimestamps.label": "Word timestamps",
        "transcribe.format.label": "Format",
        "transcribe.format.srt": "SRT",
        "transcribe.format.ass": "ASS",
        "transcribe.format.txt": "TXT",
        "transcribe.format.json": "JSON",
        "transcribe.tencent.baseUrl": "Base URL",
        "transcribe.tencent.apiKey": "API key",
      }
      return dialogs[key] ?? key
    },
  }),
}))

vi.mock("@/hooks/useFeatures", () => ({
  useFeatures: vi.fn(),
}))

vi.mock("@/hooks/useVideoCaptionerStatus", () => ({
  useVideoCaptionerStatus: vi.fn(),
}))

vi.mock("sonner")

const defaultFeatures = {
  isTranscribeEnabled: true,
  isVideoCaptionerAsrOptionsEnabled: false,
  setVideoCaptionerAsrOptionsEnabled: vi.fn(),
  isTencentAsrTranscribeEnabled: false,
  setTencentAsrTranscribeEnabled: vi.fn(),
}

describe("TranscribeDialog", () => {
  const mockOnClose = vi.fn()
  const platformFolder = "C:\\media\\music"

  function rowWithPath(overrides?: Partial<TranscribeDialogRow>): TranscribeDialogRow {
    return {
      id: "row-1",
      path: "/music/track1.mp3",
      displayPath: "track1.mp3",
      title: "My Track",
      ...overrides,
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    useBackgroundJobsStore.setState({ jobs: [] })
    vi.mocked(toast.error).mockImplementation(() => "id")
    vi.mocked(toast.success).mockImplementation(() => "id")
    vi.mocked(useVideoCaptionerStatus).mockReturnValue({
      isAvailable: true,
      isChecking: false,
    })
    vi.mocked(useFeatures).mockReturnValue(defaultFeatures)
    h.transcribeSubtitleViaCore.mockResolvedValue("core-transcribe-1")
  })

  it("shows error and does not enqueue when folder is missing", async () => {
    render(<TranscribeDialog isOpen onClose={mockOnClose} rows={[rowWithPath()]} />)

    fireEvent.click(screen.getByTestId("transcribe-dialog-confirm"))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Media folder is not available; cannot start transcription.",
      )
    })
    expect(mockOnClose).not.toHaveBeenCalled()
    expect(h.transcribeSubtitleViaCore).not.toHaveBeenCalled()
    expect(h.createJob).not.toHaveBeenCalled()
  })

  it("enqueues via Core and closes when folder and paths are valid", async () => {
    render(
      <TranscribeDialog
        isOpen
        onClose={mockOnClose}
        rows={[rowWithPath()]}
        folder={platformFolder}
      />,
    )

    fireEvent.click(screen.getByTestId("transcribe-dialog-confirm"))

    await waitFor(() => {
      expect(h.transcribeSubtitleViaCore).toHaveBeenCalledTimes(1)
    })
    expect(h.createJob).not.toHaveBeenCalled()
    const arg = h.transcribeSubtitleViaCore.mock.calls[0]![0]
    expect(arg.folder).toBe(platformFolder)
    expect(arg.mediaPath).toBe(Path.toPlatformPath(Path.posix("/music/track1.mp3")))
    expect(arg.title).toBe("My Track")
    expect(arg.asr).toBe("bijian")
    expect(mockOnClose).toHaveBeenCalledTimes(1)

    const jobs = useBackgroundJobsStore.getState().jobs
    expect(jobs).toHaveLength(1)
    expect(jobs[0]!.type).toBe("transcribe-subtitle")
    expect(jobs[0]!.status).toBe("pending")
  })

  it("passes videoCaptioner options to Core when ASR feature is enabled", async () => {
    vi.mocked(useFeatures).mockReturnValue({
      ...defaultFeatures,
      isVideoCaptionerAsrOptionsEnabled: true,
    })
    render(
      <TranscribeDialog
        isOpen
        onClose={mockOnClose}
        rows={[rowWithPath()]}
        folder={platformFolder}
      />,
    )

    fireEvent.click(screen.getByTestId("transcribe-dialog-confirm"))

    await waitFor(() => {
      expect(h.transcribeSubtitleViaCore).toHaveBeenCalled()
    })
    expect(h.createJob).not.toHaveBeenCalled()
    expect(h.transcribeSubtitleViaCore.mock.calls[0]![0]).toEqual(
      expect.objectContaining({
        asr: "bijian",
        language: "auto",
        format: "srt",
      }),
    )
  })

  it("uses basename when title is empty or whitespace", async () => {
    render(
      <TranscribeDialog
        isOpen
        onClose={mockOnClose}
        rows={[rowWithPath({ title: "   " })]}
        folder={platformFolder}
      />,
    )

    fireEvent.click(screen.getByTestId("transcribe-dialog-confirm"))

    await waitFor(() => {
      expect(h.transcribeSubtitleViaCore).toHaveBeenCalled()
    })
    expect(h.transcribeSubtitleViaCore.mock.calls[0]![0].title).toMatch(/track1\.mp3/)
  })

  it("does not close when selected rows have no file path", () => {
    render(
      <TranscribeDialog
        isOpen
        onClose={mockOnClose}
        folder={platformFolder}
        rows={[{ id: "x", path: "", displayPath: "", title: "No file" }]}
      />,
    )

    fireEvent.click(screen.getByTestId("transcribe-dialog-confirm"))

    expect(mockOnClose).not.toHaveBeenCalled()
    expect(h.transcribeSubtitleViaCore).not.toHaveBeenCalled()
    expect(h.createJob).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith(
      'Track "No file" does not have an associated file path.',
    )
  })

  it("skips invalid rows but enqueues valid ones", async () => {
    render(
      <TranscribeDialog
        isOpen
        onClose={mockOnClose}
        folder={platformFolder}
        rows={[
          { id: "a", path: "", title: "Bad" },
          rowWithPath({
            id: "b",
            path: "/ok.mp3",
            title: "Good",
            displayPath: "ok.mp3",
          }),
        ]}
      />,
    )

    fireEvent.click(screen.getByTestId("transcribe-dialog-confirm"))

    expect(toast.error).toHaveBeenCalledWith(
      'Track "Bad" does not have an associated file path.',
    )
    await waitFor(() => {
      expect(h.transcribeSubtitleViaCore).toHaveBeenCalledTimes(1)
    })
    expect(h.transcribeSubtitleViaCore.mock.calls[0]![0].title).toBe("Good")
    expect(h.createJob).not.toHaveBeenCalled()
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it("toasts and does not call Core when provider is tencentAsr", async () => {
    vi.mocked(useFeatures).mockReturnValue({
      ...defaultFeatures,
      isTencentAsrTranscribeEnabled: true,
    })
    // Force default provider to tencentAsr (VideoCaptioner unavailable).
    vi.mocked(useVideoCaptionerStatus).mockReturnValue({
      isAvailable: false,
      isChecking: false,
    })
    render(
      <TranscribeDialog
        isOpen
        onClose={mockOnClose}
        rows={[rowWithPath()]}
        folder={platformFolder}
      />,
    )

    fireEvent.click(screen.getByTestId("transcribe-dialog-advanced-options"))
    fireEvent.change(screen.getByTestId("transcribe-dialog-tencent-base-url"), {
      target: { value: "https://asr.example" },
    })
    fireEvent.change(screen.getByTestId("transcribe-dialog-tencent-api-key"), {
      target: { value: "secret-key" },
    })

    fireEvent.click(screen.getByTestId("transcribe-dialog-confirm"))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Tencent ASR is not available in this version")
    })
    expect(h.transcribeSubtitleViaCore).not.toHaveBeenCalled()
    expect(h.createJob).not.toHaveBeenCalled()
    expect(mockOnClose).not.toHaveBeenCalled()
  })
})
