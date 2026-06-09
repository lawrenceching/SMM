/**
 * Heuristic estimator for video compression output size.
 *
 * Approach D (see .agents/docs/design/video-compression.md §9): pure
 * client-side, no ffmpeg execution. Combines a per-encoder bits-per-pixel
 * table, a CRF slope, and a source-content factor derived from the source's
 * own bitrate.
 *
 * Accuracy: ±30–50% for software encoders on "general" content; ±100% for
 * hardware encoders (their rate-distortion behavior is content-dependent and
 * undocumented). Useful as a hint, not a guarantee.
 */
import type {
  FfmpegCompressOptions,
  FfmpegEncoderInfo,
} from "./constants";
import { FFMPEG_COMPRESS_ENCODER_CATALOG } from "./constants";
import { computeTargetBitrateKbpsFromSize } from "./constants";

/** Source media probe data. */
export interface CompressEstimationProbe {
  durationSec: number;
  width: number;
  height: number;
  /** Total bitrate in kbps (from format.bit_rate). Optional. */
  totalBitrateKbps?: number;
  /** Video stream bitrate in kbps. Optional. */
  videoBitrateKbps?: number;
  /** Audio stream bitrate in kbps. Optional. */
  audioBitrateKbps?: number;
  /** Source frame rate (best-effort; used to compute pixel rate). */
  fps?: number;
}

export interface CompressEstimationResult {
  /** Estimated video bitrate in kbps. */
  videoBitrateKbps: number;
  /** Estimated audio bitrate in kbps. */
  audioBitrateKbps: number;
  /** Sum of video + audio bitrate in kbps. */
  totalBitrateKbps: number;
  /** Estimated output size in MB. */
  estimatedSizeMB: number;
  /** Estimated output size as a percentage of source size (e.g. 0.62 = 62%). */
  pctOfSource?: number;
}

/**
 * Per-encoder calibration: bits-per-pixel-per-second at the encoder's
 * reference CRF, for "general" content (not screen recording, not pure
 * motion). The default reference is CRF 23 (libx264 / libx265).
 */
interface EncoderCalibration {
  /** bpp/s at the reference CRF. */
  baseBppPerSec: number;
  /** Reference CRF value the bpp/s is calibrated at. */
  crfReference: number;
  /**
   * CRF slope: bitrate scale = 2^((crfReference - crf) / crfSlope).
   * Default 6 (libx264 rule of thumb: each +6 CRF halves bitrate).
   */
  crfSlope: number;
}

const ENCODER_CALIBRATION: Record<string, EncoderCalibration> = {
  // ── Software (relative to libx264's 0.10 bpp/s) ─────────────
  libx264: { baseBppPerSec: 0.10, crfReference: 23, crfSlope: 6 },
  libx265: { baseBppPerSec: 0.05, crfReference: 28, crfSlope: 6 },
  libvpx_vp9: { baseBppPerSec: 0.065, crfReference: 31, crfSlope: 6 },
  libaom_av1: { baseBppPerSec: 0.045, crfReference: 30, crfSlope: 6 },
  libsvtav1: { baseBppPerSec: 0.045, crfReference: 30, crfSlope: 6 },
  // ── NVIDIA NVENC (less efficient per quality than x264) ─────
  h264_nvenc: { baseBppPerSec: 0.14, crfReference: 23, crfSlope: 6 },
  hevc_nvenc: { baseBppPerSec: 0.07, crfReference: 28, crfSlope: 6 },
  // ── Intel QSV ────────────────────────────────────────────────
  h264_qsv: { baseBppPerSec: 0.15, crfReference: 23, crfSlope: 6 },
  hevc_qsv: { baseBppPerSec: 0.075, crfReference: 28, crfSlope: 6 },
  // ── AMD AMF ─────────────────────────────────────────────────
  h264_amf: { baseBppPerSec: 0.15, crfReference: 23, crfSlope: 6 },
  hevc_amf: { baseBppPerSec: 0.075, crfReference: 28, crfSlope: 6 },
  // ── Apple VideoToolbox ─────────────────────────────────────
  h264_videotoolbox: { baseBppPerSec: 0.14, crfReference: 23, crfSlope: 6 },
  hevc_videotoolbox: { baseBppPerSec: 0.07, crfReference: 28, crfSlope: 6 },
};

/** Fallback when encoder is unknown. */
const FALLBACK_CALIBRATION: EncoderCalibration = {
  baseBppPerSec: 0.10,
  crfReference: 23,
  crfSlope: 6,
};

/** Get calibration for an encoder id, falling back to defaults. */
function getCalibration(encoderId: string): EncoderCalibration {
  return ENCODER_CALIBRATION[encoderId] ?? FALLBACK_CALIBRATION;
}

