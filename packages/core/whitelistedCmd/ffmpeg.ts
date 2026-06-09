import type {
  FfmpegCompressOptions,
  FfmpegConvertFormat,
  FfmpegConvertImageLoop,
  FfmpegConvertImageOptions,
  FfmpegConvertPreset,
} from "./constants";
import {
  FFMPEG_COMPRESS_PASS_LOG_PREFIX,
  computeTargetBitrateKbpsFromSize,
  getFfmpegEncoderInfo,
} from "./constants";

function buildImageVideoFilter(options: FfmpegConvertImageOptions): string | undefined {
  const parts: string[] = [];
  if (options.mode === "animated" && options.fps > 0) {
    parts.push(`fps=${options.fps}`);
  }
  if (options.maxWidth > 0) {
    parts.push(`scale=${options.maxWidth}:-2:flags=lanczos`);
  }
  return parts.length > 0 ? parts.join(",") : undefined;
}

function appendLoopFlag(args: string[], loop: FfmpegConvertImageLoop, flag: "-loop" | "-plays"): void {
  if (loop === "infinite") {
    args.push(flag, "0");
  }
}

export function buildFfmpegConvertArgs(
  inputPath: string,
  outputPath: string,
  format: FfmpegConvertFormat,
  preset: FfmpegConvertPreset,
  imageOptions?: FfmpegConvertImageOptions,
): string[] {
  const args: string[] = ["-i", inputPath];

  switch (format) {
    case "mp4h264": {
      const crf = preset === "quality" ? "18" : preset === "balanced" ? "23" : "23";
      const x264Preset =
        preset === "quality" ? "slow" : preset === "balanced" ? "medium" : "veryfast";
      args.push("-c:v", "libx264", "-crf", crf, "-preset", x264Preset);
      args.push("-c:a", "copy");
      break;
    }
    case "mp4h265": {
      const crf = preset === "quality" ? "20" : preset === "balanced" ? "26" : "28";
      const x265Preset =
        preset === "quality" ? "slow" : preset === "balanced" ? "medium" : "fast";
      args.push("-c:v", "libx265", "-crf", crf, "-preset", x265Preset);
      args.push("-c:a", "copy");
      break;
    }
    case "webm": {
      const crf = preset === "quality" ? "30" : preset === "balanced" ? "35" : "40";
      args.push("-c:v", "libvpx-vp9", "-crf", crf, "-b:v", "0");
      if (preset === "speed") {
        args.push("-deadline", "realtime");
      } else if (preset === "balanced") {
        args.push("-deadline", "good");
      }
      args.push("-c:a", "libopus", "-b:a", "128k");
      break;
    }
    case "mkv": {
      const crf = preset === "quality" ? "18" : preset === "balanced" ? "23" : "23";
      const x264Preset =
        preset === "quality" ? "slow" : preset === "balanced" ? "medium" : "veryfast";
      args.push("-c:v", "libx264", "-crf", crf, "-preset", x264Preset);
      args.push("-c:a", "copy");
      break;
    }
    case "avif": {
      if (!imageOptions) {
        throw new Error("imageOptions required for avif format");
      }
      const vf = buildImageVideoFilter(imageOptions);
      if (vf) {
        args.push("-vf", vf);
      }
      if (imageOptions.mode === "still") {
        args.push("-vframes", "1");
      }
      args.push(
        "-c:v",
        "libaom-av1",
        "-crf",
        String(imageOptions.avif.crf),
        "-cpu-used",
        String(imageOptions.avif.cpuUsed),
      );
      if (imageOptions.mode === "still") {
        args.push("-still-picture", "1");
      }
      args.push("-an", "-f", "avif");
      if (imageOptions.avif.loop === "infinite") {
        args.push("-loop", "0");
      } else if (imageOptions.mode === "animated") {
        args.push("-loop", "1");
      }
      break;
    }
    case "webp": {
      if (!imageOptions) {
        throw new Error("imageOptions required for webp format");
      }
      const vf = buildImageVideoFilter(imageOptions);
      if (vf) {
        args.push("-vf", vf);
      }
      if (imageOptions.mode === "still") {
        args.push("-vframes", "1");
      }
      const encoder = imageOptions.mode === "still" ? "libwebp" : "libwebp_anim";
      args.push("-c:v", encoder);
      if (imageOptions.webp.lossless) {
        args.push("-lossless", "1");
      } else {
        args.push("-quality", String(imageOptions.webp.quality));
      }
      args.push("-preset", imageOptions.webp.preset);
      args.push("-an");
      appendLoopFlag(args, imageOptions.webp.loop, "-loop");
      break;
    }
    case "apng": {
      if (!imageOptions) {
        throw new Error("imageOptions required for apng format");
      }
      const vf = buildImageVideoFilter(imageOptions);
      if (vf) {
        args.push("-vf", vf);
      }
      if (imageOptions.mode === "still") {
        args.push("-vframes", "1");
      }
      args.push("-c:v", "apng", "-pred", imageOptions.apng.pred, "-an");
      appendLoopFlag(args, imageOptions.apng.loop, "-plays");
      break;
    }
    default:
      throw new Error(`Unsupported format: ${format}`);
  }

  args.push("-y", outputPath);
  return args;
}

