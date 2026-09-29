import {
  DummyJob,
  NodejsFsAdapter,
  NoopLoggerAdapter,
  type FsPort,
  type JobOptions,
  type LoggerPort,
} from "@smm/core";

export type NodejsDummyJobOptions = {
  name: string;
  logDir: string;
  join?: JobOptions["join"];
  printLogToConsole?: boolean;
  fs?: FsPort;
  logger?: LoggerPort;
};

/**
 * Node/Bun host wrapper around {@link DummyJob}.
 * Wires platform Ports by default; callers may override individual deps.
 */
export class NodejsDummyJob extends DummyJob {
  constructor(options: NodejsDummyJobOptions) {
    super({
      name: options.name,
      logDir: options.logDir,
      join: options.join ?? ((...parts: string[]) => parts.join("/")),
      printLogToConsole: options.printLogToConsole ?? false,
      fs: options.fs ?? new NodejsFsAdapter(),
      logger: options.logger ?? new NoopLoggerAdapter(),
    });
  }
}
