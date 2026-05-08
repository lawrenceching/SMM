import type { YtdlpVideo } from "@core/types/YtdlpTypes";
import { executeCmdStream, type ExecuteCmdRequest } from "@/api/executeCmd";
import { parseYtdlpPlaylistStdout } from "@/utils/parseYtdlpPlaylistStdout";

export interface YtdlpDownloadRequest {
  url: string;
  args?: string[];
  folder?: string;
}

export interface YtdlpDownloadResponse {
  success?: boolean;
  error?: string;
  path?: string;
}

export async function downloadYtdlpVideo(
  request: YtdlpDownloadRequest
): Promise<YtdlpDownloadResponse> {
  const resp = await fetch("/api/ytdlp/download", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  const body = (await resp.json()) as YtdlpDownloadResponse;
  return body;
}

export async function discoverYtdlp(): Promise<{ path?: string; error?: string }> {
  const resp = await fetch("/api/ytdlp/discover", {
    method: "GET",
  });

  return (await resp.json()) as { path?: string; error?: string };
}

export async function getYtdlpVersion(): Promise<{ version?: string; error?: string }> {
  const resp = await fetch("/api/ytdlp/version", {
    method: "GET",
  });

  return (await resp.json()) as { version?: string; error?: string };
}

export interface YtdlpExtractDataResponse {
  title?: string;
  artist?: string;
  error?: string;
}

export async function extractYtdlpVideoData(url: string): Promise<YtdlpExtractDataResponse> {
  const resp = await fetch(`/api/ytdlp/extract-data?url=${encodeURIComponent(url)}`, {
    method: "GET",
  });

  return (await resp.json()) as YtdlpExtractDataResponse;
}

export interface YtdlpBilibiliEpisodesResponse {
  videos?: YtdlpVideo[];
  error?: string;
}

interface YtdlpBilibiliEpisodesRawResponse {
  stdout?: string;
  error?: string;
}

/**
 * Fetches raw yt-dlp `-j` stdout for a Bilibili series URL, then parses NDJSON into videos.
 */
export async function getBilibiliEpisodesMetadata(
  url: string
): Promise<YtdlpBilibiliEpisodesResponse> {
  const resp = await fetch("/api/ytdlp/bilibili/episodes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
  });

  const body = (await resp.json()) as YtdlpBilibiliEpisodesRawResponse;
  if (body.error) {
    return { error: body.error };
  }
  const parsed = parseYtdlpPlaylistStdout(body.stdout ?? "");
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

function collectExecuteCmdOutput(
  request: ExecuteCmdRequest,
  timeoutMs?: number
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let exitCode: number | null = null;
    let settled = false;

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    executeCmdStream(
      request,
      {
        onMessage: (message) => {
          if (message.type === "stdout") {
            stdout += message.data;
            return;
          }
          if (message.type === "stderr") {
            stderr += message.data;
            return;
          }
          if (message.type === "system") {
            const { event, code, message: sysMsg } = message.data;
            if (event === "error") {
              settle(() => reject(new Error(sysMsg ?? "command failed to start")));
              return;
            }
            if (event === "timeout") {
              settle(() => reject(new Error("yt-dlp command timed out")));
              return;
            }
            if (event === "exit") {
              exitCode = code ?? null;
            }
          }
        },
        onComplete: () => {
          settle(() => resolve({ stdout, stderr, exitCode }));
        },
        onError: (err) => {
          settle(() => reject(err));
        },
      },
      timeoutMs
    );
  });
}

const YTDLP_COLLECTION_CMD_TIMEOUT_MS = 180_000;

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
