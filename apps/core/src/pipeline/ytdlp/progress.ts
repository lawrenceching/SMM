/**
 * Progress template JSON passed to `yt-dlp --progress-template`.
 * Fields match the historical server inject template; percent/speed are quoted
 * so literal `NA` from yt-dlp remains valid JSON.
 */
export const YTDLP_PROGRESS_TEMPLATE =
  '{"percent": "%(progress._percent_json)s", "speed": "%(progress.speed)r", "eta": "%(progress.eta)r", "downloaded": "%(progress.downloaded_bytes)r", "total": "%(progress.total_bytes)r", "status": "%(progress.status)s"}';

export interface YtdlpProgressData {
  percent: number;
  speed: number;
  eta: number | null;
  downloaded: number | null;
  total: number | null;
  status: "downloading" | "finished";
}

/** Replace bare `NA` tokens with `null` so JSON.parse succeeds. */
function sanitizeYtdlpProgressLine(line: string): string {
  return line.replace(/: *NA\b/g, ":null");
}

function parseProgressNumericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    if (value === "NA" || value.trim() === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Parse a single stdout line that looks like yt-dlp progress JSON.
 * Returns null when the line is not progress JSON.
 */
export function parseYtdlpProgressLine(line: string): YtdlpProgressData | null {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(sanitizeYtdlpProgressLine(line)) as Record<string, unknown>;
  } catch {
    return null;
  }
  const statusRaw = parsed.status;
  if (statusRaw !== "downloading" && statusRaw !== "finished") {
    return null;
  }
  const downloaded = parseProgressNumericValue(parsed.downloaded);
  const total = parseProgressNumericValue(parsed.total);
  let percent: number | null = null;
  if (typeof parsed.percent === "string") {
    const cleaned = parsed.percent.replace(/%$/g, "").trim();
    percent = parseProgressNumericValue(cleaned);
  } else {
    percent = parseProgressNumericValue(parsed.percent);
  }
  if (percent == null && downloaded != null && total != null && total > 0) {
    percent = (downloaded / total) * 100;
  }
  if (percent == null) percent = 0;
  const speed = parseProgressNumericValue(parsed.speed) ?? 0;
  const eta = parseProgressNumericValue(parsed.eta);
  return {
    percent,
    speed,
    eta,
    downloaded,
    total,
    status: statusRaw,
  };
}

/** Append `--newline` + `--progress-template` for download invocations (`--output` present). */
export function injectYtdlpProgressArgs(args: string[]): string[] {
  if (args.includes("--progress-template") || args.includes("--newline")) {
    return args;
  }
  if (!args.includes("--output")) {
    return args;
  }
  return [...args, "--newline", "--progress-template", YTDLP_PROGRESS_TEMPLATE];
}