export function buildFfprobeReadTagsArgs(filePath: string): string[] {
  return ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", filePath];
}

export function buildFfmpegWriteTagsArgs(
  filePath: string,
  tempFilePath: string,
  tags: Record<string, string>,
): string[] {
  const args = ["-i", filePath, "-c", "copy"];
  for (const [key, value] of Object.entries(tags)) {
    args.push("-metadata", `${key}=${value}`);
  }
  args.push("-y", tempFilePath);
  return args;
}

export function buildFfmpegScreenshotArgs(
  videoPath: string,
  outputPath: string,
  timestampSeconds: number,
): string[] {
  return [
    "-ss",
    timestampSeconds.toFixed(3),
    "-i",
    videoPath,
    "-vframes",
    "1",
    "-q:v",
    "2",
    "-y",
    outputPath,
  ];
}

export function parseFfprobeTagsJson(stdout: string): {
  tags?: Record<string, string>;
  duration?: number;
  /** Total bitrate in kbps (from format.bit_rate). */
  bitrateKbps?: number;
  /** Video stream bitrate in kbps (sum of all video streams). */
  videoBitrateKbps?: number;
  /** Audio stream bitrate in kbps (sum of all audio streams). */
  audioBitrateKbps?: number;
  error?: string;
} {
  try {
    const result = JSON.parse(stdout) as {
      format?: { tags?: Record<string, string>; duration?: string; bit_rate?: string };
      streams?: Array<{
        duration?: string;
        codec_type?: string;
        bit_rate?: string;
      }>;
    };
    const format = result.format;
    if (!format) {
      return { tags: {} };
    }
    const tags = format.tags ?? {};
    let durationRaw =
      format.duration != null && format.duration !== ""
        ? Number.parseFloat(String(format.duration))
        : NaN;
    let videoBitrateRaw = 0;
    let audioBitrateRaw = 0;
    if (Array.isArray(result.streams)) {
      for (const stream of result.streams) {
        const d =
          stream.duration != null && stream.duration !== ""
            ? Number.parseFloat(String(stream.duration))
            : NaN;
        if (!Number.isFinite(durationRaw) && Number.isFinite(d)) {
          durationRaw = d;
        }
        const br =
          stream.bit_rate != null && stream.bit_rate !== ""
            ? Number.parseFloat(String(stream.bit_rate))
            : NaN;
        if (Number.isFinite(br) && br > 0) {
          if (stream.codec_type === "video") videoBitrateRaw += br;
          else if (stream.codec_type === "audio") audioBitrateRaw += br;
        }
      }
    }
    const duration = Number.isFinite(durationRaw) ? durationRaw : undefined;
    const bitrateRaw =
      format.bit_rate != null && format.bit_rate !== ""
        ? Number.parseFloat(String(format.bit_rate))
        : NaN;
    const bitrateKbps = Number.isFinite(bitrateRaw) && bitrateRaw > 0
      ? bitrateRaw / 1000
      : undefined;
    const videoBitrateKbps = videoBitrateRaw > 0
      ? videoBitrateRaw / 1000
      : undefined;
    const audioBitrateKbps = audioBitrateRaw > 0
      ? audioBitrateRaw / 1000
      : undefined;
    return {
      tags,
      ...(duration !== undefined && { duration }),
      ...(bitrateKbps !== undefined && { bitrateKbps }),
      ...(videoBitrateKbps !== undefined && { videoBitrateKbps }),
      ...(audioBitrateKbps !== undefined && { audioBitrateKbps }),
    };
  } catch {
    return { error: "failed to parse ffprobe JSON output" };
  }
}

