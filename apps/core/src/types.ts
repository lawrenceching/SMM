import type { HostPerformanceStore } from "./clients/hostPerformance";
import type { DiscoverPort } from "./ports/DiscoverPort";
import type { FsPort } from "./ports/FsPort";
import type { LoggerPort } from "./ports/LoggerPort";
import type { NetworkPort } from "./ports/NetworkPort";

/**
 * Application paths, locale, and bootstrap identity shared across pipelines and jobs.
 * Jobs/pipelines receive a fully resolved context (userDataDir / osLocale always set).
 */
export interface AppContext {
  appDataDir: string;
  userDataDir: string;
  osLocale: string;
  /** App version string (e.g. "1.3.8"). */
  version?: string;
  /** Reverse proxy base URL. */
  reverseProxyUrl?: string | null;
  /** Hello appDataDir; may differ from smm.json root on Linux. */
  reportedAppDataDir?: string;
  /** Tmp dir for hello bootstrap. */
  tmpDir?: string;
  /** Log dir for hello bootstrap / job logs. */
  logDir?: string;
  /** Process platform for hello bootstrap. */
  platform?: string;
}

/**
 * Host-supplied context for {@link Core} construction.
 * Core defaults `userDataDir` → `appDataDir` and leaves `osLocale` unset until hello.
 */
export type AppContextInput = Omit<AppContext, "userDataDir" | "osLocale"> & {
  userDataDir?: string;
  osLocale?: string;
};

/** Platform adapters injected by the host (CLI / Electron / OHOS), including Core-owned helpers. */
export interface PlatformPorts {
  fs: FsPort;
  network: NetworkPort;
  logger: LoggerPort;
  normalizePosix: (path: string) => string;
  discover?: DiscoverPort;
  hostPerformance?: HostPerformanceStore;
}

/**
 * Ports the host injects into {@link Core}.
 * Core fills `normalizePosix` and owns `hostPerformance`.
 */
export interface PlatformPortsInput {
  fs: FsPort;
  network: NetworkPort;
  logger?: LoggerPort;
  discover?: DiscoverPort;
}
