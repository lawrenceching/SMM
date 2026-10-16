/** Request to run a whitelisted host command (yt-dlp for download video). */
export interface CommandRunRequest {
  command: "yt-dlp";
  args: string[];
  onStdoutLine?: (line: string) => void;
  onStderrLine?: (line: string) => void;
}

export interface CommandRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Host-supplied process runner. Core owns argv and business logic;
 * the host owns spawn / PTY / ffmpeg-location injection.
 */
export interface CommandPort {
  run(request: CommandRunRequest, signal: AbortSignal): Promise<CommandRunResult>;
}
