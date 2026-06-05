import { YTDLP_DOWNLOAD_ALLOWED_ARGS } from "./constants";

export const YTDLP_COOKIES_FROM_BROWSER_NAMES = ["chrome", "edge", "firefox"] as const;
export type YtdlpCookiesFromBrowserName = (typeof YTDLP_COOKIES_FROM_BROWSER_NAMES)[number];

export function isYtdlpCookiesFromBrowserName(
  value: string,
): value is YtdlpCookiesFromBrowserName {
  return (YTDLP_COOKIES_FROM_BROWSER_NAMES as readonly string[]).includes(value);
}

export interface YtdlpDownloadRequestInput {
  url: string;
  folder: string;
  args?: string[];
  format?: string;
  /** Absolute path to Netscape-format cookies file for `--cookies`. */
  cookiesFile?: string;
  /** Browser profile for `--cookies-from-browser` (e.g. chrome, edge, firefox). */
  cookiesFromBrowser?: string;
  /** JS runtime name for `--js-runtimes` (e.g. "quickjs"). */
  jsRuntime?: string;
  /** Absolute path to the JS runtime binary. */
  jsRuntimePath?: string;
  /** Proxy URL for `--proxy` (http, https, socks5). */
  proxy?: string;
  /**
   * When set, `--print <printArg>` is appended to the args.
   * Default is undefined (no --print) so progress JSON lines remain on
   * stdout for log-polling progress display.
   */
  printArg?: string;
}

export function validateYtdlpDownloadExtraArgs(args?: string[]): string | undefined {
  if (!args || args.length === 0) {
    return undefined;
  }
  const allowed = YTDLP_DOWNLOAD_ALLOWED_ARGS as readonly string[];
  if (!args.every((arg) => allowed.includes(arg))) {
    return `Only allowed args are: ${allowed.join(", ")}`;
  }
  return undefined;
}

/**
 * yt-dlp argv for executeCmd (`command: "yt-dlp"`).
 * Server may prepend `--ffmpeg-location` when spawning.
 */
export function buildYtdlpDownloadArgs(input: YtdlpDownloadRequestInput): string[] {
  const outputTemplate = `${input.folder.replace(/\\/g, "/")}/%(title)s [%(id)s].%(ext)s`;
  // --print is controlled by enablePrintArgInYtdlpCommand feature flag.
  // When set, --print <printArg> is appended; when absent (default),
  // stdout carries progress JSON lines for log-polling progress display.
  const args: string[] = ["--output", outputTemplate];

  if (input.printArg) {
    args.push("--print", input.printArg);
  }
  const proxy = input.proxy?.trim();
  if (proxy) {
    args.push("--proxy", proxy);
  }

  const format = input.format?.trim();
  if (format) {
    args.push("-f", format);
  }

  const cookiesFile = input.cookiesFile?.trim();
  if (cookiesFile) {
    args.push("--cookies", cookiesFile);
  }

  const browser = input.cookiesFromBrowser?.trim().toLowerCase();
  if (browser && isYtdlpCookiesFromBrowserName(browser)) {
    args.push("--cookies-from-browser", browser);
  }

  const jsRuntime = input.jsRuntime?.trim();
  const jsRuntimePath = input.jsRuntimePath?.trim();
  if (jsRuntime) {
    args.push("--js-runtimes", jsRuntimePath ? `${jsRuntime}:${jsRuntimePath}` : jsRuntime);
  }

  args.push(input.url);

  if (input.args && input.args.length > 0) {
    args.push(...input.args);
  }

  return args;
}

/**
 * Last non-empty stdout line from yt-dlp.
 * Previously used with `--print after_move:filepath` to extract the download path.
 * That flag is now removed (it suppressed progress output), so this function
 * returns the last progress NDJSON line. The result is currently unused.
 */
export function parseYtdlpDownloadStdout(stdout: string): string {
  const lines = stdout.trim().split("\n").filter((l) => l.trim());
  return lines[lines.length - 1]?.trim() ?? "";
}
