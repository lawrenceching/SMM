import type {
  FfmpegConvertFormat,
  FfmpegConvertImageLoop,
  FfmpegConvertImageOptions,
  FfmpegConvertPreset,
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
  error?: string;
} {
  try {
    const result = JSON.parse(stdout) as {
      format?: { tags?: Record<string, string>; duration?: string };
      streams?: Array<{ duration?: string }>;
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
    if (!Number.isFinite(durationRaw) && Array.isArray(result.streams)) {
      for (const stream of result.streams) {
        const d =
          stream.duration != null && stream.duration !== ""
            ? Number.parseFloat(String(stream.duration))
            : NaN;
        if (Number.isFinite(d)) {
          durationRaw = d;
          break;
        }
      }
    }
    const duration = Number.isFinite(durationRaw) ? durationRaw : undefined;
    return { tags, duration };
  } catch {
    return { error: "failed to parse ffprobe JSON output" };
  }
}
