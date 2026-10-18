import type { FfmpegCompressProbe } from "../../whitelistedCmd/ffmpeg";

const emptyProbe: FfmpegCompressProbe = { durationSec: 0, width: 0, height: 0 };

export function parseFfprobeJson(stdout: string): FfmpegCompressProbe {
  try {
    const parsed = JSON.parse(stdout) as {
      format?: { duration?: string };
      streams?: Array<{ codec_type?: string; width?: number; height?: number }>;
    };
    const durationSec = parsed.format?.duration
      ? Number.parseFloat(parsed.format.duration)
      : 0;
    const videoStream = (parsed.streams ?? []).find((s) => s.codec_type === "video");
    return {
      durationSec: Number.isFinite(durationSec) ? durationSec : 0,
      width: videoStream?.width ?? 0,
      height: videoStream?.height ?? 0,
    };
  } catch {
    return emptyProbe;
  }
}
