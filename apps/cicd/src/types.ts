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
};

export type RunResult = {
  exitCode: 0 | 1;
  outputDir: string;
  taskResults: TaskRecord[];
};
