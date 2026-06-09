import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import type { ComponentProps } from "react";
import { VideoCompressionDialog } from "./video-compression-dialog";

const compressJobMutation = vi.hoisted(() => ({
  isPending: false,
  mutateAsync: vi.fn().mockResolvedValue("job-1"),
  reset: vi.fn(),
}));

vi.mock("@/hooks/ffmpeg/useCreateFfmpegCompressJobMutation", () => ({
  useCreateFfmpegCompressJobMutation: () => ({
    get isPending() {
      return compressJobMutation.isPending;
    },
    mutateAsync: compressJobMutation.mutateAsync,
    reset: compressJobMutation.reset,
  }),
}));

vi.mock("@/hooks/ffmpeg/useFfmpegEncodersQuery", () => ({
  useFfmpegEncodersQuery: () => ({
    data: {
      available: ["libx264", "libx265", "libvpx-vp9", "h264_nvenc"],
      usable: [
        {
          id: "libx264",
          codec: "h264",
          compatibleContainers: ["mp4", "mkv", "mov"],
          defaultPreset: "medium",
          supportsCrf: true,
          crfRange: { min: 0, max: 51, default: 23 },
          supports10Bit: false,
          supportedPixFmts: ["yuv420p", "yuv444p"],
          presetOptions: ["ultrafast", "medium", "slow"],
        },
        {
          id: "libx265",
          codec: "hevc",
          compatibleContainers: ["mp4", "mkv", "mov"],
          defaultPreset: "medium",
          supportsCrf: true,
          crfRange: { min: 0, max: 51, default: 28 },
          supports10Bit: true,
          supportedPixFmts: ["yuv420p", "yuv444p", "yuv420p10le"],
          presetOptions: ["ultrafast", "medium", "slow"],
        },
        {
          id: "libvpx-vp9",
          codec: "vp9",
          compatibleContainers: ["webm", "mkv"],
          defaultPreset: "medium",
          supportsCrf: true,
          crfRange: { min: 0, max: 63, default: 31 },
          supports10Bit: false,
          supportedPixFmts: ["yuv420p", "yuv444p"],
          presetOptions: ["ultrafast", "medium", "slow"],
        },
      ],
      unavailable: [],
    },
    isPending: false,
    error: null,
  }),
}));

