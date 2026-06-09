import type { IncomingMessage, ServerResponse } from "node:http";

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
