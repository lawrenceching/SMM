import { describe, it, expect, vi, beforeEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import React, { type ComponentProps } from "react"
import { UITranscribeDialog } from "./UITranscribeDialog"
import type { TranscribeDialogRow } from "./types"

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
        "transcribe.asr.label": "ASR engine",
        "transcribe.asr.bijian": "Bijian",
        "transcribe.asr.jianying": "Jianying",
        "transcribe.asr.whisperCpp": "Whisper CPP",
      }
      return dialogs[key] ?? key
    },
  }),
}))

describe("UITranscribeDialog", () => {
  const mockOnClose = vi.fn()
  const mockOnConfirm = vi.fn()

  const sampleRows: TranscribeDialogRow[] = [
    {
      id: "row-1",
      path: "/music/track1.mp3",
      displayPath: "track1.mp3",
      status: "pending",
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("disables the confirm button when no files are selected", () => {
    const props = {
      isOpen: true,
      onClose: mockOnClose,
      rows: sampleRows,
      defaultSelectedIds: [] as string[],
      onConfirm: mockOnConfirm,
    } satisfies ComponentProps<typeof UITranscribeDialog>

    render(
      <React.Fragment>
        <UITranscribeDialog {...props} />
      </React.Fragment>
    )

    expect(screen.getByTestId("transcribe-dialog-confirm")).toBeDisabled()
  })

  it("calls onConfirm with default ASR when confirming", async () => {
    const props = {
      isOpen: true,
      onClose: mockOnClose,
      rows: sampleRows,
      onConfirm: mockOnConfirm,
    } satisfies ComponentProps<typeof UITranscribeDialog>

    render(
      <React.Fragment>
        <UITranscribeDialog {...props} />
      </React.Fragment>,
    )

    expect(screen.queryByTestId("transcribe-dialog-asr")).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId("transcribe-dialog-confirm"))
    await waitFor(() => {
      expect(mockOnConfirm).toHaveBeenCalledWith({
        selectedIds: ["row-1"],
        asr: "bijian",
      })
    })
  })

  it("shows ASR select when asrOptionsEnabled is true", () => {
    const props = {
      isOpen: true,
      onClose: mockOnClose,
      rows: sampleRows,
      asrOptionsEnabled: true,
      onConfirm: mockOnConfirm,
    } satisfies ComponentProps<typeof UITranscribeDialog>

    render(
      <React.Fragment>
        <UITranscribeDialog {...props} />
      </React.Fragment>,
    )

    expect(screen.getByTestId("transcribe-dialog-asr")).toBeInTheDocument()
  })
})