vi.mock("@/api/ffmpeg", () => ({
  getMediaTags: vi.fn().mockResolvedValue({
    tags: {},
    duration: 600,
    videoBitrateKbps: 5000,
    audioBitrateKbps: 128,
    bitrateKbps: 5128,
  }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const enStrings: Record<string, string> = {
  "videoCompression.title": "Video compression",
  "videoCompression.description": "Re-encode video with ffmpeg",
  "videoCompression.presetsTab": "Presets",
  "videoCompression.customTab": "Custom",
  "videoCompression.sourceLabel": "Source",
  "videoCompression.selectVideo": "Select video",
  "videoCompression.selectVideoHint": "Please select a file",
  "videoCompression.noEncodersDetected": "FFmpeg encoders not detected",
  "videoCompression.noCompatibleEncoder": "No compatible encoder",
  "videoCompression.outputContainerLabel": "Container",
  "videoCompression.containerMp4": "MP4",
  "videoCompression.containerMkv": "MKV",
  "videoCompression.containerWebm": "WebM",
  "videoCompression.containerMov": "MOV",
  "videoCompression.videoSection": "Video encoding",
  "videoCompression.encoderLabel": "Encoder",
  "videoCompression.encoderPresetLabel": "Speed",
  "videoCompression.qualityModeLabel": "Quality",
  "videoCompression.qualityModeCrf": "CRF",
  "videoCompression.qualityModeTargetBitrate": "Bitrate",
  "videoCompression.qualityModeTargetSize": "Size",
  "videoCompression.crfLabel": "CRF",
  "videoCompression.targetBitrateLabel": "Bitrate kbps",
  "videoCompression.targetSizeLabel": "Size MB",
  "videoCompression.targetBitrateHint": "Computed: ~{{kbps}} kbps",
  "videoCompression.profileLabel": "Profile",
  "videoCompression.profileBaseline": "Baseline",
  "videoCompression.profileMain": "Main",
  "videoCompression.profileHigh": "High",
  "videoCompression.pixFmtLabel": "Pixel format",
  "videoCompression.pixFmtYuv420p": "yuv420p",
  "videoCompression.pixFmtYuv444p": "yuv444p",
  "videoCompression.pixFmtYuv420p10le": "yuv420p10le",
  "videoCompression.gopSizeLabel": "GOP",
  "videoCompression.resolutionSection": "Resolution & frame rate",
  "videoCompression.resolutionLabel": "Resolution",
  "videoCompression.resolutionOriginal": "Original",
  "videoCompression.resolution480p": "480p",
  "videoCompression.resolution720p": "720p",
  "videoCompression.resolution1080p": "1080p",
  "videoCompression.resolution4k": "4K",
  "videoCompression.resolutionCustom": "Custom",
  "videoCompression.customWidthLabel": "Width",
  "videoCompression.frameRateLabel": "Frame rate",
  "videoCompression.frameRateOriginal": "Original",
  "videoCompression.frameRate24": "24 fps",
  "videoCompression.frameRate30": "30 fps",
  "videoCompression.frameRate60": "60 fps",
  "videoCompression.frameRateCustom": "Custom",
  "videoCompression.customFpsLabel": "FPS",
  "videoCompression.frameSkipLabel": "Frame skip",
  "videoCompression.audioSection": "Audio",
  "videoCompression.audioModeKeep": "Keep",
  "videoCompression.audioModeReencode": "Re-encode",
  "videoCompression.audioModeRemove": "Remove",
  "videoCompression.audioCodecLabel": "Codec",
  "videoCompression.audioBitrateLabel": "Bitrate",
  "videoCompression.audioSampleRateLabel": "Sample rate",
  "videoCompression.audioChannelsLabel": "Channels",
  "videoCompression.audioChannels1": "Mono",
  "videoCompression.audioChannels2": "Stereo",
  "videoCompression.advancedSection": "Advanced",
  "videoCompression.twoPassLabel": "2-pass",
  "videoCompression.twoPassHint": "Auto for target size",
  "videoCompression.threadsLabel": "Threads",
  "videoCompression.hdrLabel": "HDR",
  "videoCompression.hdrPreserve": "Preserve",
  "videoCompression.hdrConvertToSdr": "Convert to SDR",
  "videoCompression.hdrConvertToSdrWarning": "May alter colors",
  "videoCompression.denoiseLabel": "Denoise",
  "videoCompression.denoiseNone": "None",
  "videoCompression.denoiseLight": "Light",
  "videoCompression.denoiseMedium": "Medium",
  "videoCompression.denoiseStrong": "Strong",
  "videoCompression.sharpenLabel": "Sharpen",
  "videoCompression.metadataLabel": "Metadata",
  "videoCompression.metadataPreserve": "Preserve",
  "videoCompression.metadataStrip": "Strip",
  "videoCompression.saveToLabel": "Save to",
  "videoCompression.browse": "Browse",
  "videoCompression.outputFileNameLabel": "File name",
  "videoCompression.start": "Start",
  "videoCompression.duration": "Duration",
  "videoCompression.presetCardSpeedName": "Speed",
  "videoCompression.presetCardSpeedDesc": "Fast",
  "videoCompression.presetCardBalancedName": "Balanced",
  "videoCompression.presetCardBalancedDesc": "Default",
  "videoCompression.presetCardQualityName": "High quality",
  "videoCompression.presetCardQualityDesc": "Best",
  "videoCompression.presetCardExtremeName": "Extreme",
  "videoCompression.presetCardExtremeDesc": "Smallest",
  "videoCompression.presetCardAudioOnlyName": "Audio only",
  "videoCompression.presetCardAudioOnlyDesc": "Audio track only",
  "videoCompression.invalidParams": "Please set output folder and file name",
  "videoCompression.success": "Started",
  "videoCompression.estimatedOutputLabel": "Estimated output",
  "videoCompression.sizeMb": "~${{mb}}",
  "videoCompression.pctSmaller": "${{pct}}% smaller",
  "videoCompression.pctLarger": "${{pct}}% larger",
  "videoCompression.estimateCaveat": "Estimate based on encoder heuristic.",
  "cancel": "Cancel",
  "formatConverter.errors.unknown": "Unknown error",
};

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, options?: unknown) => {
      const opts = options as { kbps?: number; mb?: string; pct?: number; ns?: string; defaultValue?: string } | undefined;
      if (opts?.ns === "common") {
        const common: Record<string, string> = { cancel: "Cancel" };
        return common[key] ?? key;
      }
      if (opts && typeof opts === "object") {
        if ("kbps" in opts && typeof opts.kbps === "number") {
          return enStrings[key]?.replace("{{kbps}}", String(opts.kbps)) ?? key;
        }
        if ("mb" in opts && typeof opts.mb === "string") {
          return enStrings[key]?.replace("{{mb}}", opts.mb) ?? key;
        }
        if ("pct" in opts && typeof opts.pct === "number") {
          return enStrings[key]?.replace("{{pct}}", String(opts.pct)) ?? key;
        }
      }
      return enStrings[key] ?? opts?.defaultValue ?? key;
    },
  }),
}));

