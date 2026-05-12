/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import React, { type ComponentProps } from "react"
import { UISynthesizeSubtitleDialog } from "./UISynthesizeSubtitleDialog"
import type { SynthesizeSubtitleDialogRow } from "./types"

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
      }
      return map[key] ?? key
    },
  }),
}))

describe("UISynthesizeSubtitleDialog", () => {
  const mockOnClose = vi.fn()
  const mockOnConfirm = vi.fn()

  const eligibleRow: SynthesizeSubtitleDialogRow = {
    id: "/m/a.mp4\n/m/a.srt",
    videoPath: "/m/a.mp4",
    subtitlePath: "/m/a.srt",
    displayPath: "a.srt",
    title: "Episode",
    eligible: true,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it("disables confirm when VideoCaptioner is unavailable", () => {
    const props = {
      isOpen: true,
      onClose: mockOnClose,
      rows: [eligibleRow],
      onConfirm: mockOnConfirm,
      videoCaptionerAvailable: false,
    } satisfies ComponentProps<typeof UISynthesizeSubtitleDialog>

    render(<UISynthesizeSubtitleDialog {...props} />)
    expect(screen.getByTestId("synthesize-subtitle-dialog-confirm")).toBeDisabled()
  })

  it("calls onConfirm with defaults for selected eligible rows", async () => {
    const props = {
      isOpen: true,
      onClose: mockOnClose,
      rows: [eligibleRow],
      onConfirm: mockOnConfirm,
      videoCaptionerAvailable: true,
    } satisfies ComponentProps<typeof UISynthesizeSubtitleDialog>

    render(<UISynthesizeSubtitleDialog {...props} />)
    fireEvent.click(screen.getByTestId("synthesize-subtitle-dialog-confirm"))
    await waitFor(() => {
      expect(mockOnConfirm).toHaveBeenCalledWith({
        selectedIds: [eligibleRow.id],
        subtitleMode: "soft",
        quality: "medium",
      })
    })
  })

  it("uses subtitle mode and quality from localStorage when dialog opens", async () => {
    localStorage.setItem("synthesizeSubtitle.subtitleMode", "hard")
    localStorage.setItem("synthesizeSubtitle.quality", "high")

    const props = {
      isOpen: true,
      onClose: mockOnClose,
      rows: [eligibleRow],
      onConfirm: mockOnConfirm,
      videoCaptionerAvailable: true,
    } satisfies ComponentProps<typeof UISynthesizeSubtitleDialog>

    render(<UISynthesizeSubtitleDialog {...props} />)
    fireEvent.click(screen.getByTestId("synthesize-subtitle-dialog-confirm"))
    await waitFor(() => {
      expect(mockOnConfirm).toHaveBeenCalledWith({
        selectedIds: [eligibleRow.id],
        subtitleMode: "hard",
        quality: "high",
      })
    })
  })
})
