import { YTDLP_DOWNLOAD_ALLOWED_ARGS } from "./constants";

export interface YtdlpDownloadRequestInput {
  url: string;
  folder: string;
  args?: string[];
  format?: string;
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
  const args: string[] = ["--output", outputTemplate, "--print", "after_move:filepath"];

  const format = input.format?.trim();
  if (format) {
    args.push("-f", format);
  }

  args.push(input.url);

  if (input.args && input.args.length > 0) {
    args.push(...input.args);
  }

  return args;
}

/** Last non-empty stdout line from yt-dlp `--print after_move:filepath`. */
export function parseYtdlpDownloadStdout(stdout: string): string {
  const lines = stdout.trim().split("\n").filter((l) => l.trim());
  return lines[lines.length - 1]?.trim() ?? "";
}
