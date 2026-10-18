export interface FfmpegRunRequest {
  command: "ffmpeg" | "ffprobe";
  args: string[];
  onStdoutLine?: (line: string) => void;
  onStderrLine?: (line: string) => void;
}

export interface FfmpegRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface FfmpegPort {
  run(request: FfmpegRunRequest, signal: AbortSignal): Promise<FfmpegRunResult>;
}
