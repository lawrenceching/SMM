/** @vitest-environment jsdom */
/**
 * TranscribeDialog → Core HTTP enqueue boundary.
 * Verifies nested media paths are converted to platform paths for ViaCore.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { Path } from "@smm/utils/path"
import { TranscribeDialog } from "./TranscribeDialog"
import { useFeatures } from "@/hooks/useFeatures"
import { useVideoCaptionerStatus } from "@/hooks/useVideoCaptionerStatus"
import type { TranscribeDialogRow } from "./types"

const MEDIA_FOLDER_POSIX = "/path/to/music"
const NESTED_FILE_POSIX = "/path/to/music/a/b/c/d/test.mp4"
const NESTED_FILE_REL = "a/b/c/d/test.mp4"
const PLATFORM_FOLDER = Path.toPlatformPath(MEDIA_FOLDER_POSIX)
const EXPECTED_MEDIA_PLATFORM = Path.toPlatformPath(NESTED_FILE_POSIX)

const h = vi.hoisted(() => ({
  transcribeSubtitleViaCore: vi.fn().mockResolvedValue("core-nested-1"),
  pollSubtitleJob: vi.fn().mockResolvedValue({
    kind: "transcribe-subtitle",
    id: "core-nested-1",
    type: "transcribe-subtitle",
    folder: "folder",
    mediaPath: "media",
    asr: "bijian",
    status: "succeeded",
    progress: 100,
    createdAt: 0,
    updatedAt: 0,
  }),
  createJob: vi.fn(),
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

vi.mock("@/hooks/useFeatures", () => ({
  useFeatures: vi.fn(),
}))

vi.mock("@/hooks/useVideoCaptionerStatus", () => ({
  useVideoCaptionerStatus: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock("@/lib/i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/i18n")>()
  return {
    ...actual,
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
  }
})

function nestedRow(): TranscribeDialogRow {
  return {
    id: NESTED_FILE_POSIX,
    path: NESTED_FILE_POSIX,
    displayPath: NESTED_FILE_REL,
    title: "test",
  }
}

describe("TranscribeDialog Core enqueue (nested paths)", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
    vi.clearAllMocks()
    h.transcribeSubtitleViaCore.mockResolvedValue("core-nested-1")

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
  })

  it("passes full nested platform media path to transcribeSubtitleViaCore", async () => {
    const onClose = vi.fn()

    render(
      <TranscribeDialog
        isOpen
        onClose={onClose}
        rows={[nestedRow()]}
        folder={PLATFORM_FOLDER}
      />,
    )

    fireEvent.click(screen.getByTestId("transcribe-dialog-confirm"))

    await waitFor(() => {
      expect(h.transcribeSubtitleViaCore).toHaveBeenCalled()
    })

    expect(h.createJob).not.toHaveBeenCalled()
    const request = h.transcribeSubtitleViaCore.mock.calls[0]![0]
    expect(request.mediaPath).toBe(EXPECTED_MEDIA_PLATFORM)
    expect(request.mediaPath).toContain("a")
    expect(request.mediaPath).toContain("test.mp4")
    expect(request.mediaPath).not.toBe("test.mp4")
    expect(onClose).toHaveBeenCalled()
  })
})
