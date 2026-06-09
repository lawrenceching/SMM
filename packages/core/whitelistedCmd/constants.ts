export const YTDLP_DOWNLOAD_ALLOWED_ARGS = [
  "--write-thumbnail",
  "--embed-thumbnail",
  "--embed-metadata",
] as const;

export const VIDEOCAPTIONER_ASR_ENGINES = ["bijian", "jianying", "whisper-cpp"] as const;
export type VideoCaptionerAsrEngine = (typeof VIDEOCAPTIONER_ASR_ENGINES)[number];

export const VIDEOCAPTIONER_TRANSCRIBE_FORMATS = ["srt", "ass", "txt", "json"] as const;
export type VideoCaptionerTranscribeFormat = (typeof VIDEOCAPTIONER_TRANSCRIBE_FORMATS)[number];

export const VIDEOCAPTIONER_TRANSLATORS = ["bing", "google", "llm"] as const;
export type VideoCaptionerTranslator = (typeof VIDEOCAPTIONER_TRANSLATORS)[number];

export const VIDEOCAPTIONER_SUBTITLE_LAYOUTS = [
  "target-above",
  "source-above",
  "target-only",
  "source-only",
] as const;
export type VideoCaptionerSubtitleLayout = (typeof VIDEOCAPTIONER_SUBTITLE_LAYOUTS)[number];

export const VIDEOCAPTIONER_SYNTHESIZE_SUBTITLE_MODES = ["soft", "hard"] as const;
export type VideoCaptionerSynthesizeSubtitleMode =
  (typeof VIDEOCAPTIONER_SYNTHESIZE_SUBTITLE_MODES)[number];

export const VIDEOCAPTIONER_SYNTHESIZE_QUALITY = ["ultra", "high", "medium", "low"] as const;
export type VideoCaptionerSynthesizeQuality = (typeof VIDEOCAPTIONER_SYNTHESIZE_QUALITY)[number];

export const VIDEOCAPTIONER_SYNTHESIZE_RENDER_MODES = ["ass", "rounded"] as const;
export type VideoCaptionerSynthesizeRenderMode =
  (typeof VIDEOCAPTIONER_SYNTHESIZE_RENDER_MODES)[number];

/** Placeholder for videocaptioner CLI when no LLM key is needed. */
export const VIDEOCAPTIONER_CLI_DUMMY_API_KEY = "dummykey";

export type FfmpegConvertFormat =
  | "mp4h264"
  | "mp4h265"
  | "webm"
  | "mkv"
  | "avif"
  | "webp"
  | "apng"
  /** Compression jobs use these as opaque markers; the orchestrator routes
   * them to buildFfmpegCompressArgs when {@link FfmpegConvertBackgroundJobData.compressOptions} is present. */
  | "compress-mp4"
  | "compress-mkv"
  | "compress-webm"
  | "compress-mov";

export type FfmpegConvertPreset = "quality" | "balanced" | "speed";

export type FfmpegConvertImageLoop = "once" | "infinite";

export type FfmpegConvertWebpPreset =
  | "default"
  | "picture"
  | "photo"
  | "drawing"
  | "icon"
  | "text";

export type FfmpegConvertApngPred = "none" | "sub" | "up" | "avg" | "paeth" | "mixed";

export interface FfmpegConvertImageOptions {
  mode: "animated" | "still";
  fps: number;
  maxWidth: number;
  avif: {
    crf: number;
    cpuUsed: number;
    loop: FfmpegConvertImageLoop;
  };
  webp: {
    lossless: boolean;
    quality: number;
    preset: FfmpegConvertWebpPreset;
    loop: FfmpegConvertImageLoop;
  };
  apng: {
    pred: FfmpegConvertApngPred;
    loop: FfmpegConvertImageLoop;
  };
}

export const DEFAULT_FFMPEG_CONVERT_IMAGE_OPTIONS: FfmpegConvertImageOptions = {
  mode: "animated",
  fps: 10,
  maxWidth: 0,
  avif: { crf: 30, cpuUsed: 4, loop: "once" },
  webp: { lossless: false, quality: 80, preset: "default", loop: "once" },
  apng: { pred: "paeth", loop: "once" },
};

export function isFfmpegConvertImageFormat(format: FfmpegConvertFormat): boolean {
  return format === "avif" || format === "webp" || format === "apng";
}

/** True for opaque compression formats (the orchestrator routes via compressOptions). */
export function isFfmpegCompressFormat(format: FfmpegConvertFormat): boolean {
  return (
    format === "compress-mp4" ||
    format === "compress-mkv" ||
    format === "compress-webm" ||
    format === "compress-mov"
  );
}

