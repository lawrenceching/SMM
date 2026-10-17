
import { validateDownloadUrl } from "@smm/core/download-video-validators";
import { buildYtdlpInspectArgs } from "@smm/core/whitelistedCmd/ytdlp";
import { probeWhitelistedCommand } from "@/lib/whitelistedCmd/probeWhitelistedCommand";
import { executeYtdlp } from "@/lib/ytdlp/executeYtdlp";
import { ytdlpInspectViaCore } from "@/api/ytdlpInspect";

import type { VideoMetadata } from "@/api/ytdlp/types";

export async function getYtdlpVersion(): Promise<{ version?: string; error?: string }> {
  const probe = await probeWhitelistedCommand("yt-dlp");
  if (!probe.available) {
    return { error: probe.error ?? "yt-dlp not found" };
  }
  const result = await executeYtdlp(["--version"], { timeoutMs: 15_000 });
  if (!result.success) {
    return { error: result.error };
  }
  return { version: result.stdout.trim().split("\n")[0] };
}

export interface YtdlpListFormatsRequest {
  url: string;
  /** Netscape cookies file contents (Core writes a managed temp file). */
  cookiesText?: string;
  /** @deprecated Prefer cookiesText; ignored by Core inspect. */
  cookiesFile?: string;
  /** Browser profile name for `--cookies-from-browser`. */
  cookiesFromBrowser?: string;
  /** JS runtime name for `--js-runtimes` (e.g. "quickjs"). */
  jsRuntime?: string;
  /** Absolute path to the JS runtime binary. */
  jsRuntimePath?: string;
  /** Proxy URL for `--proxy` (http, https, socks5). */
  proxy?: string;
  /** @deprecated No longer used; Core manages cookies cleanup. */
  userDataDir?: string;
}

export interface ListFormatsResult {
  /** Video metadata used for format selection (first entry when the response is a playlist). */
  videoMetadata: VideoMetadata;
  /** When `yt-dlp -J` returns a playlist, the full list of video entries; undefined for single videos. */
  playlistEntries?: VideoMetadata[];
}

/**
 * Lists formats / playlist entries via Core `POST /api/ytdlp-inspect`.
 * Throws on business error so callers can classify the message.
 */
export async function listYtdlpFormats(
  req: YtdlpListFormatsRequest
): Promise<ListFormatsResult> {
  const result = await ytdlpInspectViaCore({
    url: req.url,
    cookiesText: req.cookiesText,
    cookiesFromBrowser: req.cookiesFromBrowser,
    jsRuntime: req.jsRuntime,
    jsRuntimePath: req.jsRuntimePath,
    proxy: req.proxy,
  });

  return {
    videoMetadata: result.video,
    playlistEntries: result.playlistEntries,
  };
}

/** Subset of yt-dlp `-J` output for a single video (`_type: video`). */
export interface BilibiliVideoMetadata {
  _type: "video";
  id: string;
  title: string;
  fulltitle: string;
  webpage_url: string;
  original_url?: string;
  extractor?: string;
  extractor_key?: string;
}

async function collectExecuteCmdOutput(
  request: { command: "yt-dlp"; args: string[] },
  timeoutMs?: number
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  const result = await executeYtdlp(request.args, { timeoutMs });
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
  };
}

const YTDLP_VIDEO_METADATA_TIMEOUT_MS = 60_000;

/**
 * Display title from {@link BilibiliVideoMetadata} (prefer fulltitle).
 */
export function bilibiliVideoDisplayTitle(meta: BilibiliVideoMetadata): string {
  const t = meta.fulltitle?.trim() || meta.title?.trim() || meta.id;
  return t || "";
}

/**
 * Parses a single JSON object from `yt-dlp -J` stdout for one video URL.
 */
export function parseBilibiliVideoStdout(stdout: string): BilibiliVideoMetadata {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new Error("yt-dlp produced empty stdout");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    throw new Error("yt-dlp stdout is not valid JSON");
  }

  if (raw === null || typeof raw !== "object") {
    throw new Error("yt-dlp output is not a JSON object");
  }

  const obj = raw as Record<string, unknown>;
  if (obj._type === "playlist") {
    throw new Error("yt-dlp returned a playlist; expected a single video");
  }
  if (obj._type !== "video") {
    throw new Error("yt-dlp output is not a single video");
  }

  const id = typeof obj.id === "string" ? obj.id : "";
  const title = typeof obj.title === "string" ? obj.title : "";
  const fulltitle = typeof obj.fulltitle === "string" ? obj.fulltitle : "";
  const webpage_url = typeof obj.webpage_url === "string" ? obj.webpage_url : "";

  return {
    _type: "video",
    id,
    title,
    fulltitle,
    webpage_url,
    original_url: typeof obj.original_url === "string" ? obj.original_url : undefined,
    extractor: typeof obj.extractor === "string" ? obj.extractor : undefined,
    extractor_key: typeof obj.extractor_key === "string" ? obj.extractor_key : undefined,
  };
}

/**
 * Runs `yt-dlp -J` via executeCmd for one video URL and returns parsed metadata.
 */
export async function getBilibiliVideoMetadata(url: string): Promise<BilibiliVideoMetadata> {
  const trimmed = url.trim();
  const validation = validateDownloadUrl(trimmed);
  if (!validation.valid) {
    throw new Error("Invalid or unsupported video URL");
  }

  const { stdout, stderr, exitCode } = await collectExecuteCmdOutput(
    {
      command: "yt-dlp",
      args: buildYtdlpInspectArgs({ url: trimmed, mode: "json" }),
    },
    YTDLP_VIDEO_METADATA_TIMEOUT_MS
  );

  if (exitCode !== 0) {
    const detail = stderr.trim() || `exit code ${exitCode ?? "unknown"}`;
    throw new Error(`yt-dlp failed: ${detail}`);
  }

  return parseBilibiliVideoStdout(stdout);
}


