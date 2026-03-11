export interface FfmpegScreenshotsResponse {
  screenshots?: string[];
  error?: string;
}

export interface GenerateFfmpegScreenshotsOptions {
  signal?: AbortSignal;
}

export async function generateFfmpegScreenshots(
  videoPath: string,
  options?: GenerateFfmpegScreenshotsOptions
): Promise<FfmpegScreenshotsResponse> {
  const encodedPath = encodeURIComponent(videoPath);
  const resp = await fetch(`/api/ffmpeg/screenshots?videoPath=${encodedPath}`, {
    method: "GET",
    signal: options?.signal,
  });

  const text = await resp.text();
  if (!text.trim()) {
    return {
      error: resp.ok
        ? "Empty response from server"
        : `Request failed: ${resp.status} ${resp.statusText}`,
    };
  }
  try {
    return JSON.parse(text) as FfmpegScreenshotsResponse;
  } catch {
    return { error: `Invalid response: ${text.slice(0, 100)}` };
  }
}

export type FfmpegConvertFormat = "mp4h264" | "mp4h265" | "webm" | "mkv";
export type FfmpegConvertPreset = "quality" | "balanced" | "speed";

export interface FfmpegConvertRequest {
  inputPath: string;
  outputPath: string;
  outputFormat: FfmpegConvertFormat;
  preset: FfmpegConvertPreset;
}

export interface FfmpegConvertResponse {
  success?: boolean;
  outputPath?: string;
  error?: string;
}

export async function convertVideo(
  params: FfmpegConvertRequest
): Promise<FfmpegConvertResponse> {
  const resp = await fetch("/api/ffmpeg/convert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return (await resp.json()) as FfmpegConvertResponse;
}