// ---------------------------------------------------------------------------
// Video compression — see .agents/docs/design/video-compression.md
// ---------------------------------------------------------------------------

export type FfmpegCompressContainer = "mp4" | "mkv" | "webm" | "mov";

export type FfmpegCompressVideoCodec = "h264" | "hevc" | "vp9" | "av1";

export type FfmpegCompressHwAccel =
  | "nvenc"
  | "qsv"
  | "amf"
  | "videotoolbox";

export type FfmpegCompressQualityMode = "crf" | "targetBitrate" | "targetSize";

export type FfmpegCompressEncoderPreset =
  | "ultrafast"
  | "superfast"
  | "veryfast"
  | "faster"
  | "fast"
  | "medium"
  | "slow"
  | "slower"
  | "veryslow";

export type FfmpegCompressProfile = "baseline" | "main" | "high";

export type FfmpegCompressPixFmt =
  | "yuv420p"
  | "yuv444p"
  | "yuv420p10le";

export type FfmpegCompressResolutionMode =
  | "original"
  | "480p"
  | "720p"
  | "1080p"
  | "4k"
  | "custom";

export type FfmpegCompressFrameRateMode =
  | "original"
  | 24
  | 30
  | 60
  | "custom";

export type FfmpegCompressAudioMode = "keep" | "reencode" | "remove";

export type FfmpegCompressAudioCodec =
  | "aac"
  | "libopus"
  | "libmp3lame"
  | "copy";

export type FfmpegCompressDenoise = "none" | "light" | "medium" | "strong";

export type FfmpegCompressHdr = "preserve" | "convertToSdr";

export type FfmpegCompressMetadata = "preserve" | "strip";

export type FfmpegCompressPresetKey =
  | "speed"
  | "balanced"
  | "quality"
  | "extreme"
  | "audioOnly"
  | "custom";

/**
 * User-facing encoder metadata.
 * - `compatibleContainers` restricts the container dropdown when this encoder is selected.
 * - `supportsCrf` distinguishes software encoders (CRF) from hardware encoders that prefer -q:v.
 * - `supports10Bit` enables the yuv420p10le (HDR) option in the pixel-format dropdown.
 */
export interface FfmpegEncoderInfo {
  id: string;
  hwAccel?: FfmpegCompressHwAccel;
  codec: FfmpegCompressVideoCodec;
  compatibleContainers: readonly FfmpegCompressContainer[];
  defaultPreset: string;
  supportsCrf: boolean;
  crfRange: { min: number; max: number; default: number };
  supports10Bit: boolean;
  /**
   * Pixel format options supported by this encoder. yuv420p10le is only
   * listed for encoders that support 10-bit (hevc, av1, etc.).
   */
  supportedPixFmts: readonly FfmpegCompressPixFmt[];
  /**
   * Encoder preset speed names supported by this encoder. Software encoders
   * use x264/x265-style names; hardware encoders use vendor-specific names.
   */
  presetOptions: readonly FfmpegCompressEncoderPreset[];
}

