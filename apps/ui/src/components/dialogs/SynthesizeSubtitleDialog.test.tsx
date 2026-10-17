/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import React from "react"
import { toast } from "sonner"
import { Path } from "@smm/utils/path"
import { SynthesizeSubtitleDialog } from "./SynthesizeSubtitleDialog"
import type { SynthesizeSubtitleDialogRow } from "./types"
import { useVideoCaptionerStatus } from "@/hooks/useVideoCaptionerStatus"
import { useBackgroundJobsStore } from "@/stores/backgroundJobsStore"

const h = vi.hoisted(() => ({
  createJob: vi.fn().mockResolvedValue("orch-id"),
  synthesizeSubtitleViaCore: vi.fn().mockResolvedValue("core-synthesize-1"),
  pollSubtitleJob: vi.fn().mockResolvedValue({
    kind: "synthesize-subtitle",
    id: "core-synthesize-1",
    type: "synthesize-subtitle",
    folder: "C:\\media\\show",
    videoPath: "C:\\media\\show\\ep1.mp4",
    subtitlePath: "C:\\media\\show\\ep1.srt",
    status: "succeeded",
    progress: 100,
    createdAt: 0,
    updatedAt: 0,
  }),
}))

vi.mock("@/api/synthesizeSubtitle", () => ({
  synthesizeSubtitleViaCore: h.synthesizeSubtitleViaCore,
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

vi.mock("@/hooks/useVideoCaptionerStatus", () => ({
  useVideoCaptionerStatus: vi.fn(),
}))

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "transcribe.selectAllAria": "Select all",
        "transcribe.columns.filePath": "File",
        "transcribe.noFiles": "No files",
        "synthesizeSubtitleDialog.title": "Synthesize",
        "synthesizeSubtitleDialog.description": "Desc",
        "synthesizeSubtitleDialog.subtitleMode": "Mode",
        "synthesizeSubtitleDialog.subtitleModes.soft": "Soft",
        "synthesizeSubtitleDialog.subtitleModes.hard": "Hard",
        "synthesizeSubtitleDialog.quality": "Quality",
        "synthesizeSubtitleDialog.qualities.ultra": "Ultra",
        "synthesizeSubtitleDialog.qualities.high": "High",
        "synthesizeSubtitleDialog.qualities.medium": "Medium",
        "synthesizeSubtitleDialog.qualities.low": "Low",
        "synthesizeSubtitleDialog.style": "Style",
        "synthesizeSubtitleDialog.stylePlaceholder": "Optional",
        "synthesizeSubtitleDialog.renderMode": "Render",
        "synthesizeSubtitleDialog.renderModeDefault": "Default",
        "synthesizeSubtitleDialog.renderModes.ass": "ASS",
        "synthesizeSubtitleDialog.renderModes.rounded": "Rounded",
        "synthesizeSubtitleDialog.layout": "Layout",
        "synthesizeSubtitleDialog.layoutDefault": "Layout default",
        "synthesizeSubtitleDialog.layouts.target-above": "TA",
        "synthesizeSubtitleDialog.layouts.source-above": "SA",
        "synthesizeSubtitleDialog.layouts.target-only": "TO",
        "synthesizeSubtitleDialog.layouts.source-only": "SO",
        "synthesizeSubtitleDialog.cancel": "Cancel",
        "synthesizeSubtitleDialog.confirm": "Confirm",
        "synthesizeSubtitleDialog.columns.file": "File",
        "synthesizeSubtitleDialog.columns.title": "Title",
        "synthesizeSubtitleDialog.selectAllAria": "Select all",
        "synthesizeSubtitleDialog.noFiles": "No files",
        "synthesizeSubtitleDialog.noSubtitleFile": "No subtitle",
        "synthesizeSubtitleDialog.notVideoFile": "Not video",
        cancel: "Cancel",
      }
      return map[key] ?? key
    },
  }),
}))

vi.mock("sonner")

