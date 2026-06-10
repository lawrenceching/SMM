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
