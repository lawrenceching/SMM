import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import type { ComponentProps } from "react"
import { FormatConverterDialog } from "./format-converter-dialog"
import type { TrackProperties } from "./types"

const createJobMock = vi.fn().mockResolvedValue("job-123")

vi.mock("@/hooks/useJobManager", () => ({
  useJobManager: () => ({
    createJob: createJobMock,
  }),
}))

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { ns?: string; defaultValue?: string }) => {
      if (options?.ns === "common") {
        const common: Record<string, string> = { cancel: "Cancel" }
        return common[key] ?? key
      }
      const dialogs: Record<string, string> = {
        "formatConverter.title": "Format Converter",
        "formatConverter.description": "Convert video format",
        "formatConverter.sourceLabel": "Source",
        "formatConverter.outputFormatLabel": "Output format",
        "formatConverter.presetLabel": "Preset",
        "formatConverter.saveToLabel": "Save to",
        "formatConverter.outputFileNameLabel": "File name",
        "formatConverter.browse": "Browse",
        "formatConverter.start": "Start",
        "formatConverter.formatMp4H264": "MP4 H.264",
        "formatConverter.formatMp4H265": "MP4 H.265",
        "formatConverter.formatWebm": "WebM",
        "formatConverter.formatMkv": "MKV",
        "formatConverter.presetQuality": "Quality",
        "formatConverter.presetBalanced": "Balanced",
        "formatConverter.presetSpeed": "Speed",
        "formatConverter.errors.encoderNotFound":
          "Required video or audio encoder is not available in your ffmpeg build.",
        "formatConverter.errors.unknown":
          "Conversion failed due to an unexpected error.",
      }
      return dialogs[key] ?? options?.defaultValue ?? key
    },
  }),
}))

const sampleTrack: TrackProperties = {
  id: 1,
  path: "/media/videos/sample.mkv",
  filePath: "/media/videos/sample.mkv",
  title: "sample.mkv",
  duration: 125,
}

describe("FormatConverterDialog", () => {
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    createJobMock.mockResolvedValue("job-123")
  })

  function renderDialog(override: Partial<ComponentProps<typeof FormatConverterDialog>> = {}) {
    return render(
      <FormatConverterDialog
        isOpen
        onClose={onClose}
        track={sampleTrack}
        onOpenFilePicker={vi.fn()}
        {...override}
      />
    )
  }

  it("disables form controls and shows spinner on Start while conversion is pending", () => {
    createJobMock.mockImplementationOnce(() => new Promise(() => {}))
    renderDialog()

    fireEvent.click(screen.getByTestId("format-converter-start"))

    expect(screen.getByTestId("format-converter-format")).toBeDisabled()
    expect(screen.getByTestId("format-converter-preset")).toBeDisabled()
    expect(screen.getByTestId("format-converter-dir")).toBeDisabled()
    expect(screen.getByTestId("format-converter-filename")).toBeDisabled()
    expect(screen.getByTestId("format-converter-browse")).toBeDisabled()
    expect(screen.getByTestId("format-converter-cancel")).toBeDisabled()
    expect(screen.getByTestId("format-converter-start")).toBeDisabled()

    const startButton = screen.getByTestId("format-converter-start")
    expect(startButton.querySelector(".animate-spin")).toBeInTheDocument()
  })

  it("enables form controls and hides spinner when conversion is not pending", () => {
    renderDialog()

    expect(screen.getByTestId("format-converter-format")).not.toBeDisabled()
    expect(screen.getByTestId("format-converter-preset")).not.toBeDisabled()
    expect(screen.getByTestId("format-converter-dir")).not.toBeDisabled()
    expect(screen.getByTestId("format-converter-filename")).not.toBeDisabled()
    expect(screen.getByTestId("format-converter-browse")).not.toBeDisabled()
    expect(screen.getByTestId("format-converter-cancel")).not.toBeDisabled()
    expect(screen.getByTestId("format-converter-start")).not.toBeDisabled()

    const startButton = screen.getByTestId("format-converter-start")
    expect(startButton.querySelector(".animate-spin")).not.toBeInTheDocument()
  })

  it("resets converting state when isOpen becomes false", () => {
    const { rerender } = render(
      <FormatConverterDialog isOpen onClose={onClose} track={sampleTrack} />
    )
    rerender(
      <FormatConverterDialog isOpen={false} onClose={onClose} track={sampleTrack} />
    )
    // No crash on close
  })

  it("calls createJob with ffmpeg-convert data and closes dialog on Start", async () => {
    renderDialog()

    fireEvent.click(screen.getByTestId("format-converter-start"))

    await waitFor(() => {
      expect(createJobMock).toHaveBeenCalledTimes(1)
    })
    const jobArg = createJobMock.mock.calls[0][0]
    expect(jobArg.type).toBe("ffmpeg-convert")
    expect(jobArg.data.outputFormat).toBe("mp4h264")
    expect(jobArg.data.preset).toBe("balanced")
    expect(onClose).toHaveBeenCalled()
  })
})
