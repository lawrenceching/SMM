
import { validateDownloadUrl } from "@core/download-video-validators";
import {
  buildYtdlpDownloadArgs,
  parseYtdlpDownloadStdout,
  validateYtdlpDownloadExtraArgs,
  type YtdlpCookiesFromBrowserName,
  isYtdlpCookiesFromBrowserName,
} from "@core/whitelistedCmd/ytdlp";
import { probeWhitelistedCommand } from "@/lib/whitelistedCmd/probeWhitelistedCommand";
import { executeCmdToCompletion } from "@/lib/whitelistedCmd/executeCmdToCompletion";

import { parse, videoMetadataForFormatsListing } from "@/api/ytdlp/parse";
import type { PlaylistMetadata, Thumbnail, Version, VideoMetadata } from "@/api/ytdlp/types";

export interface YtdlpDownloadRequest {
  url: string;
  args?: string[];
  folder?: string;
  /** yt-dlp `-f` format selector; omit for yt-dlp default. */
  format?: string;
}

export interface YtdlpDownloadResponse {
  success?: boolean;
  error?: string;
  path?: string;
}

const YTDLP_DOWNLOAD_TIMEOUT_MS = 60 * 60 * 1000;

export async function downloadYtdlpVideo(
  request: YtdlpDownloadRequest
): Promise<YtdlpDownloadResponse> {
  const validation = validateDownloadUrl(request.url ?? "");
  if (!validation.valid) {
    return { error: validation.error };
  }

  const argsError = validateYtdlpDownloadExtraArgs(request.args);
  if (argsError) {
    return { error: argsError };
  }

  const folder = request.folder ?? "";
  if (!folder) {
    return { error: "folder is required" };
  }

  const args = buildYtdlpDownloadArgs({
    url: request.url,
    folder,
    args: request.args,
    format: request.format,
  });

  const result = await executeCmdToCompletion(
    { command: "yt-dlp", args },
    { timeoutMs: YTDLP_DOWNLOAD_TIMEOUT_MS }
  );

  if (!result.success) {
    return { error: result.error };
  }

  const path = parseYtdlpDownloadStdout(result.stdout);
  return { success: true, path };
}

export async function discoverYtdlp(): Promise<{ path?: string; error?: string }> {
  try {
    const { fetchDiscoverExecutables } = await import("@/api/discoverExecutables");
    const { ytdlp } = await fetchDiscoverExecutables();
    const path = ytdlp.configuredPath ?? ytdlp.discoveredPath;
    if (path) {
      return { path };
    }
  } catch {
    /* fall through to probe */
  }
  const probe = await probeWhitelistedCommand("yt-dlp");
  if (probe.available) {
    return { path: probe.resolvedPath ?? "yt-dlp" };
  }
  return { error: probe.error ?? "yt-dlp not found" };
}

export async function getYtdlpVersion(): Promise<{ version?: string; error?: string }> {
  const probe = await probeWhitelistedCommand("yt-dlp");
  if (!probe.available) {
    return { error: probe.error ?? "yt-dlp not found" };
  }
  const result = await executeCmdToCompletion(
    { command: "yt-dlp", args: ["--version"] },
    { timeoutMs: 15_000 }
  );
  if (!result.success) {
    return { error: result.error };
  }
  return { version: result.stdout.trim().split("\n")[0] };
}

export interface YtdlpExtractDataResponse {
  title?: string;
  artist?: string;
  error?: string;
}

export async function extractYtdlpVideoData(url: string): Promise<YtdlpExtractDataResponse> {
  if (!url) {
    return { error: "url is required" };
  }

  const result = await executeCmdToCompletion(
    {
      command: "yt-dlp",
      args: ["--skip-download", "--print", "title=%(title)s ___ artist=%(uploader)s", url],
    },
    { timeoutMs: 60_000 }
  );

  if (!result.success) {
    return { error: result.error };
  }

  const lines = result.stdout.trim().split("\n");
  const dataLine = lines.find((line) => line.includes("title=") && line.includes("___ artist="));
  if (!dataLine) {
    return { error: "failed to parse video data from output" };
  }

  const parts = dataLine.split("___");
  let title: string | undefined;
  let artist: string | undefined;
  for (const part of parts) {
    const trimmedPart = part.trim();
    if (trimmedPart.startsWith("title=")) {
      title = trimmedPart.substring(6).trim();
    } else if (trimmedPart.startsWith("artist=")) {
      artist = trimmedPart.substring(7).trim();
    }
  }

  if (!title) {
    return { error: "title not found in yt-dlp output" };
  }
  return { title, artist };
}