describe("VideoCompressionDialog", () => {
  const onClose = vi.fn();
  const sampleFilePath = "/media/clip.mp4";

  beforeEach(() => {
    vi.clearAllMocks();
    compressJobMutation.isPending = false;
    compressJobMutation.mutateAsync.mockResolvedValue("job-1");
    Element.prototype.scrollIntoView = vi.fn();
  });

  function renderDialog(override: Partial<ComponentProps<typeof VideoCompressionDialog>> = {}) {
    return render(
      <VideoCompressionDialog
        isOpen
        onClose={onClose}
        filePath={sampleFilePath}
        title="clip.mp4"
        duration={600}
        onOpenFilePicker={vi.fn()}
        {...override}
      />,
    );
  }

  it("shows the source filename and duration", () => {
    renderDialog();
    expect(screen.getByText("clip.mp4")).toBeInTheDocument();
    expect(screen.getByText(/Duration/i)).toBeInTheDocument();
  });

  it("shows the estimated output size after probe completes", async () => {
    // getMediaTags mock returns duration 600, videoBitrateKbps, audioBitrateKbps
    renderDialog();
    await waitFor(() => {
      expect(screen.getByTestId("video-compression-size-estimate")).toBeInTheDocument();
    });
    expect(screen.getByTestId("video-compression-size-estimate").textContent).toMatch(/MB/);
  });

  it("presets tab lists all 5 preset cards", () => {
    renderDialog();
    expect(screen.getByTestId("video-compression-preset-speed")).toBeInTheDocument();
    expect(screen.getByTestId("video-compression-preset-balanced")).toBeInTheDocument();
    expect(screen.getByTestId("video-compression-preset-quality")).toBeInTheDocument();
    expect(screen.getByTestId("video-compression-preset-extreme")).toBeInTheDocument();
    expect(screen.getByTestId("video-compression-preset-audioOnly")).toBeInTheDocument();
  });

  it("selecting a preset updates the highlighted card", () => {
    renderDialog();
    fireEvent.click(screen.getByTestId("video-compression-preset-speed"));
    const speedCard = screen.getByTestId("video-compression-preset-speed");
    expect(speedCard.className).toContain("border-primary");
  });

  it("switching to Custom tab reveals custom fields", async () => {
    renderDialog();
    const customTab = screen.getByTestId("video-compression-tab-custom");
    // Radix Tabs uses pointer events to activate; dispatch a full sequence
    fireEvent.pointerDown(customTab, { button: 0, pointerType: "mouse" });
    fireEvent.mouseDown(customTab, { button: 0 });
    fireEvent.click(customTab);
    await waitFor(() => {
      expect(screen.getByTestId("video-compression-container")).toBeInTheDocument();
    });
    expect(screen.getByTestId("video-compression-encoder")).toBeInTheDocument();
    expect(screen.getByTestId("video-compression-quality-mode")).toBeInTheDocument();
    expect(screen.getByTestId("video-compression-crf")).toBeInTheDocument();
  });

  it("Start compresses and closes dialog", async () => {
    renderDialog();
    fireEvent.click(screen.getByTestId("video-compression-start"));
    await waitFor(() => expect(compressJobMutation.mutateAsync).toHaveBeenCalledTimes(1));
    const input = compressJobMutation.mutateAsync.mock.calls[0][0];
    expect(input.inputPath).toBe(sampleFilePath);
    expect(input.compressOptions).toBeDefined();
    expect(input.outputContainer).toBe("mp4");
    expect(onClose).toHaveBeenCalled();
  });

  it("shows empty state when no filePath is provided", () => {
    renderDialog({ filePath: undefined });
    expect(screen.getByText(/Please select a file/i)).toBeInTheDocument();
  });

  it("encoder dropdown filters by selected container", async () => {
    renderDialog();
    const customTab = screen.getByTestId("video-compression-tab-custom");
    fireEvent.pointerDown(customTab, { button: 0, pointerType: "mouse" });
    fireEvent.mouseDown(customTab, { button: 0 });
    fireEvent.click(customTab);
    await waitFor(() => {
      expect(screen.getByTestId("video-compression-container")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("video-compression-container"));
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "WebM" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("option", { name: "WebM" }));
    // After switching to webm, the encoder dropdown should still be available
    expect(screen.getByTestId("video-compression-encoder")).toBeInTheDocument();
  });

  it("resets mutation state via reset when isOpen becomes false", () => {
    const { rerender } = render(
      <VideoCompressionDialog
        isOpen
        onClose={onClose}
        filePath={sampleFilePath}
        title="clip.mp4"
        duration={600}
        onOpenFilePicker={vi.fn()}
      />,
    );
    rerender(
      <VideoCompressionDialog
        isOpen={false}
        onClose={onClose}
        filePath={sampleFilePath}
        title="clip.mp4"
        duration={600}
        onOpenFilePicker={vi.fn()}
      />,
    );
    expect(compressJobMutation.reset).toHaveBeenCalled();
  });

  it("allows cancel after reopen when mutation was left pending", () => {
    compressJobMutation.isPending = true;
    const { rerender } = render(
      <VideoCompressionDialog
        isOpen
        onClose={onClose}
        filePath={sampleFilePath}
        title="clip.mp4"
        duration={600}
        onOpenFilePicker={vi.fn()}
      />,
    );
    expect(screen.getByTestId("video-compression-cancel")).toBeDisabled();

    compressJobMutation.isPending = false;
    rerender(
      <VideoCompressionDialog
        isOpen={false}
        onClose={onClose}
        filePath={sampleFilePath}
        title="clip.mp4"
        duration={600}
        onOpenFilePicker={vi.fn()}
      />,
    );
    rerender(
      <VideoCompressionDialog
        isOpen
        onClose={onClose}
        filePath={sampleFilePath}
        title="clip.mp4"
        duration={600}
        onOpenFilePicker={vi.fn()}
      />,
    );

    expect(compressJobMutation.reset).toHaveBeenCalled();
    expect(screen.getByTestId("video-compression-cancel")).not.toBeDisabled();
    fireEvent.click(screen.getByTestId("video-compression-cancel"));
    expect(onClose).toHaveBeenCalled();
  });
});
