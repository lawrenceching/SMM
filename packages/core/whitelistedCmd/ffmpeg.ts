import type { FfmpegConvertFormat, FfmpegConvertPreset } from "./constants";

export function buildFfmpegConvertArgs(
  inputPath: string,
  outputPath: string,
  format: FfmpegConvertFormat,
  preset: FfmpegConvertPreset
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
  tags: Record<string, string>
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
  timestampSeconds: number
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