export interface YtdlpListFormatsRequest {
  url: string;
  /** Absolute path to a Netscape-format cookies file. */
  cookiesFile?: string;
  /** Browser profile name for `--cookies-from-browser`. */
  cookiesFromBrowser?: string;
  /** JS runtime name for `--js-runtimes` (e.g. "quickjs"). */
  jsRuntime?: string;
  /** Absolute path to the JS runtime binary. */
  jsRuntimePath?: string;
  /** Proxy URL for `--proxy` (http, https, socks5). */
  proxy?: string;
}

export interface ListFormatsResult {
  /** Video metadata used for format selection (first entry when the response is a playlist). */
  videoMetadata: VideoMetadata;
  /** When `yt-dlp -J` returns a playlist, the full list of video entries; undefined for single videos. */
  playlistEntries?: VideoMetadata[];
}

/** E2E: when set, `listYtdlpFormats` throws this yt-dlp-style error without running yt-dlp. */
export const TEST_MOCK_LIST_FORMATS_ERROR_KEY = "test.mockYtdlpListFormatsError";

/**
 * Runs `yt-dlp -J` and returns the parsed format list. Supports `--cookies` (manual file),
 * `--cookies-from-browser`, and `--js-runtimes`. Throws on non-zero exit code so callers
 * can classify the error.
 */
export async function listYtdlpFormats(
  req: YtdlpListFormatsRequest
): Promise<ListFormatsResult> {
  if (typeof localStorage !== "undefined") {
    const mockError = localStorage.getItem(TEST_MOCK_LIST_FORMATS_ERROR_KEY);
    if (mockError) {
      throw new Error(mockError);
    }
  }

  const args: string[] = [];

  const cookiesFile = req.cookiesFile?.trim();
  if (cookiesFile) {
    args.push("--cookies", cookiesFile);
  }

  const browser = req.cookiesFromBrowser?.trim().toLowerCase();
  if (browser && isYtdlpCookiesFromBrowserName(browser)) {
    args.push("--cookies-from-browser", browser as YtdlpCookiesFromBrowserName);
  }

  const jsRuntime = req.jsRuntime?.trim();
  const jsRuntimePath = req.jsRuntimePath?.trim();
  if (jsRuntime) {
    args.push("--js-runtimes", jsRuntimePath ? `${jsRuntime}:${jsRuntimePath}` : jsRuntime);
  }

  const proxy = req.proxy?.trim();
  if (proxy) {
    args.push("--proxy", proxy);
  }

  args.push("-J", req.url.trim());

  const result = await executeCmdToCompletion(
    { command: "yt-dlp", args },
    { timeoutMs: 60_000 }
  );

  if (!result.success) {
    const stderr = result.stderr?.trim() ?? ""
    const stdout = result.stdout?.trim() ?? ""
    const errorText = [stderr, stdout].filter(Boolean).join("\n")
    const message = errorText || `yt-dlp exited with code ${result.exitCode}`
    // Prepend the system-level error (e.g. timeout message) if available
    const fullMessage = result.error ? `${result.error}\n${message}` : message
    const error = new Error(fullMessage)
    // Attach executionId so DVD can show a "日志" button to view command logs
    if (result.executionId) {
      (error as Error & { executionId?: string }).executionId = result.executionId
    }
    throw error
  }

  const parsed = parse(result.stdout);
  const videoMetadata = videoMetadataForFormatsListing(parsed);

  // Extract full playlist entries when yt-dlp returns a playlist
  let playlistEntries: VideoMetadata[] | undefined;
  if ("entries" in parsed) {
    const playlist = parsed as PlaylistMetadata;
    playlistEntries = playlist.entries;
  }

  return { videoMetadata, playlistEntries };
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

/** Parsed stdout from `yt-dlp --flat-playlist -J` on a Bilibili collection list URL. */
export interface BilibiliCollectionMetadata {
  uploader: string;
  title: string;
  description: string;
  uploader_id: string;
  timestamp: number;
  thumbnail: string;
  id: string;
  _type: string;
  entries: VideoMetadata[];
  webpage_url: string;
  original_url: string;
  webpage_url_basename: string;
  webpage_url_domain: string;
  extractor: string;
  extractor_key: string;
  upload_date: string;
  release_year: number | null;
  thumbnails: Thumbnail[];
  playlist_count: number;
  epoch: number;
  __files_to_move?: Record<string, unknown>;
  _version?: Version;
}

async function collectExecuteCmdOutput(
  request: { command: "yt-dlp"; args: string[] },
  timeoutMs?: number
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  const result = await executeCmdToCompletion(request, { timeoutMs });
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
      args: ["-J", trimmed],
    },
    YTDLP_VIDEO_METADATA_TIMEOUT_MS
  );

  if (exitCode !== 0) {
    const detail = stderr.trim() || `exit code ${exitCode ?? "unknown"}`;
    throw new Error(`yt-dlp failed: ${detail}`);
  }

  return parseBilibiliVideoStdout(stdout);
}