/** Static catalog presented in the UI when ffmpeg -encoders is unavailable. */
export const FFMPEG_COMPRESS_ENCODER_CATALOG: readonly FfmpegEncoderInfo[] = [
  // ── Software encoders ────────────────────────────────────
  {
    id: "libx264",
    codec: "h264",
    compatibleContainers: ["mp4", "mkv", "mov"],
    defaultPreset: "medium",
    supportsCrf: true,
    crfRange: { min: 0, max: 51, default: 23 },
    supports10Bit: false,
    supportedPixFmts: ["yuv420p", "yuv444p"],
    presetOptions: [
      "ultrafast",
      "superfast",
      "veryfast",
      "faster",
      "fast",
      "medium",
      "slow",
      "slower",
      "veryslow",
    ],
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
    presetOptions: [
      "ultrafast",
      "superfast",
      "veryfast",
      "faster",
      "fast",
      "medium",
      "slow",
      "slower",
      "veryslow",
    ],
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
    presetOptions: [
      "ultrafast",
      "superfast",
      "veryfast",
      "faster",
      "fast",
      "medium",
      "slow",
      "slower",
      "veryslow",
    ],
  },
  {
    id: "libaom-av1",
    codec: "av1",
    compatibleContainers: ["mp4", "mkv", "webm"],
    defaultPreset: "medium",
    supportsCrf: true,
    crfRange: { min: 0, max: 63, default: 30 },
    supports10Bit: true,
    supportedPixFmts: ["yuv420p", "yuv444p", "yuv420p10le"],
    presetOptions: [
      "ultrafast",
      "superfast",
      "veryfast",
      "faster",
      "fast",
      "medium",
      "slow",
      "slower",
      "veryslow",
    ],
  },
  {
    id: "libsvtav1",
    codec: "av1",
    compatibleContainers: ["mp4", "mkv", "webm"],
    defaultPreset: "medium",
    supportsCrf: true,
    crfRange: { min: 0, max: 63, default: 30 },
    supports10Bit: true,
    supportedPixFmts: ["yuv420p", "yuv444p", "yuv420p10le"],
    presetOptions: [
      "ultrafast",
      "superfast",
      "veryfast",
      "faster",
      "fast",
      "medium",
      "slow",
      "slower",
      "veryslow",
    ],
  },
  // ── NVIDIA NVENC ────────────────────────────────────────
  {
    id: "h264_nvenc",
    codec: "h264",
    hwAccel: "nvenc",
    compatibleContainers: ["mp4", "mkv", "mov"],
    defaultPreset: "medium",
    supportsCrf: true,
    crfRange: { min: 0, max: 51, default: 23 },
    supports10Bit: false,
    supportedPixFmts: ["yuv420p", "yuv444p"],
    presetOptions: ["ultrafast", "superfast", "veryfast", "fast", "medium", "slow", "slower", "veryslow"],
  },
  {
    id: "hevc_nvenc",
    codec: "hevc",
    hwAccel: "nvenc",
    compatibleContainers: ["mp4", "mkv", "mov"],
    defaultPreset: "medium",
    supportsCrf: true,
    crfRange: { min: 0, max: 51, default: 28 },
    supports10Bit: true,
    supportedPixFmts: ["yuv420p", "yuv444p", "yuv420p10le"],
    presetOptions: ["ultrafast", "superfast", "veryfast", "fast", "medium", "slow", "slower", "veryslow"],
  },
  // ── Intel QSV ───────────────────────────────────────────
  {
    id: "h264_qsv",
    codec: "h264",
    hwAccel: "qsv",
    compatibleContainers: ["mp4", "mkv", "mov"],
    defaultPreset: "medium",
    supportsCrf: true,
    crfRange: { min: 1, max: 51, default: 23 },
    supports10Bit: false,
    supportedPixFmts: ["yuv420p", "yuv444p"],
    presetOptions: ["veryfast", "faster", "fast", "medium", "slow", "slower", "veryslow"],
  },
  {
    id: "hevc_qsv",
    codec: "hevc",
    hwAccel: "qsv",
    compatibleContainers: ["mp4", "mkv", "mov"],
    defaultPreset: "medium",
    supportsCrf: true,
    crfRange: { min: 1, max: 51, default: 28 },
    supports10Bit: true,
    supportedPixFmts: ["yuv420p", "yuv444p", "yuv420p10le"],
    presetOptions: ["veryfast", "faster", "fast", "medium", "slow", "slower", "veryslow"],
  },
  // ── AMD AMF ─────────────────────────────────────────────
  {
    id: "h264_amf",
    codec: "h264",
    hwAccel: "amf",
    compatibleContainers: ["mp4", "mkv", "mov"],
    defaultPreset: "medium",
    supportsCrf: true,
    crfRange: { min: 0, max: 51, default: 23 },
    supports10Bit: false,
    supportedPixFmts: ["yuv420p", "yuv444p"],
    presetOptions: ["veryfast", "faster", "fast", "medium", "slow", "slower", "veryslow"],
  },
  {
    id: "hevc_amf",
    codec: "hevc",
    hwAccel: "amf",
    compatibleContainers: ["mp4", "mkv", "mov"],
    defaultPreset: "medium",
    supportsCrf: true,
    crfRange: { min: 0, max: 51, default: 28 },
    supports10Bit: true,
    supportedPixFmts: ["yuv420p", "yuv444p", "yuv420p10le"],
    presetOptions: ["veryfast", "faster", "fast", "medium", "slow", "slower", "veryslow"],
  },
  // ── Apple VideoToolbox ──────────────────────────────────
  {
    id: "h264_videotoolbox",
    codec: "h264",
    hwAccel: "videotoolbox",
    compatibleContainers: ["mp4", "mov"],
    defaultPreset: "medium",
    supportsCrf: false,
    crfRange: { min: 0, max: 100, default: 70 },
    supports10Bit: false,
    supportedPixFmts: ["yuv420p"],
    presetOptions: ["veryfast", "faster", "fast", "medium", "slow", "slower", "veryslow"],
  },
  {
    id: "hevc_videotoolbox",
    codec: "hevc",
    hwAccel: "videotoolbox",
    compatibleContainers: ["mp4", "mov"],
    defaultPreset: "medium",
    supportsCrf: false,
    crfRange: { min: 0, max: 100, default: 70 },
    supports10Bit: true,
    supportedPixFmts: ["yuv420p", "yuv420p10le"],
    presetOptions: ["veryfast", "faster", "fast", "medium", "slow", "slower", "veryslow"],
  },
] as const;