// ---------------------------------------------------------------------------
// Video compression
// ---------------------------------------------------------------------------

/** A single-run ffmpeg command. */
export interface FfmpegCompressSingleRun {
  kind: "single";
  args: string[];
}

/** A two-pass ffmpeg command (pass 1 writes to NUL and produces an ffmpeg2pass log). */
export interface FfmpegCompressTwoPassRun {
  kind: "two-pass";
  pass1Args: string[];
  pass2Args: string[];
  /** Pass-log file path (same directory as outputPath). Created and cleaned up. */
  passLogPath: string;
}

export type FfmpegCompressRun = FfmpegCompressSingleRun | FfmpegCompressTwoPassRun;

export interface FfmpegCompressProbe {
  /** Duration in seconds (required for targetSize mode). */
  durationSec: number;
  /** Source video width in pixels (0 if unknown). */
  width: number;
  /** Source video height in pixels (0 if unknown). */
  height: number;
}

/** Audio-only extraction mode produces no video stream. */
function isAudioOnly(opts: FfmpegCompressOptions): boolean {
  // Either explicit 'audioOnly' preset OR an explicit audioMode = 'remove'
  return opts.presetKey === "audioOnly" || opts.audioMode === "remove";
}

/** Resolve target bitrate in kbps for a compression job. */
function resolveVideoBitrateKbps(
  opts: FfmpegCompressOptions,
  probe: FfmpegCompressProbe,
): number {
  if (opts.qualityMode === "targetBitrate" && opts.targetBitrateKbps) {
    return Math.max(100, Math.round(opts.targetBitrateKbps));
  }
  if (opts.qualityMode === "targetSize" && opts.targetSizeMB) {
    const audioKbps = opts.audioBitrateKbps ?? 0;
    return computeTargetBitrateKbpsFromSize(opts.targetSizeMB, probe.durationSec, audioKbps);
  }
  return 0;
}

/** Resolution height for the chosen resolutionMode (returns null = original). */
function resolutionHeightForMode(
  mode: FfmpegCompressOptions["resolutionMode"],
  sourceHeight: number,
): number | null {
  if (mode === "original") return null;
  const target = mode === "480p" ? 480 : mode === "720p" ? 720 : mode === "1080p" ? 1080 : 2160;
  if (sourceHeight > 0 && sourceHeight < target) return null; // never upscale
  return target;
}

/** Width/height for the chosen scale filter (height auto-derived). */
function buildScaleFilter(
  opts: FfmpegCompressOptions,
  sourceHeight: number,
): { width: number | null; height: number | null } {
  if (opts.resolutionMode === "original") return { width: null, height: null };
  if (opts.resolutionMode === "custom") {
    const w = Math.max(2, Math.round(opts.customWidth ?? 0));
    if (w <= 0) return { width: null, height: null };
    return { width: w, height: -2 };
  }
  const h = resolutionHeightForMode(opts.resolutionMode, sourceHeight);
  if (h == null) return { width: null, height: null };
  return { width: -2, height: h };
}

function buildDenoiseArgs(denoise: FfmpegCompressOptions["filters"]["denoise"]): string | null {
  switch (denoise) {
    case "none":
      return null;
    case "light":
      return "hqdn3d=4:3:6:3";
    case "medium":
      return "hqdn3d=7:7:9:7";
    case "strong":
      return "hqdn3d=10:10:12:10";
  }
}

