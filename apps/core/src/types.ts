import type { HostPerformanceStore } from "./clients/hostPerformance";
import type { DiscoverPort } from "./ports/DiscoverPort";
import type { FsPort } from "./ports/FsPort";
import type { LoggerPort } from "./ports/LoggerPort";
import type { NetworkPort } from "./ports/NetworkPort";

/** Application paths and locale shared across pipelines and jobs. */
export interface AppContext {
  appDataDir: string;
  userDataDir: string;
  osLocale: string;
}

/** Platform adapters injected by the host (CLI / Electron / OHOS). */
export interface PlatformPorts {
  fs: FsPort;
  network: NetworkPort;
  logger: LoggerPort;
  normalizePosix: (path: string) => string;
  discover?: DiscoverPort;
  hostPerformance?: HostPerformanceStore;
}
