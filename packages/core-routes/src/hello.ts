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
  /**
   * Port that the core-routes Node `http` server is listening on.
   * The UI uses this to call endpoints that live on core-routes
   * (e.g. `POST /api/isFolderAvailable`) when the UI's origin is
   * the Hono Bun server (cli port 30000), not the core-routes Node
   * server. Defaults to 3001 (the standard core-routes fallback port).
   */
  coreRoutesPort: number;
}

export function doHello(options: HelloOptions): HelloResponseBody {
  return {
    uptime: process.uptime(),
    ...options,
  };
}
