export type TaskRecord = {
  name: string;
  exitCode: number;
  startTime: number;
  endTime: number;
  timedOut: boolean;
};

export type RunOptions = {
  configPath: string;
  cwd?: string;
  signal?: AbortSignal;
};

export type RunResult = {
  name: string;
  exitCode: 0 | 1;
  outputDir: string;
  taskResults: TaskRecord[];
};
