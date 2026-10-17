import { describe, it, expect, vi, beforeEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import React from "react"
import { toast } from "sonner"
import { Path } from "@smm/utils/path"
import { SubtitleTranslationDialog } from "./SubtitleTranslationDialog"
import type { SubtitleTranslationDialogRow } from "./types"
import { useVideoCaptionerStatus } from "@/hooks/useVideoCaptionerStatus"
import { useBackgroundJobsStore } from "@/stores/backgroundJobsStore"

const h = vi.hoisted(() => ({
  createJob: vi.fn().mockResolvedValue("orch-id"),
  translateSubtitleViaCore: vi.fn().mockResolvedValue("core-translate-1"),
  pollSubtitleJob: vi.fn().mockResolvedValue({
    kind: "translate-subtitle",
    id: "core-translate-1",
    type: "translate-subtitle",
    folder: "C:\\media\\music",
    subtitlePath: "C:\\media\\music\\track1.srt",
    translator: "google",
    targetLanguage: "zh-Hans",
    status: "succeeded",
    progress: 100,
    createdAt: 0,
    updatedAt: 0,
  }),
}))

vi.mock("@/api/translateSubtitle", () => ({
  translateSubtitleViaCore: h.translateSubtitleViaCore,
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

vi.mock("@/hooks/userConfig", () => ({
  useConfig: () => ({
    userConfig: {
      aiProviders: [],
      selectedAIProvider: undefined,
    },
  }),
}))

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        cancel: "Cancel",
        "subtitleTranslationDialog.title": "Translate Subtitles",
        "subtitleTranslationDialog.description": "Description",
        "subtitleTranslationDialog.confirm": "Confirm",
        "subtitleTranslationDialog.selectAllAria": "Select all",
        "subtitleTranslationDialog.columns.filePath": "File",
        "subtitleTranslationDialog.noFiles": "No files",
        "subtitleTranslationDialog.translator": "Translator",
        "subtitleTranslationDialog.translators.google": "Google",
        "subtitleTranslationDialog.translators.llm": "LLM",
        "subtitleTranslationDialog.targetLanguage": "Target language",
        "subtitleTranslationDialog.reflect": "Reflect",
        "subtitleTranslationDialog.layout": "Layout",
        "subtitleTranslationDialog.layoutOptional": "Optional",
        "subtitleTranslationDialog.layoutNone": "Default",
        "subtitleTranslationDialog.layout.target-above": "Target above",
        "subtitleTranslationDialog.layout.source-above": "Source above",
        "subtitleTranslationDialog.layout.target-only": "Target only",
        "subtitleTranslationDialog.layout.source-only": "Source only",
        "subtitleTranslationDialog.noSubtitleFile": "No subtitle file",
      }
      return map[key] ?? key
    },
  }),
}))

vi.mock("sonner")

describe("SubtitleTranslationDialog", () => {
  const mockOnClose = vi.fn()
  const platformFolder = "C:\\media\\music"

  function eligibleRow(
    overrides?: Partial<SubtitleTranslationDialogRow>,
  ): SubtitleTranslationDialogRow {
    return {
      id: "row-1",
      path: "/music/track1.srt",
      displayPath: "track1.srt",
      title: "My Track",
      mediaPath: "/music/track1.mp3",
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
    h.translateSubtitleViaCore.mockResolvedValue("core-translate-1")
  })

  it("shows error and does not enqueue when folder is missing", async () => {
    render(<SubtitleTranslationDialog isOpen onClose={mockOnClose} rows={[eligibleRow()]} />)

    fireEvent.click(screen.getByTestId("subtitle-translation-dialog-confirm"))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Media folder is not available; cannot start translation.",
      )
    })
    expect(mockOnClose).not.toHaveBeenCalled()
    expect(h.translateSubtitleViaCore).not.toHaveBeenCalled()
    expect(h.createJob).not.toHaveBeenCalled()
  })

  it("enqueues via Core without createJob and closes on success", async () => {
    render(
      <SubtitleTranslationDialog
        isOpen
        onClose={mockOnClose}
        rows={[eligibleRow()]}
        folder={platformFolder}
      />,
    )

    fireEvent.click(screen.getByTestId("subtitle-translation-dialog-confirm"))

    await waitFor(() => {
      expect(h.translateSubtitleViaCore).toHaveBeenCalledTimes(1)
    })
    expect(h.createJob).not.toHaveBeenCalled()
    const arg = h.translateSubtitleViaCore.mock.calls[0]![0]
    expect(arg.folder).toBe(platformFolder)
    expect(arg.subtitlePath).toBe(Path.toPlatformPath(Path.posix("/music/track1.srt")))
    expect(arg.mediaPath).toBe(Path.toPlatformPath(Path.posix("/music/track1.mp3")))
    expect(arg.title).toBe("My Track")
    expect(arg.translator).toBe("google")
    expect(arg.targetLanguage).toBe("zh-Hans")
    expect(arg).not.toHaveProperty("llm")
    expect(mockOnClose).toHaveBeenCalledTimes(1)

    const jobs = useBackgroundJobsStore.getState().jobs
    expect(jobs).toHaveLength(1)
    expect(jobs[0]!.type).toBe("translate-subtitle")
    expect(jobs[0]!.status).toBe("pending")
    expect(jobs[0]!.data).not.toHaveProperty("llm")
  })

  it("does not close when selected rows are ineligible", async () => {
    render(
      <SubtitleTranslationDialog
        isOpen
        onClose={mockOnClose}
        folder={platformFolder}
        rows={[
          {
            id: "x",
            path: "",
            title: "No sub",
            eligible: false,
            disabledReason: "subtitleTranslationDialog.noSubtitleFile",
          },
        ]}
        defaultSelectedIds={["x"]}
      />,
    )

    // Confirm may be disabled when no eligible rows — force path via empty selection outcome
    const confirm = screen.getByTestId("subtitle-translation-dialog-confirm")
    if (!confirm.hasAttribute("disabled")) {
      fireEvent.click(confirm)
    }

    expect(h.translateSubtitleViaCore).not.toHaveBeenCalled()
    expect(h.createJob).not.toHaveBeenCalled()
    expect(mockOnClose).not.toHaveBeenCalled()
  })

  it("skips ineligible rows but enqueues eligible ones", async () => {
    render(
      <SubtitleTranslationDialog
        isOpen
        onClose={mockOnClose}
        folder={platformFolder}
        rows={[
          {
            id: "a",
            path: "",
            title: "Bad",
            eligible: false,
            disabledReason: "subtitleTranslationDialog.noSubtitleFile",
          },
          eligibleRow({ id: "b", title: "Good", path: "/ok.srt", displayPath: "ok.srt" }),
        ]}
      />,
    )

    fireEvent.click(screen.getByTestId("subtitle-translation-dialog-confirm"))

    await waitFor(() => {
      expect(h.translateSubtitleViaCore).toHaveBeenCalledTimes(1)
    })
    expect(h.translateSubtitleViaCore.mock.calls[0]![0].title).toBe("Good")
    expect(h.createJob).not.toHaveBeenCalled()
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })
})