/**
 * Map an encoder's quality value to a CRF-equivalent in the 0–51 scale.
 * For encoders that support CRF (`supportsCrf: true`), the value is already
 * a CRF. For `-q:v` style encoders (VideoToolbox), the value is mapped
 * piecewise linearly so that:
 *   q:v 0           -> CRF 0   (lossless-ish)
 *   q:v default     -> crfReference (e.g. 23 for h264_videotoolbox)
 *   q:v max         -> CRF 51  (worst quality)
 *
 * This matches the convention that VideoToolbox's default q:v of 70 sits at
 * "medium" quality (the same as libx264 CRF 23), not at "high" quality.
 */
function crfEquivalent(
  rawValue: number | undefined,
  encoder: FfmpegEncoderInfo | undefined,
  calibration: EncoderCalibration,
): number {
  if (rawValue == null) return calibration.crfReference;
  if (encoder && !encoder.supportsCrf) {
    const max = Math.max(1, encoder.crfRange.max);
    const def = Math.max(0, Math.min(max, encoder.crfRange.default));
    const ref = calibration.crfReference;
    if (def <= 0) {
      return Math.max(0, Math.min(51, (rawValue * 51) / max));
    }
    // Piecewise linear: q:v 0..default -> CRF 0..ref; q:v default..max -> CRF ref..51
    if (rawValue <= def) {
      return Math.max(0, Math.min(51, (rawValue * ref) / def));
    }
    const tail = max - def;
    if (tail <= 0) return ref;
    return Math.max(0, Math.min(51, ref + ((rawValue - def) * (51 - ref)) / tail));
  }
  return Math.max(0, Math.min(51, rawValue));
}

/**
 * Compute the target output resolution in pixels.
 * Returns null for "original" / unknown.
 */
function targetResolution(
  options: FfmpegCompressOptions,
  sourceWidth: number,
  sourceHeight: number,
): { width: number; height: number } {
  switch (options.resolutionMode) {
    case "original":
      return { width: sourceWidth, height: sourceHeight };
    case "480p":
      return { width: -1, height: 480 };
    case "720p":
      return { width: -1, height: 720 };
    case "1080p":
      return { width: -1, height: 1080 };
    case "4k":
      return { width: -1, height: 2160 };
    case "custom":
      return { width: options.customWidth ?? sourceWidth, height: -2 };
  }
}

/** Frame rate for the target output (best-effort). */
function targetFps(options: FfmpegCompressOptions, sourceFps: number | undefined): number {
  if (typeof options.frameRateMode === "number") return options.frameRateMode;
  if (options.frameRateMode === "custom") return options.customFps ?? 30;
  return sourceFps && sourceFps > 0 ? sourceFps : 30;
}

/**
 * Content factor: how much the source bitrate deviates from the baseline for
 * its resolution. A screen recording might be 1 Mbps at 1080p → factor ~0.15;
 * an action movie at 10 Mbps → factor ~1.5. Clamped to avoid runaway scaling.
 */
function contentFactor(
  sourceBitrateKbps: number | undefined,
  sourceWidth: number,
  sourceHeight: number,
  sourceFps: number | undefined,
): number {
  if (!sourceBitrateKbps || sourceBitrateKbps <= 0) return 1;
  if (sourceWidth <= 0 || sourceHeight <= 0) return 1;
  const fps = sourceFps && sourceFps > 0 ? sourceFps : 30;
  const pixels = sourceWidth * sourceHeight;
  const bppPerSec = sourceBitrateKbps * 1000 / (pixels * fps);
  // libx264 at CRF 23 baseline: 0.10 bpp/s
  const baseline = 0.10;
  return Math.max(0.3, Math.min(3.0, bppPerSec / baseline));
}

/** Convert a video bitrate and duration to MB (decimal, matches OS file managers). */
function sizeMB(bitrateKbps: number, durationSec: number): number {
  if (durationSec <= 0) return 0;
  // 1 kbps × 1 sec = 1000 bits = 125 bytes = 125 / 1,000,000 MB
  return (bitrateKbps * durationSec) / 8 / 1000;
}

/** Look up the static catalog entry for an encoder. */
function findEncoderInfo(encoderId: string): FfmpegEncoderInfo | undefined {
  return FFMPEG_COMPRESS_ENCODER_CATALOG.find((e) => e.id === encoderId);
}

/**
 * Estimate the *output* video bitrate (kbps) for the given compression
 * options, calibrated against the source probe data.
 *
 * Returns 0 for audio-only jobs (no video output).
 */
