import type { YtdlpVideo } from "@core/types/YtdlpTypes";
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
