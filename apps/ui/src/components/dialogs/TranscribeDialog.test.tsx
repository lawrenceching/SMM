import { describe, it, expect, vi, beforeEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import React from "react"
import { toast } from "sonner"
import { TranscribeDialog } from "./TranscribeDialog"
import type { TranscribeDialogRow } from "./types"

const h = vi.hoisted(() => ({
  mockTranscribeTracksWithFeedback: vi.fn().mockResolvedValue(undefined),
  createTranscribeJob: vi.fn(() => "job-1"),
  markTranscribeJobRunning: vi.fn(),
  markTranscribeJobSucceeded: vi.fn(),
  markTranscribeJobFailed: vi.fn(),
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
        "transcribe.columns.status": "Status",
        "transcribe.status.pending": "Pending",
        "transcribe.status.running": "Running",
        "transcribe.status.completed": "Done",
        "transcribe.status.failed": "Failed",
        "transcribe.noFiles": "No files",
      }
      return dialogs[key] ?? key
    },
  }),
}))

vi.mock("@/lib/transcribeFeedback", () => ({
  transcribeTracksWithFeedback: h.mockTranscribeTracksWithFeedback,
}))

vi.mock("@/stores/backgroundJobsStore", () => ({
  useBackgroundJobsStore: () => ({
    createTranscribeJob: h.createTranscribeJob,
    markTranscribeJobRunning: h.markTranscribeJobRunning,
    markTranscribeJobSucceeded: h.markTranscribeJobSucceeded,
    markTranscribeJobFailed: h.markTranscribeJobFailed,
  }),
}))

vi.mock("sonner")

describe("TranscribeDialog", () => {
  const mockOnClose = vi.fn()

  function rowWithPath(overrides?: Partial<TranscribeDialogRow>): TranscribeDialogRow {
    return {
      id: "row-1",
      path: "/music/track1.mp3",
      displayPath: "track1.mp3",
      status: "pending",
      title: "My Track",
      ...overrides,
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    h.mockTranscribeTracksWithFeedback.mockResolvedValue(undefined)
    h.createTranscribeJob.mockReturnValue("job-1")
    vi.mocked(toast.error).mockImplementation(() => "id")
    vi.mocked(toast.success).mockImplementation(() => "id")
  })

  it("closes and starts transcribe with selected rows that have paths", async () => {
    render(<TranscribeDialog isOpen onClose={mockOnClose} rows={[rowWithPath()]} />)

    fireEvent.click(screen.getByTestId("transcribe-dialog-confirm"))

    expect(mockOnClose).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(h.mockTranscribeTracksWithFeedback).toHaveBeenCalledWith(
        [{ title: "My Track", path: "/music/track1.mp3" }],
        {
          createTranscribeJob: h.createTranscribeJob,
          markTranscribeJobRunning: h.markTranscribeJobRunning,
          markTranscribeJobSucceeded: h.markTranscribeJobSucceeded,
          markTranscribeJobFailed: h.markTranscribeJobFailed,
        },
      )
    })
  })

  it("uses basename when title is empty or whitespace", async () => {
    render(
      <TranscribeDialog
        isOpen
        onClose={mockOnClose}
        rows={[rowWithPath({ title: "   " })]}
      />,
    )

    fireEvent.click(screen.getByTestId("transcribe-dialog-confirm"))

    await waitFor(() => {
      expect(h.mockTranscribeTracksWithFeedback).toHaveBeenCalledWith(
        [{ title: "track1.mp3", path: "/music/track1.mp3" }],
        expect.objectContaining({
          createTranscribeJob: h.createTranscribeJob,
        }),
      )
    })
  })

  it("does not close or transcribe when selected rows have no file path", () => {
    render(
      <TranscribeDialog
        isOpen
        onClose={mockOnClose}
        rows={[{ id: "x", path: "", displayPath: "", status: "pending", title: "No file" }]}
      />,
    )

    fireEvent.click(screen.getByTestId("transcribe-dialog-confirm"))

    expect(mockOnClose).not.toHaveBeenCalled()
    expect(h.mockTranscribeTracksWithFeedback).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith(
      'Track "No file" does not have an associated file path.',
    )
  })

  it("skips rows without path but still transcribes remaining valid selections", async () => {
    render(
      <TranscribeDialog
        isOpen
        onClose={mockOnClose}
        rows={[
          { id: "a", path: "", status: "pending", title: "Bad" },
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
    expect(mockOnClose).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(h.mockTranscribeTracksWithFeedback).toHaveBeenCalledWith(
        [{ title: "Good", path: "/ok.mp3" }],
        expect.objectContaining({
          createTranscribeJob: h.createTranscribeJob,
          markTranscribeJobRunning: h.markTranscribeJobRunning,
          markTranscribeJobSucceeded: h.markTranscribeJobSucceeded,
          markTranscribeJobFailed: h.markTranscribeJobFailed,
        }),
      )
    })
  })
})
