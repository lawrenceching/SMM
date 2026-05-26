import type { YtdlpVideo } from "@core/types/YtdlpTypes";
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
import { parseYtdlpPlaylistStdout } from "@/utils/parseYtdlpPlaylistStdout";
import { parse } from "@/api/ytdlp/parse";
import type { VideoMetadata } from "@/api/ytdlp/types";

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
}

export type { VideoMetadata };

/**
 * Runs `yt-dlp -F [--cookies-from-browser <browser>] [--js-runtimes <runtime>] <url>`
 * and returns the parsed format list. Supports `--cookies` (manual file), `--cookies-from-browser`,
 * and `--js-runtimes`. Throws on non-zero exit code so callers can classify the error.
 */
export async function listYtdlpFormats(
  req: YtdlpListFormatsRequest
): Promise<VideoMetadata> {
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

  args.push("-J", req.url.trim());

  const result = await executeCmdToCompletion(
    { command: "yt-dlp", args },
    { timeoutMs: 60_000 }
  );

  if (!result.success) {
    const errorText = [result.stderr, result.stdout].join("\n");
    throw new Error(result.error || errorText.trim() || `yt-dlp exited with code ${result.exitCode}`);
  }

  const parsed = parse(result.stdout);
  if ("_type" in parsed && parsed._type === "playlist") {
    throw new Error("yt-dlp returned a playlist; expected a single video");
  }
  return parsed as VideoMetadata;
}

export interface YtdlpBilibiliEpisodesResponse {
  videos?: YtdlpVideo[];
  error?: string;
}

/**
 * Fetches raw yt-dlp `-j` stdout for a Bilibili series URL, then parses NDJSON into videos.
 */
export async function getBilibiliEpisodesMetadata(
  url: string
): Promise<YtdlpBilibiliEpisodesResponse> {
  const validation = validateDownloadUrl(url.trim());
  if (!validation.valid) {
    return { error: validation.error };
  }

  const result = await executeCmdToCompletion(
    { command: "yt-dlp", args: ["-j", url.trim()] },
    { timeoutMs: YTDLP_COLLECTION_CMD_TIMEOUT_MS }
  );

  if (!result.success) {
    return { error: result.error };
  }

  const parsed = parseYtdlpPlaylistStdout(result.stdout);
  if ("error" in parsed) {
    return { error: parsed.error };
  }
  return { videos: parsed.videos };
}

/** Single entry in a Bilibili collection flat playlist (`yt-dlp --flat-playlist -J`). */
export interface BilibiliCollectionEntry {
  ie_key: string;
  id: string;
  _type: string;
  url: string;
  __x_forwarded_for_ip?: string | null;
}

export interface BilibiliCollectionThumbnail {
  url: string;
  id: string;
}

export interface BilibiliCollectionMetadataVersion {
  version: string;
  current_git_head: string | null;
  release_git_head: string;
  repository: string;
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
  entries: BilibiliCollectionEntry[];
  webpage_url: string;
  original_url: string;
  webpage_url_basename: string;
  webpage_url_domain: string;
  extractor: string;
  extractor_key: string;
  upload_date: string;
  release_year: number | null;
  thumbnails: BilibiliCollectionThumbnail[];
  playlist_count: number;
  epoch: number;
  __files_to_move?: Record<string, unknown>;
  _version?: BilibiliCollectionMetadataVersion;
}

const BILIBILI_COLLECTION_PATH = /^\/(\d+)\/lists\/(\d+)\/?$/;

/**
 * Validates a Bilibili **collection** URL and returns the normalized URL string.
 * Expected shape: `https://space.bilibili.com/<uid>/lists/<collectionId>` (digits only).
 */
export function assertValidBilibiliCollectionUrl(url: string): string {
  const trimmed = url.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Invalid Bilibili collection URL: not a valid URL");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Invalid Bilibili collection URL: must use https");
  }

  if (parsed.hostname !== "space.bilibili.com") {
    throw new Error("Invalid Bilibili collection URL: host must be space.bilibili.com");
  }

  const pathnameNorm = parsed.pathname.replace(/\/$/, "") || parsed.pathname;
  if (!BILIBILI_COLLECTION_PATH.test(pathnameNorm)) {
    throw new Error(
      "Invalid Bilibili collection URL: expected https://space.bilibili.com/<uid>/lists/<collectionId>"
    );
  }

  // Preserve query and fragment (e.g. ?type=season); normalize only trailing slash on pathname.
  return `${parsed.origin}${pathnameNorm}${parsed.search}${parsed.hash}`;
}

/** True when {@link assertValidBilibiliCollectionUrl} would succeed (HTTPS space collection list URL). */
export function isBilibiliCollectionUrl(url: string): boolean {
  try {
    assertValidBilibiliCollectionUrl(url);
    return true;
  } catch {
    return false;
  }
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

const YTDLP_COLLECTION_CMD_TIMEOUT_MS = 180_000;
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

/**
 * Parses a single JSON document from `yt-dlp --flat-playlist -J` stdout (may be pretty-printed).
 */
export function parseBilibiliCollectionStdout(stdout: string): BilibiliCollectionMetadata {
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
  if (obj._type !== "playlist") {
    throw new Error("yt-dlp output is not a playlist");
  }
  if (!Array.isArray(obj.entries)) {
    throw new Error("yt-dlp playlist has no entries array");
  }

  return raw as BilibiliCollectionMetadata;
}

/**
 * Runs `yt-dlp --flat-playlist -J` via {@link executeCmdStream} and returns parsed collection metadata.
 */
export async function getBilibiliCollectionMetadata(url: string): Promise<BilibiliCollectionMetadata> {
  const validUrl = assertValidBilibiliCollectionUrl(url);

  const { stdout, stderr, exitCode } = await collectExecuteCmdOutput(
    {
      command: "yt-dlp",
      args: ["--flat-playlist", "-J", validUrl],
    },
    YTDLP_COLLECTION_CMD_TIMEOUT_MS
  );

  if (exitCode !== 0) {
    const detail = stderr.trim() || `exit code ${exitCode ?? "unknown"}`;
    throw new Error(`yt-dlp failed: ${detail}`);
  }

  return parseBilibiliCollectionStdout(stdout);
}
