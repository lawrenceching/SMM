import {
  DummyJob,
  NodejsFsAdapter,
  NoopLoggerAdapter,
  type AppContext,
  type FsPort,
  type JobOptions,
  type LoggerPort,
  type NetworkPort,
  type PlatformPorts,
} from "@smm/core";

export type NodejsDummyJobOptions = {
  id: string;
  logDir: string;
  join?: JobOptions["join"];
  printLogToConsole?: boolean;
  fs?: FsPort;
  logger?: LoggerPort;
  network?: NetworkPort;
  context?: Partial<AppContext>;
};

/**
 * Node/Bun host wrapper around {@link DummyJob}.
 * Wires platform Ports by default; callers may override individual deps.
 */
export class NodejsDummyJob extends DummyJob {
  constructor(options: NodejsDummyJobOptions) {
    const fs = options.fs ?? new NodejsFsAdapter();
    const logger = options.logger ?? new NoopLoggerAdapter();
    const context: AppContext = {
      appDataDir: "/tmp/smm",
      userDataDir: "/tmp/smm",
      osLocale: "en-US",
      tmpDir: "/tmp",
      logDir: options.logDir,
      ...options.context,
    };
    const ports: PlatformPorts = {
      fs,
      network: options.network ?? ({ fetch: async () => {
        throw new Error("network not configured for NodejsDummyJob");
      } } satisfies NetworkPort),
      logger,
      normalizePosix: (path) => path,
    };
    super(context, ports, {
      id: options.id,
      logDir: options.logDir,
      join: options.join ?? ((...parts: string[]) => parts.filter(Boolean).join("/")),
      printLogToConsole: options.printLogToConsole ?? false,
      callbacks: {},
    });
  }
}
