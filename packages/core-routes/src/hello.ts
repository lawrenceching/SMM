import type { HelloFeatures, HelloResponseBody } from "@smm/types";
import { featureToggles } from "@smm/types/featureToggles";

export interface HelloOptions {
  /** CLI/ohos app version, e.g. "1.3.8". */
  version: string;
  /**
   * CLI process platform. Defaults to `process.platform` in {@link doHello}.
   * Tests may override.
   */
  platform?: string;
  /** POSIX or platform-specific user-data dir. */
  userDataDir: string;
  appDataDir: string;
  logDir: string;
  tmpDir: string;
  /** Reverse proxy base URL or null when not yet started. */
  reverseProxyUrl: string | null;
  /** OS locale, e.g. "en-US", "zh-CN". */
  osLocale: string;
  /** True when the process is running inside Docker. */
  isDocker: boolean;
  /**
   * Port of the unified HTTP server (static UI + API).
   * Same value as the process listen port (`HTTP_PORT` / `--port`).
   * Kept as `coreRoutesPort` for wire compatibility with existing clients.
   */
  coreRoutesPort: number;
  /** When omitted, {@link doHello} fills in {@link featureToggles}. */
  features?: HelloFeatures;
}

export function doHello(options: HelloOptions): HelloResponseBody {
  return {
    uptime: process.uptime(),
    ...options,
    platform: options.platform ?? process.platform,
    subtitleDownloadSupported: process.arch !== "arm64",
    features: options.features ?? featureToggles(),
  };
}
