export interface VideoCaptionerRunRequest {
  args: string[];
  onStdoutLine?: (line: string) => void;
  onStderrLine?: (line: string) => void;
}

export interface VideoCaptionerRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface VideoCaptionerPort {
  run(request: VideoCaptionerRunRequest, signal: AbortSignal): Promise<VideoCaptionerRunResult>;
}