describe("SynthesizeSubtitleDialog", () => {
  const mockOnClose = vi.fn()
  const platformFolder = "C:\\media\\show"

  function eligibleRow(
    overrides?: Partial<SynthesizeSubtitleDialogRow>,
  ): SynthesizeSubtitleDialogRow {
    return {
      id: "row-1",
      videoPath: "/show/ep1.mp4",
      subtitlePath: "/show/ep1.srt",
      displayPath: "ep1.srt",
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
    h.synthesizeSubtitleViaCore.mockResolvedValue("core-synthesize-1")
  })

  it("shows error and does not enqueue when folder is missing", async () => {
    render(<SynthesizeSubtitleDialog isOpen onClose={mockOnClose} rows={[eligibleRow()]} />)

    fireEvent.click(screen.getByTestId("synthesize-subtitle-dialog-confirm"))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Media folder is not available; cannot start synthesis.",
      )
    })
    expect(mockOnClose).not.toHaveBeenCalled()
    expect(h.synthesizeSubtitleViaCore).not.toHaveBeenCalled()
    expect(h.createJob).not.toHaveBeenCalled()
  })

  it("enqueues via Core without createJob and closes on success", async () => {
    render(
      <SynthesizeSubtitleDialog
        isOpen
        onClose={mockOnClose}
        rows={[eligibleRow()]}
        folder={platformFolder}
      />,
    )

    fireEvent.click(screen.getByTestId("synthesize-subtitle-dialog-confirm"))

    await waitFor(() => {
      expect(h.synthesizeSubtitleViaCore).toHaveBeenCalledTimes(1)
    })
    expect(h.createJob).not.toHaveBeenCalled()
    const arg = h.synthesizeSubtitleViaCore.mock.calls[0]![0]
    expect(arg.folder).toBe(platformFolder)
    expect(arg.videoPath).toBe(Path.toPlatformPath(Path.posix("/show/ep1.mp4")))
    expect(arg.subtitlePath).toBe(Path.toPlatformPath(Path.posix("/show/ep1.srt")))
    expect(arg.title).toBe("Episode 1")
    expect(arg.subtitleMode).toBe("soft")
    expect(arg.quality).toBe("medium")
    expect(mockOnClose).toHaveBeenCalledTimes(1)

    const jobs = useBackgroundJobsStore.getState().jobs
    expect(jobs).toHaveLength(1)
    expect(jobs[0]!.type).toBe("synthesize-subtitle")
    expect(jobs[0]!.status).toBe("pending")
  })

  it("does not close when selected rows are ineligible", async () => {
    render(
      <SynthesizeSubtitleDialog
        isOpen
        onClose={mockOnClose}
        folder={platformFolder}
        rows={[
          {
            id: "x",
            videoPath: "",
            subtitlePath: "",
            title: "No sub",
            eligible: false,
            disabledReason: "synthesizeSubtitleDialog.noSubtitleFile",
          },
        ]}
        defaultSelectedIds={["x"]}
      />,
    )

    const confirm = screen.getByTestId("synthesize-subtitle-dialog-confirm")
    if (!confirm.hasAttribute("disabled")) {
      fireEvent.click(confirm)
    }

    expect(h.synthesizeSubtitleViaCore).not.toHaveBeenCalled()
    expect(h.createJob).not.toHaveBeenCalled()
    expect(mockOnClose).not.toHaveBeenCalled()
  })

  it("skips ineligible rows but enqueues eligible ones", async () => {
    render(
      <SynthesizeSubtitleDialog
        isOpen
        onClose={mockOnClose}
        folder={platformFolder}
        rows={[
          {
            id: "a",
            videoPath: "",
            subtitlePath: "",
            title: "Bad",
            eligible: false,
            disabledReason: "synthesizeSubtitleDialog.noSubtitleFile",
          },
          eligibleRow({
            id: "b",
            title: "Good",
            videoPath: "/ok.mp4",
            subtitlePath: "/ok.srt",
            displayPath: "ok.srt",
          }),
        ]}
      />,
    )

    fireEvent.click(screen.getByTestId("synthesize-subtitle-dialog-confirm"))

    await waitFor(() => {
      expect(h.synthesizeSubtitleViaCore).toHaveBeenCalledTimes(1)
    })
    expect(h.synthesizeSubtitleViaCore.mock.calls[0]![0].title).toBe("Good")
    expect(h.createJob).not.toHaveBeenCalled()
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })
})
