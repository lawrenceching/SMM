import type { IncomingMessage, ServerResponse } from "node:http";
import type { HelloOptions } from "./hello.ts";

export interface CoreRoutesLogger {
  debug(obj: Record<string, unknown>, msg?: string): void;
  info(obj: Record<string, unknown>, msg?: string): void;
  warn(obj: Record<string, unknown>, msg?: string): void;
  error(obj: Record<string, unknown>, msg?: string): void;
}

export interface CoreRoutesConfig {
  /** POSIX-format paths allowed for writeFile operations */
  allowlist: string[];
  logger?: CoreRoutesLogger;
  /** When set, POST /api/hello returns bootstrap handshake data via doHello. */
  hello?: HelloOptions;
  /**
   * POSIX or platform-specific app-data directory where media metadata
   * cache files live (e.g. `{appDataDir}/metadata/{sanitized-folder}.json`).
   *
   * Currently informational — the allowlist already covers `appDataDir`
   * via `buildAllowlist` so file-mutating routes (`writeFile`,
   * `deleteFile`) validate paths through the allowlist. The field is
   * exposed here for symmetry with `hello` and for future APIs that
   * need explicit `appDataDir` access (e.g. a route that enumerates
   * or inspects media metadata files).
   */
  appDataDir?: string;
}

export interface RouteContext {
  config: CoreRoutesConfig;
  url: URL;
}

export type RouteHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RouteContext,
) => Promise<boolean>;
