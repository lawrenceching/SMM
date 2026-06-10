import type { HelloResponseBody } from "@smm/core/types";

export interface HelloOptions {
  /** CLI/ohos app version, e.g. "1.3.8". */
  version: string;
  /** POSIX or platform-specific user-data dir. */
  userDataDir: string;
  appDataDir: string;
  logDir: string;
  tmpDir: string;
  /** Reverse proxy base URL or null when not yet started. */
  reverseProxyUrl: string | null;
  /** OS locale, e.g. "en-US", "zh-CN". */
  osLocale: string;
}

export function doHello(options: HelloOptions): HelloResponseBody {
  return {
    uptime: process.uptime(),
    ...options,
  };
}