function buildSharpenArgs(): string {
  return "unsharp=5:5:1.0:5:5:0.0";
}

/**
 * Assemble the -vf filter graph from a FfmpegCompressOptions + source height.
 * Returns null if no filter is needed.
 */
function buildVideoFilter(
  opts: FfmpegCompressOptions,
  sourceHeight: number,
): string | null {
  const parts: string[] = [];

  if (isAudioOnly(opts)) {
    return null;
  }

  // HDR → SDR conversion uses zscale + format
  if (opts.hdr === "convertToSdr") {
    parts.push("zscale=transfer=linear,nlmeans,format=yuv420p,zscale=transfer=bt709,format=yuv420p");
  }

  const { width, height } = buildScaleFilter(opts, sourceHeight);
  if (width != null && height != null) {
    parts.push(`scale=${width}:${height}:flags=lanczos`);
  }

  // Frame rate
  let targetFps: number | null = null;
  if (opts.frameRateMode === "custom") {
    targetFps = opts.customFps && opts.customFps > 0 ? opts.customFps : null;
  } else if (typeof opts.frameRateMode === "number") {
    targetFps = opts.frameRateMode;
  }
  if (targetFps != null && targetFps > 0) {
    parts.push(`fps=${targetFps}`);
  }

  // Denoise + sharpen
  const denoise = buildDenoiseArgs(opts.filters.denoise);
  if (denoise) parts.push(denoise);
  if (opts.filters.sharpen) parts.push(buildSharpenArgs());

  // Frame skip: select every Nth frame
  if (opts.frameSkip && opts.frameSkip > 1) {
    parts.push(`select='not(mod(n\\,${opts.frameSkip}))',setpts=N/FRAME_RATE/TB`);
  }

  return parts.length > 0 ? parts.join(",") : null;
}

/** Build encoder-specific args (excluding -i input and pass flags). */
function buildVideoEncoderArgs(
  opts: FfmpegCompressOptions,
  bitrateKbps: number,
): string[] {
  const args: string[] = ["-c:v", opts.videoEncoder];

  const info = getFfmpegEncoderInfo(opts.videoEncoder);
  const crf = opts.crf ?? (info?.crfRange.default ?? 23);
  const encoderPreset = opts.encoderPreset ?? info?.defaultPreset ?? "medium";

  // -preset / speed
  args.push("-preset", encoderPreset);

  // Quality
  if (opts.qualityMode === "crf") {
    if (info && !info.supportsCrf) {
      // VideoToolbox and similar: use -q:v (0-100 scale)
      args.push("-q:v", String(crf));
    } else {
      args.push("-crf", String(crf));
    }
  } else {
    // Bitrate mode
    args.push("-b:v", `${Math.max(100, bitrateKbps)}k`);
    if (opts.qualityMode === "targetBitrate") {
      args.push("-maxrate", `${Math.max(100, Math.round(bitrateKbps * 1.5))}k`);
      args.push("-minrate", `${Math.max(100, Math.round(bitrateKbps * 0.5))}k`);
      args.push("-bufsize", `${Math.max(100, bitrateKbps * 2)}k`);
    }
  }

  // Profile
  if (opts.profile && (opts.videoEncoder === "libx264" || opts.videoEncoder === "libx265")) {
    args.push("-profile:v", opts.profile);
  }

  // Pixel format
  if (opts.pixFmt) {
    args.push("-pix_fmt", opts.pixFmt);
  }

  // GOP size
  if (opts.gopSize && opts.gopSize > 0) {
    args.push("-g", String(opts.gopSize));
    args.push("-keyint_min", String(opts.gopSize));
  }

  // Threads
  if (opts.threads && opts.threads > 0) {
    args.push("-threads", String(opts.threads));
  }

  return args;
}