export function estimateCompressVideoBitrateKbps(
  options: FfmpegCompressOptions,
  probe: CompressEstimationProbe,
): number {
  // Audio-only: no video stream
  if (options.presetKey === "audioOnly" || options.audioMode === "remove") {
    return 0;
  }

  // Mode 1: target bitrate — known directly
  if (options.qualityMode === "targetBitrate" && options.targetBitrateKbps) {
    return Math.max(50, Math.round(options.targetBitrateKbps));
  }

  // Mode 2: target size — derive from size + audio bitrate
  if (options.qualityMode === "targetSize" && options.targetSizeMB) {
    const audio = options.audioBitrateKbps ?? 0;
    return Math.max(50, computeTargetBitrateKbpsFromSize(options.targetSizeMB, probe.durationSec, audio));
  }

  // Mode 3: CRF — heuristic estimate
  if (options.qualityMode === "crf" && options.crf != null) {
    const encoder = findEncoderInfo(options.videoEncoder);
    const calib = getCalibration(options.videoEncoder);
    const crfEq = crfEquivalent(options.crf, encoder, calib);
    const crfFactor = Math.pow(2, (calib.crfReference - crfEq) / calib.crfSlope);
    const bpp = calib.baseBppPerSec * crfFactor;

    // Target resolution: respect resolution mode; never upscale beyond source.
    const sourceW = probe.width > 0 ? probe.width : 1920;
    const sourceH = probe.height > 0 ? probe.height : 1080;
    const target = targetResolution(options, sourceW, sourceH);
    let targetW: number;
    let targetH: number;
    if (target.width === -1) {
      const aspect = sourceW / sourceH;
      targetH = target.height;
      targetW = Math.max(2, Math.round(targetH * aspect / 2) * 2);
    } else if (target.width === -2) {
      const aspect = sourceW / sourceH;
      targetW = Math.max(2, Math.round(target.width / 2) * 2);
      targetH = Math.max(2, Math.round(targetW / aspect / 2) * 2);
    } else {
      targetW = target.width;
      targetH = target.height;
    }
    // Never upscale: clamp to source resolution
    if (sourceW > 0 && targetW > sourceW) {
      const scale = sourceW / targetW;
      targetW = sourceW;
      targetH = Math.round(targetH * scale);
    }
    if (sourceH > 0 && targetH > sourceH) {
      const scale = sourceH / targetH;
      targetH = sourceH;
      targetW = Math.round(targetW * scale);
    }
    if (targetW <= 0 || targetH <= 0) return 0;

    const fps = targetFps(options, probe.fps);
    const factor = contentFactor(
      probe.videoBitrateKbps ?? probe.totalBitrateKbps,
      sourceW,
      sourceH,
      probe.fps,
    );
    const bitrateKbps = (bpp * targetW * targetH * fps * factor) / 1000;
    return Math.max(50, Math.round(bitrateKbps));
  }

  return 0;
}

/** Estimate the *output* audio bitrate (kbps) for the given options. */
export function estimateCompressAudioBitrateKbps(
  options: FfmpegCompressOptions,
  probe: CompressEstimationProbe,
): number {
  if (options.audioMode === "remove") return 0;
  if (options.audioMode === "reencode") {
    return Math.max(0, options.audioBitrateKbps ?? 128);
  }
  // Keep: assume source bitrate (fallback to 128 kbps)
  return Math.max(0, probe.audioBitrateKbps ?? 128);
}

/** Full estimation: video + audio bitrate + total size in MB. */
export function estimateCompressSizeMb(
  options: FfmpegCompressOptions,
  probe: CompressEstimationProbe,
): CompressEstimationResult | null {
  if (!probe.durationSec || probe.durationSec <= 0) return null;

  const videoBitrateKbps = estimateCompressVideoBitrateKbps(options, probe);
  const audioBitrateKbps = estimateCompressAudioBitrateKbps(options, probe);
  const totalBitrateKbps = videoBitrateKbps + audioBitrateKbps;
  const estimatedSizeMB = sizeMB(totalBitrateKbps, probe.durationSec);

  // Source size for percentage comparison
  const sourceTotalKbps =
    probe.totalBitrateKbps ??
    (probe.videoBitrateKbps ?? 0) + (probe.audioBitrateKbps ?? 0);
  const sourceSizeMB = sourceTotalKbps > 0
    ? sizeMB(sourceTotalKbps, probe.durationSec)
    : undefined;
  const pctOfSource = sourceSizeMB && sourceSizeMB > 0
    ? estimatedSizeMB / sourceSizeMB
    : undefined;

  return {
    videoBitrateKbps,
    audioBitrateKbps,
    totalBitrateKbps,
    estimatedSizeMB,
    ...(pctOfSource !== undefined && { pctOfSource }),
  };
}
