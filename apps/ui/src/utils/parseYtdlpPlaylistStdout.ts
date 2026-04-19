import type { YtdlpVideo } from "@core/types/YtdlpTypes";

export type ParseYtdlpPlaylistStdoutResult =
  | { videos: YtdlpVideo[] }
  | { error: string };

/**
 * Parses yt-dlp `-j` stdout: one JSON object per line (NDJSON).
 */
export function parseYtdlpPlaylistStdout(
  stdout: string
): ParseYtdlpPlaylistStdoutResult {
  const videos: YtdlpVideo[] = [];
  const lines = stdout.split(/\r?\n/);
  let lineIndex = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    lineIndex++;
    try {
      videos.push(JSON.parse(trimmed) as YtdlpVideo);
    } catch {
      return { error: `invalid JSON on stdout line ${lineIndex}` };
    }
  }

  return { videos };
}