/** Build audio args based on audioMode. */
function buildAudioArgs(opts: FfmpegCompressOptions): string[] {
  if (opts.audioMode === "remove") {
    return ["-an"];
  }
  if (opts.audioMode === "keep") {
    return ["-c:a", "copy"];
  }
  // reencode
  const args: string[] = ["-c:a", opts.audioCodec ?? "aac"];
  if (opts.audioCodec !== "copy" && opts.audioBitrateKbps) {
    args.push("-b:a", `${opts.audioBitrateKbps}k`);
  }
  if (opts.audioSampleRateHz) {
    args.push("-ar", String(opts.audioSampleRateHz));
  }
  if (opts.audioChannels) {
    args.push("-ac", String(opts.audioChannels));
  }
  return args;
}

/** Build the shared middle section of an ffmpeg compression command. */
function buildCompressionMiddle(
  opts: FfmpegCompressOptions,
  bitrateKbps: number,
  videoFilter: string | null,
  audioOnly: boolean,
): string[] {
  const args: string[] = [];

  if (audioOnly) {
    args.push("-vn");
  } else {
    args.push(...buildVideoEncoderArgs(opts, bitrateKbps));
    if (videoFilter) {
      args.push("-vf", videoFilter);
    }
  }

  args.push(...buildAudioArgs(opts));

  // Metadata
  if (opts.metadata === "strip") {
    args.push("-map_metadata", "-1");
  } else {
    args.push("-map_metadata", "0");
  }

  // MP4 / MOV faststart (puts moov atom at start for streaming)
  if (opts.container === "mp4" || opts.container === "mov") {
    args.push("-movflags", "+faststart");
  }

  return args;
}

/**
 * Build ffmpeg args for a video compression job.
 * Returns either a single-pass run or a two-pass run depending on options.
 *
 * @param inputPath absolute platform path to the source video
 * @param outputPath absolute platform path to the output video
 * @param opts compression options (preset + custom fields)
 * @param probe ffprobe data for the source (durationSec, width, height)
 */
export function buildFfmpegCompressArgs(
  inputPath: string,
  outputPath: string,
  opts: FfmpegCompressOptions,
  probe: FfmpegCompressProbe,
): FfmpegCompressRun {
  const audioOnly = isAudioOnly(opts);
  const bitrateKbps = resolveVideoBitrateKbps(opts, probe);
  const videoFilter = buildVideoFilter(opts, probe.height);
  const needsTwoPass =
    !audioOnly && (opts.twoPass || opts.qualityMode === "targetSize");

  if (!needsTwoPass) {
    const args: string[] = ["-y", "-i", inputPath];
    args.push(...buildCompressionMiddle(opts, bitrateKbps, videoFilter, audioOnly));
    args.push("-f", opts.container);
    args.push(outputPath);
    return { kind: "single", args };
  }

  // Two-pass
  const passLogPath = derivePassLogPath(outputPath);

  // Pass 1: output to NUL (ffmpeg ignores output filename when -f null is set)
  const pass1Args: string[] = ["-y", "-i", inputPath];
  pass1Args.push(
    "-pass",
    "1",
    "-passlogfile",
    passLogPath,
    ...buildCompressionMiddle(opts, bitrateKbps, videoFilter, false),
  );
  // Force -an on pass 1 (audio not needed)
  if (!pass1Args.includes("-an")) {
    pass1Args.push("-an");
  }
  // Force -f null on pass 1
  pass1Args.push("-f", "null", "-");

  // Pass 2: real output
  const pass2Args: string[] = ["-y", "-i", inputPath];
  pass2Args.push(
    "-pass",
    "2",
    "-passlogfile",
    passLogPath,
    ...buildCompressionMiddle(opts, bitrateKbps, videoFilter, false),
  );
  pass2Args.push("-f", opts.container, outputPath);

  return { kind: "two-pass", pass1Args, pass2Args, passLogPath };
}

/** Compute pass-1 / pass-2 log file path (placed beside the output). */
function derivePassLogPath(outputPath: string): string {
  // Strip trailing extension
  const lastDot = outputPath.lastIndexOf(".");
  const stem = lastDot > 0 ? outputPath.slice(0, lastDot) : outputPath;
  return `${stem}.${FFMPEG_COMPRESS_PASS_LOG_PREFIX}log`;
}


