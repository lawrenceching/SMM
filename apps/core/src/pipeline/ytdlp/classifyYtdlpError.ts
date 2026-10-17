/**
 * Known yt-dlp error types during inspect (`-J`) or download.
 * Stable identifiers for snapshots; UI maps them to localized copy.
 */
export type YtdlpErrorType =
  | "cookie-expired"
  | "bot-detection"
  | "age-restricted"
  | "login-required"
  | "format-unavailable"
  | "unsupported-url"
  | "video-unavailable"
  | "geo-restricted"
  | "http-403"
  | "http-404"
  | "http-410"
  | "http-412"
  | "http-429"
  | "http-5xx"
  | "connection-timeout"
  | "network-error"
  | "ffmpeg-missing"
  | "postprocessing-error"
  | "same-file-error"
  | "keyboard-interrupt"
  | "content-too-short"
  | "player-request-failed"
  | "options-error"
  | "download-cancelled"
  | "http-error"
  | "executable-not-found"
  | "api-network-error"
  | "unknown";

export interface ClassifyYtdlpErrorInput {
  stderr: string;
  stdout: string;
  exitCode: number | null;
}

export interface YtdlpErrorResult {
  type: YtdlpErrorType;
  /** Optional context (e.g. hostname for timeouts). */
  context?: string;
}

/**
 * Classifies yt-dlp stderr/stdout/exitCode into a stable error type.
 */
export function classifyYtdlpError(input: ClassifyYtdlpErrorInput): YtdlpErrorResult {
  const { stderr, stdout, exitCode } = input;
  const text = [stderr ?? "", stdout ?? ""].filter(Boolean).join("\n");

  if (exitCode === 101) {
    return { type: "download-cancelled" };
  }

  if (exitCode === 2) {
    return { type: "options-error" };
  }

  if (/The provided YouTube account cookies are no longer valid/i.test(text)) {
    return { type: "cookie-expired" };
  }

  if (/confirm you('re| are) not a bot/i.test(text)) {
    return { type: "bot-detection" };
  }

  if (/age-restricted|confirm your age/i.test(text)) {
    return { type: "age-restricted" };
  }

  if (/Sign in to confirm/i.test(text)) {
    return { type: "login-required" };
  }

  if (/Requested format is not available/i.test(text)) {
    return { type: "format-unavailable" };
  }

  if (/Unsupported URL/i.test(text)) {
    return { type: "unsupported-url" };
  }

  if (
    /Private video|Video unavailable|this video (is|has been) removed|live event has ended/i.test(
      text,
    )
  ) {
    return { type: "video-unavailable" };
  }

  if (/Geo-restricted|This content is (not available|geo-restricted)/i.test(text)) {
    return { type: "geo-restricted" };
  }

  if (/HTTP Error 403/i.test(text)) {
    return { type: "http-403" };
  }

  if (/HTTP Error 404/i.test(text)) {
    return { type: "http-404" };
  }

  if (/HTTP Error 410/i.test(text)) {
    return { type: "http-410" };
  }

  if (/HTTP Error 412/i.test(text)) {
    return { type: "http-412" };
  }

  if (/HTTP Error 429/i.test(text)) {
    return { type: "http-429" };
  }

  if (/HTTP Error 5\d\d/i.test(text)) {
    return { type: "http-5xx" };
  }

  const connectionTimeoutMatch = /Connection to (\S+?) timed out/i.exec(text);
  if (connectionTimeoutMatch) {
    return { type: "connection-timeout", context: connectionTimeoutMatch[1] };
  }

  if (
    /Unable to download webpage/i.test(text) ||
    /urlopen error/i.test(text) ||
    /getaddrinfo/i.test(text) ||
    /SSL: CERTIFICATE_VERIFY_FAILED/i.test(text) ||
    /Failed to resolve/i.test(text) ||
    /Temporary failure in name resolution/i.test(text) ||
    /No address associated with hostname/i.test(text)
  ) {
    return { type: "network-error" };
  }

  if (/ffprobe and ffmpeg not found/i.test(text) || /mkvmerge not found/i.test(text)) {
    return { type: "ffmpeg-missing" };
  }

  if (/Post-processing/i.test(text) && /ERROR/i.test(text)) {
    return { type: "postprocessing-error" };
  }

  if (/already exists/i.test(text) && /ERROR/i.test(text)) {
    return { type: "same-file-error" };
  }

  if (/Interrupted by user/i.test(text)) {
    return { type: "keyboard-interrupt" };
  }

  const httpStatusMatch = /HTTP ([45]\d\d)/.exec(text);
  if (httpStatusMatch) {
    return { type: "http-error", context: httpStatusMatch[1] };
  }

  if (/executable not found/i.test(text)) {
    return { type: "executable-not-found" };
  }

  if (/Failed to fetch|NetworkError when attempting to fetch resource|Load failed/i.test(text)) {
    return { type: "api-network-error" };
  }

  if (/Incomplete data received/i.test(text)) {
    return { type: "content-too-short" };
  }

  if (/Player request failed/i.test(text)) {
    return { type: "player-request-failed" };
  }

  return { type: "unknown" };
}