/** Look up the static catalog entry for an encoder id. */
export function getFfmpegEncoderInfo(encoderId: string): FfmpegEncoderInfo | undefined {
  return FFMPEG_COMPRESS_ENCODER_CATALOG.find((e) => e.id === encoderId);
}

/** 2-pass log filename pattern written beside the output file during pass 1. */
export const FFMPEG_COMPRESS_PASS_LOG_PREFIX = "ffmpeg2pass-";

/** The five one-click presets plus the implicit 'custom' value. */
export const FFMPEG_COMPRESS_PRESET_KEYS = [
  "speed",
  "balanced",
  "quality",
  "extreme",
  "audioOnly",
  "custom",
] as const satisfies readonly FfmpegCompressPresetKey[];

/**
 * Compression options for a single ffmpeg-compress job.
 * See {@link FFMPEG_COMPRESS_PRESETS} for one-click preset defaults.
 */
export interface FfmpegCompressOptions {
  /** Preset key (or 'custom' once any field has been tweaked). */
  presetKey: FfmpegCompressPresetKey;

  // ── Output container ────────────────────────────
  container: FfmpegCompressContainer;

  // ── Video encoding ─────────────────────────────
  videoEncoder: string;
  /** Quality control mode. Required for video encoding. May be undefined for audio-only jobs. */
  qualityMode?: FfmpegCompressQualityMode;
  /** CRF value (0-51). Required for video encoding with CRF mode. */
  crf?: number;
  /** Target average bitrate in kbps. Used when qualityMode = 'targetBitrate'. */
  targetBitrateKbps?: number;
  /** Target file size in MB. Used when qualityMode = 'targetSize' (auto-enables 2-pass). */
  targetSizeMB?: number;
  /** Encoder preset speed. Required for video encoding. */
  encoderPreset?: string;
  profile?: FfmpegCompressProfile;
  pixFmt?: FfmpegCompressPixFmt;
  /** GOP (keyframe interval) in frames; 0 = encoder default. */
  gopSize?: number;

  // ── Resolution & frame rate ────────────────────
  resolutionMode: FfmpegCompressResolutionMode;
  customWidth?: number;
  frameRateMode: FfmpegCompressFrameRateMode;
  customFps?: number;
  /** Drop every Nth frame (0 = off). */
  frameSkip?: number;

  // ── Audio ──────────────────────────────────────
  audioMode: FfmpegCompressAudioMode;
  audioCodec?: FfmpegCompressAudioCodec;
  audioBitrateKbps?: number;
  audioSampleRateHz?: number;
  audioChannels?: 1 | 2;

  // ── Advanced ───────────────────────────────────
  /** Force 2-pass encoding (auto-enabled for targetSize). */
  twoPass: boolean;
  threads?: number;
  hdr: FfmpegCompressHdr;
  filters: {
    denoise: FfmpegCompressDenoise;
    sharpen: boolean;
  };
  metadata: FfmpegCompressMetadata;
}

/** Default compression options used when a preset is selected. */
export const DEFAULT_FFMPEG_COMPRESS_OPTIONS: FfmpegCompressOptions = {
  presetKey: "balanced",
  container: "mp4",
  videoEncoder: "libx264",
  qualityMode: "crf",
  crf: 23,
  encoderPreset: "medium",
  resolutionMode: "original",
  frameRateMode: "original",
  audioMode: "keep",
  audioCodec: "aac",
  audioBitrateKbps: 128,
  audioSampleRateHz: 48000,
  audioChannels: 2,
  twoPass: false,
  hdr: "preserve",
  filters: { denoise: "none", sharpen: false },
  metadata: "preserve",
};

/** The five user-facing one-click presets. */
export interface FfmpegCompressPresetDefinition {
  key: Exclude<FfmpegCompressPresetKey, "custom">;
  labelKey: string;
  descriptionKey: string;
  options: FfmpegCompressOptions;
}

