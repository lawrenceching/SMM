import { Path } from "@core/path";
import {
  buildFfmpegConvertArgs,
  buildFfmpegWriteTagsArgs,
  buildFfprobeReadTagsArgs,
  parseFfprobeTagsJson,
  probeWhitelistedCommand,
  type FfmpegConvertFormat,
  type FfmpegConvertPreset,
} from "@/lib/whitelistedCmd";
import { executeCmdToCompletion } from "@/lib/whitelistedCmd/executeCmdToCompletion";
import { listFiles } from "@/api/listFiles";
import { writeFile } from "@/api/writeFile";
import { hello } from "@/api/hello";
import { helloQueryKey } from "@/lib/appQueryKeys";
import { queryClient } from "@/lib/queryClient";
import type { HelloResponseBody } from "@core/types";

export interface FfmpegScreenshotsResponse {
  screenshots?: string[];
  error?: string;
}

export interface GenerateFfmpegScreenshotsOptions {
  signal?: AbortSignal;
}

const FFMPEG_CONVERT_TIMEOUT_MS = 60 * 60 * 1000;
const FFPROBE_TIMEOUT_MS = 30_000;
const NUM_SCREENSHOTS = 5;
const SCREENSHOT_GEN_TIMEOUT_MS = 60_000;

/** SHA-256 hex digest using Web Crypto API (works on localhost / secure context). */
async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Extract duration (seconds) from ffprobe JSON stdout. */
function parseFfprobeDuration(stdout: string): number | null {
  try {
    const parsed = JSON.parse(stdout);
    const duration = parsed?.format?.duration;
    if (duration != null) {
      const d = Number(duration);
      if (Number.isFinite(d) && d > 0) return d;
    }
  } catch {
    // invalid JSON
  }
  return null;
}

export async function generateFfmpegScreenshots(
  videoPath: string,
  options?: GenerateFfmpegScreenshotsOptions
): Promise<FfmpegScreenshotsResponse> {
  const absolutePath = new Path(videoPath).platformAbsPath();
  const signal = options?.signal;

  // 1. Get tmpDir from cached hello response (fetch if not cached)
  let helloData = queryClient.getQueryData<HelloResponseBody>(helloQueryKey);
  if (!helloData?.tmpDir) {
    helloData = await queryClient.fetchQuery({
      queryKey: helloQueryKey,
      queryFn: () => hello(),
    });
  }
  if (!helloData?.tmpDir) {
    return { error: 'tmpDir not available' };
  }
  if (signal?.aborted) return { error: 'request aborted' };

  // 2. Compute deterministic cache directory from video path hash
  const hash = await sha256Hex(absolutePath);
  // Forward slashes are fine — the server normalises with path.resolve().
  const cacheDir = `${helloData.tmpDir}/screenshots/${hash}`;

  // 3. Check cache by listing the cache directory
  const listResult = await listFiles({ path: cacheDir, onlyFiles: true });
  if (!listResult.error && listResult.data?.items) {
    // Extract filenames (handle both \ and / path separators)
    const jpgNames = new Set(
      listResult.data.items.map((i) => {
        const backslash = i.path.lastIndexOf('\\');
        const slash = i.path.lastIndexOf('/');
        return i.path.slice(Math.max(backslash, slash) + 1);
      }),
    );
    if (
      jpgNames.size >= NUM_SCREENSHOTS &&
      [1, 2, 3, 4, 5].every((n) => jpgNames.has(`${n}.jpg`))
    ) {
      // Cache hit — build paths in canonical order
      const screenshots = [1, 2, 3, 4, 5].map((n) => `${cacheDir}/${n}.jpg`);
      return { screenshots };
    }
  }
  if (signal?.aborted) return { error: 'request aborted' };

  // 4. Get video duration via ffprobe
  const ffprobeResult = await executeCmdToCompletion(
    {
      command: 'ffprobe',
      args: [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        absolutePath,
      ],
    },
    { timeoutMs: FFPROBE_TIMEOUT_MS, signal },
  );
  if (!ffprobeResult.success) {
    return { error: ffprobeResult.error ?? 'failed to probe video duration' };
  }
  const duration = parseFfprobeDuration(ffprobeResult.stdout);
  if (duration == null || duration <= 0) {
    return { error: 'invalid video duration' };
  }
  if (signal?.aborted) return { error: 'request aborted' };

  // 5. Create cache directory by writing a placeholder file
  try {
    await writeFile(`${cacheDir}/.cache`, '', 'overwrite');
  } catch (err) {
    return {
      error: `failed to create cache directory: ${err instanceof Error ? err.message : 'unknown error'}`,
    };
  }
  if (signal?.aborted) return { error: 'request aborted' };

  // 6. Calculate evenly-spaced timestamps
  const interval = duration / (NUM_SCREENSHOTS + 1);
  const timestamps = [1, 2, 3, 4, 5].map((i) => interval * i);

  // 7. Build a single ffmpeg command with multiple -ss / -i inputs
  //    and individual -map / -vframes / -q:v outputs.
  const args: string[] = [];
  const outputPaths: string[] = [];
  for (const ts of timestamps) {
    args.push('-ss', ts.toFixed(3), '-i', absolutePath);
  }
  for (let i = 0; i < NUM_SCREENSHOTS; i++) {
    const outPath = `${cacheDir}/${i + 1}.jpg`;
    outputPaths.push(outPath);
    args.push('-map', `${i}:v`, '-vframes', '1', '-q:v', '2', '-y', outPath);
  }

  // 8. Run ffmpeg (single command, 5 outputs)
  const ffmpegResult = await executeCmdToCompletion(
    { command: 'ffmpeg', args },
    { timeoutMs: SCREENSHOT_GEN_TIMEOUT_MS, signal },
  );
  if (!ffmpegResult.success) {
    return { error: ffmpegResult.error ?? 'failed to generate screenshots' };
  }

  return { screenshots: outputPaths };
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

  // Preserve the original file extension so ffmpeg can auto-detect the output
  // format (e.g. test.mp4 → test.smm-temp.mp4 instead of test.mp4.smm-temp).
  const extIdx = absolutePath.lastIndexOf('.');
  const ext = extIdx >= 0 ? absolutePath.slice(extIdx) : '';
  const base = ext ? absolutePath.slice(0, extIdx) : absolutePath;
  const tempFilePath = `${base}.smm-temp${ext}`;

  const args = buildFfmpegWriteTagsArgs(absolutePath, tempFilePath, params.tags);
  const result = await executeCmdToCompletion(
    { command: "ffmpeg", args },
    { timeoutMs: FFMPEG_CONVERT_TIMEOUT_MS }
  );

  if (!result.success) {
    return { error: result.error };
  }

  try {
    await (await import("@/api/moveFileToTrash")).moveFileToTrash(
      new Path(absolutePath).platformAbsPath(),
    );
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to move original file to trash",
    };
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
  try {
    const { fetchDiscoverExecutables } = await import("@/api/discoverExecutables");
    const { ffmpeg } = await fetchDiscoverExecutables();
    const path = ffmpeg.configuredPath ?? ffmpeg.discoveredPath;
    if (path) {
      return { path };
    }
  } catch {
    /* fall through to probe */
  }
  const probe = await probeWhitelistedCommand("ffmpeg");
  if (probe.available) {
    return { path: probe.resolvedPath ?? "ffmpeg" };
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
