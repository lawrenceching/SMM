import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import type { ComponentProps } from "react"
import { Path } from "@smm/utils/path"
import { FormatConverterDialog } from "./format-converter-dialog"
import type { TrackProperties } from "./types"
import { useBackgroundJobsStore } from "@/stores/backgroundJobsStore"

const h = vi.hoisted(() => ({
  createJob: vi.fn().mockResolvedValue("orch-id"),
  ffmpegConvertViaCore: vi.fn().mockResolvedValue({ id: "core-convert-1" }),
  pollFfmpegJob: vi.fn().mockResolvedValue({
    kind: "ffmpeg-convert",
    id: "core-convert-1",
    status: "succeeded",
    progress: 100,
  }),
}))

vi.mock("@/api/ffmpegConvert", () => ({
  ffmpegConvertViaCore: h.ffmpegConvertViaCore,
}))

vi.mock("@/lib/pollFfmpegJob", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/pollFfmpegJob")>()
  return {
    ...actual,
    pollFfmpegJob: h.pollFfmpegJob,
  }
})

vi.mock("@/hooks/useJobManager", () => ({
  useJobManager: () => ({
    createJob: h.createJob,
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
        "formatConverter.formatAvif": "AVIF",
        "formatConverter.formatWebp": "WebP",
        "formatConverter.formatApng": "APNG",
        "formatConverter.presetQuality": "Quality",
        "formatConverter.presetBalanced": "Balanced",
        "formatConverter.presetSpeed": "Speed",
        "formatConverter.imageModeLabel": "Output mode",
        "formatConverter.imageModeAnimated": "Animated",
        "formatConverter.imageModeStill": "Still",
        "formatConverter.imageFpsLabel": "FPS",
        "formatConverter.imageMaxWidthLabel": "Max width",
        "formatConverter.imageMaxWidthHint": "0 keeps source width",
        "formatConverter.imageLoopLabel": "Loop",
        "formatConverter.imageLoopOnce": "Once",
        "formatConverter.imageLoopInfinite": "Infinite",
        "formatConverter.webpLosslessLabel": "Lossless",
        "formatConverter.webpQualityLabel": "Quality",
        "formatConverter.webpPresetLabel": "Preset",
        "formatConverter.webpPresetDefault": "Default",
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
    h.createJob.mockResolvedValue("orch-id")
    h.ffmpegConvertViaCore.mockResolvedValue({ id: "core-convert-1" })
    useBackgroundJobsStore.setState({ jobs: [] })
    Element.prototype.scrollIntoView = vi.fn()
  })

  function renderDialog(override: Partial<ComponentProps<typeof FormatConverterDialog>> = {}) {
    return render(
      <FormatConverterDialog
        isOpen
        onClose={onClose}
        track={sampleTrack}
        onOpenFilePicker={vi.fn()}
        {...override}
      />,
    )
  }

  it("disables form controls and shows spinner on Start while conversion is pending", () => {
    h.ffmpegConvertViaCore.mockImplementationOnce(() => new Promise(() => {}))
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
      <FormatConverterDialog isOpen onClose={onClose} track={sampleTrack} />,
    )
    rerender(
      <FormatConverterDialog isOpen={false} onClose={onClose} track={sampleTrack} />,
    )
  })

  it("enqueues via Core without createJob and closes dialog on Start", async () => {
    renderDialog()

    fireEvent.click(screen.getByTestId("format-converter-start"))

    await waitFor(() => {
      expect(h.ffmpegConvertViaCore).toHaveBeenCalledTimes(1)
    })
    expect(h.createJob).not.toHaveBeenCalled()

    const arg = h.ffmpegConvertViaCore.mock.calls[0]![0]
    expect(arg.outputFormat).toBe("mp4h264")
    expect(arg.preset).toBe("balanced")
    expect(arg.imageOptions).toBeUndefined()
    expect(arg.inputPath).toBe(Path.toPlatformPath(Path.posix("/media/videos/sample.mkv")))
    expect(arg.folder).toBe(Path.toPlatformPath(Path.posix("/media/videos")))
    expect(arg.title).toBe("sample.mkv")
    expect(onClose).toHaveBeenCalled()

    const jobs = useBackgroundJobsStore.getState().jobs
    expect(jobs).toHaveLength(1)
    expect(jobs[0]!.type).toBe("ffmpeg-convert")
    expect(jobs[0]!.status).toBe("pending")
    expect(h.pollFfmpegJob).toHaveBeenCalledWith(
      "core-convert-1",
      "ffmpeg-convert",
      expect.any(Function),
    )
  })

  it("shows image options and hides video preset when WebP is selected", async () => {
    renderDialog()

    expect(screen.getByTestId("format-converter-preset")).toBeInTheDocument()
    expect(screen.queryByTestId("format-converter-image-options")).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId("format-converter-format"))
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "WebP" })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole("option", { name: "WebP" }))

    expect(screen.queryByTestId("format-converter-preset")).not.toBeInTheDocument()
    expect(screen.getByTestId("format-converter-image-options")).toBeInTheDocument()
    expect(screen.getByTestId("format-converter-webp-quality")).toBeInTheDocument()
  })

  it("passes imageOptions when converting to WebP", async () => {
    renderDialog()

    fireEvent.click(screen.getByTestId("format-converter-format"))
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "WebP" })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole("option", { name: "WebP" }))
    fireEvent.click(screen.getByTestId("format-converter-start"))

    await waitFor(() => {
      expect(h.ffmpegConvertViaCore).toHaveBeenCalledTimes(1)
    })
    expect(h.createJob).not.toHaveBeenCalled()
    const arg = h.ffmpegConvertViaCore.mock.calls[0]![0]
    expect(arg.outputFormat).toBe("webp")
    expect(arg.imageOptions).toMatchObject({
      mode: "animated",
      fps: 10,
      webp: { quality: 80, lossless: false, preset: "default", loop: "once" },
    })
  })
})