export const FFMPEG_COMPRESS_PRESETS: readonly FfmpegCompressPresetDefinition[] = [
  {
    key: "speed",
    labelKey: "videoCompression.presetSpeed",
    descriptionKey: "videoCompression.presetSpeedDesc",
    options: {
      presetKey: "speed",
      container: "mp4",
      videoEncoder: "libx264",
      qualityMode: "crf",
      crf: 28,
      encoderPreset: "ultrafast",
      audioMode: "keep",
      resolutionMode: "original",
      frameRateMode: "original",
      twoPass: false,
      hdr: "preserve",
      filters: { denoise: "none", sharpen: false },
      metadata: "preserve",
    },
  },
  {
    key: "balanced",
    labelKey: "videoCompression.presetBalanced",
    descriptionKey: "videoCompression.presetBalancedDesc",
    options: {
      presetKey: "balanced",
      container: "mp4",
      videoEncoder: "libx264",
      qualityMode: "crf",
      crf: 23,
      encoderPreset: "medium",
      audioMode: "keep",
      resolutionMode: "original",
      frameRateMode: "original",
      twoPass: false,
      hdr: "preserve",
      filters: { denoise: "none", sharpen: false },
      metadata: "preserve",
    },
  },
  {
    key: "quality",
    labelKey: "videoCompression.presetQuality",
    descriptionKey: "videoCompression.presetQualityDesc",
    options: {
      presetKey: "quality",
      container: "mkv",
      videoEncoder: "libx265",
      qualityMode: "crf",
      crf: 18,
      encoderPreset: "slow",
      audioMode: "reencode",
      audioCodec: "aac",
      audioBitrateKbps: 256,
      audioSampleRateHz: 48000,
      audioChannels: 2,
      resolutionMode: "original",
      frameRateMode: "original",
      twoPass: false,
      hdr: "preserve",
      filters: { denoise: "none", sharpen: false },
      metadata: "preserve",
    },
  },
  {
    key: "extreme",
    labelKey: "videoCompression.presetExtreme",
    descriptionKey: "videoCompression.presetExtremeDesc",
    options: {
      presetKey: "extreme",
      container: "mp4",
      videoEncoder: "libx265",
      qualityMode: "crf",
      crf: 32,
      encoderPreset: "medium",
      audioMode: "reencode",
      audioCodec: "aac",
      audioBitrateKbps: 96,
      audioSampleRateHz: 48000,
      audioChannels: 2,
      resolutionMode: "720p",
      frameRateMode: "original",
      twoPass: false,
      hdr: "preserve",
      filters: { denoise: "none", sharpen: false },
      metadata: "preserve",
    },
  },
  {
    key: "audioOnly",
    labelKey: "videoCompression.presetAudioOnly",
    descriptionKey: "videoCompression.presetAudioOnlyDesc",
    options: {
      presetKey: "audioOnly",
      container: "mp4",
      videoEncoder: "libx264",
      audioMode: "reencode",
      audioCodec: "aac",
      audioBitrateKbps: 192,
      audioSampleRateHz: 48000,
      audioChannels: 2,
      resolutionMode: "original",
      frameRateMode: "original",
      twoPass: false,
      hdr: "preserve",
      filters: { denoise: "none", sharpen: false },
      metadata: "preserve",
    },
  },
] as const satisfies readonly FfmpegCompressPresetDefinition[];

/** Look up a preset definition by key. */
export function getFfmpegCompressPreset(
  key: Exclude<FfmpegCompressPresetKey, "custom">,
): FfmpegCompressPresetDefinition | undefined {
  return FFMPEG_COMPRESS_PRESETS.find((p) => p.key === key);
}

/** Container file extension for a given compression container choice. */
export function getFfmpegCompressContainerExt(
  container: FfmpegCompressContainer,
): string {
  return container;
}

/** Resolved video bitrate (kbps) for a target-size job. */
export function computeTargetBitrateKbpsFromSize(
  sizeMB: number,
  durationSec: number,
  audioBitrateKbps: number,
): number {
  if (durationSec <= 0 || sizeMB <= 0) return 0;
  // 1 MB = 8 * 1024 kb; bitrate kbps = (MB * 8 * 1024 / sec) * 1000 — 1kb = 1000 bits
  const totalKbps = (sizeMB * 8 * 1024) / durationSec;
  const videoKbps = Math.max(100, totalKbps - audioBitrateKbps);
  return Math.round(videoKbps);
}
