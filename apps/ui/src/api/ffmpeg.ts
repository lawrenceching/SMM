import { Path } from "@core/path";
import {
  buildFfmpegConvertArgs,
  buildFfmpegScreenshotArgs,
  buildFfmpegWriteTagsArgs,
  buildFfprobeReadTagsArgs,
  parseFfprobeTagsJson,
  probeWhitelistedCommand,
  type FfmpegConvertFormat,
  type FfmpegConvertPreset,
} from "@/lib/whitelistedCmd";
import { executeCmdToCompletion } from "@/lib/whitelistedCmd/executeCmdToCompletion";

export interface FfmpegScreenshotsResponse {
  screenshots?: string[];
  error?: string;
}

export interface GenerateFfmpegScreenshotsOptions {
  signal?: AbortSignal;
}

const NUM_SCREENSHOTS = 5;
const FFMPEG_CONVERT_TIMEOUT_MS = 60 * 60 * 1000;
const FFPROBE_TIMEOUT_MS = 30_000;
const SCREENSHOT_TIMEOUT_MS = 120_000;

export async function generateFfmpegScreenshots(
  videoPath: string,
  options?: GenerateFfmpegScreenshotsOptions
): Promise<FfmpegScreenshotsResponse> {
  const absolutePath = new Path(videoPath).platformAbsPath();

  const probeResult = await executeCmdToCompletion(
    { command: "ffprobe", args: buildFfprobeReadTagsArgs(absolutePath) },
    { timeoutMs: FFPROBE_TIMEOUT_MS, signal: options?.signal }
  );

  if (!probeResult.success) {
    return { error: probeResult.error ?? "failed to probe video" };
  }

  const parsed = parseFfprobeTagsJson(probeResult.stdout);
  const duration = parsed.duration;
  if (duration === undefined || duration <= 0) {
    return { error: "invalid video duration" };
  }

  const parsedPath = absolutePath.replace(/\\/g, "/").replace(/\/[^/]+$/, "");
  const baseName = absolutePath.replace(/^.*[/\\]/, "").replace(/\.[^.]+$/, "");
  const interval = duration / (NUM_SCREENSHOTS + 1);
  const screenshots: string[] = [];

  for (let i = 1; i <= NUM_SCREENSHOTS; i++) {
    const timestamp = interval * i;
    const outputPath = `${parsedPath}/${baseName}_screenshot_${i}.jpg`;
    const args = buildFfmpegScreenshotArgs(absolutePath, outputPath, timestamp);
    const shot = await executeCmdToCompletion(
      { command: "ffmpeg", args },
      { timeoutMs: SCREENSHOT_TIMEOUT_MS, signal: options?.signal }
    );
    if (!shot.success) {
      return { error: shot.error ?? `failed to generate screenshot at ${timestamp}s` };
    }
    screenshots.push(outputPath);
  }

  return { screenshots };
}

export type { FfmpegConvertFormat, FfmpegConvertPreset };

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

export async function convertVideo(params: FfmpegConvertRequest): Promise<FfmpegConvertResponse> {
  const inputPath = new Path(params.inputPath).platformAbsPath();
  const outputPath = new Path(params.outputPath).platformAbsPath();
  const args = buildFfmpegConvertArgs(
    inputPath,
    outputPath,
    params.outputFormat,
    params.preset
  );

  const result = await executeCmdToCompletion(
    { command: "ffmpeg", args },
    { timeoutMs: FFMPEG_CONVERT_TIMEOUT_MS }
  );

  if (result.success) {
    return { success: true, outputPath };
  }
  return { error: result.error };
}

export interface FfmpegTagsRequest {
  path: string;
}

export interface FfmpegTagsResponse {
  tags?: Record<string, string>;
  duration?: number;
  error?: string;
}

export async function getMediaTags(params: FfmpegTagsRequest): Promise<FfmpegTagsResponse> {
  const absolutePath = new Path(params.path).platformAbsPath();
  const result = await executeCmdToCompletion(
    { command: "ffprobe", args: buildFfprobeReadTagsArgs(absolutePath) },
    { timeoutMs: FFPROBE_TIMEOUT_MS }
  );

  if (!result.success) {
    return { error: result.error };
  }

  const parsed = parseFfprobeTagsJson(result.stdout);
  if (parsed.error) {
    return { error: parsed.error };
  }
  return { tags: parsed.tags, duration: parsed.duration };
}

export interface FfmpegWriteTagsRequest {
  path: string;
  tags: Record<string, string>;
}

export interface FfmpegWriteTagsResponse {
  success?: boolean;
  error?: string;
}

export async function writeMediaTags(
  params: FfmpegWriteTagsRequest
): Promise<FfmpegWriteTagsResponse> {
  const pathObj = new Path(params.path);
  const absolutePath = pathObj.platformAbsPath();
  const tempFilePath = `${absolutePath}.smm-temp`;

  const args = buildFfmpegWriteTagsArgs(absolutePath, tempFilePath, params.tags);
  const result = await executeCmdToCompletion(
    { command: "ffmpeg", args },
    { timeoutMs: FFMPEG_CONVERT_TIMEOUT_MS }
  );

  if (!result.success) {
    return { error: result.error };
  }

  const { deleteFile } = await import("@/api/deleteFile");
  const del = await deleteFile(absolutePath);
  if (del.error) {
    return { error: del.error };
  }

  const renameResp = await fetch("/api/renameFiles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      files: [{ from: tempFilePath, to: absolutePath }],
    }),
  });
  const renameBody = (await renameResp.json()) as { error?: string };
  if (!renameResp.ok || renameBody.error) {
    return { error: renameBody.error ?? `rename failed: HTTP ${renameResp.status}` };
  }

  return { success: true };
}

export async function discoverFfmpeg(): Promise<{ path?: string; error?: string }> {
  const probe = await probeWhitelistedCommand("ffmpeg");
  if (probe.available) {
    return { path: "ffmpeg" };
  }
  return { error: probe.error ?? "ffmpeg not found" };
}

export async function getFfmpegVersion(): Promise<{ version?: string; error?: string }> {
  const probe = await probeWhitelistedCommand("ffmpeg");
  if (!probe.available) {
    return { error: probe.error ?? "ffmpeg not found" };
  }
  const result = await executeCmdToCompletion(
    { command: "ffmpeg", args: ["-version"] },
    { timeoutMs: 15_000 }
  );
  if (!result.success) {
    return { error: result.error };
  }
  const firstLine = result.stdout.trim().split("\n")[0];
  return { version: firstLine };
}
