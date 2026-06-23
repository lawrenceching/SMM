import type { IncomingMessage, ServerResponse } from "node:http";
import type { HelloOptions } from "./hello.ts";
import type { ChatConfig } from "./chatTypes.ts";
import type { McpLifecycleManager } from "./mcp/lifecycleTypes.ts";

export interface CoreRoutesLogger {
  debug(obj: Record<string, unknown>, msg?: string): void;
  info(obj: Record<string, unknown>, msg?: string): void;
  warn(obj: Record<string, unknown>, msg?: string): void;
  error(obj: Record<string, unknown>, msg?: string): void;
}

export interface CoreRoutesAuthConfig {
  enabled: boolean;
  token: string;
}

import type { WebSocketMessage } from "./socketIO/types.ts";

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
  /** Optional Socket.IO broadcast; used by renameFiles after metadata update */
  broadcast?: (message: WebSocketMessage) => void;
  /**
   * Optional fetch implementation for routes that perform outbound HTTP
   * (e.g. downloadImage). Use {@link createNodeHttpFetch} on runtimes where
   * global `fetch` is unavailable (OHOS Electron / WebAssembly missing).
   */
  fetchImpl?: typeof fetch;
  /**
   * When set, `POST /api/chat` is mounted onto the core-routes
   * `node:http` server. The host (cli Bun, OHOS Electron Main, etc.)
   * supplies the AI provider factory, user-config reader, and
   * Socket.IO helpers; `core-routes` provides the chat pipeline
   * (request validation, agent tool set, streaming response) shared
   * across runtimes.
   */
  chat?: ChatConfig;
  /**
   * When set, mounts `PUT /api/mcp/start`, `PUT /api/mcp/stop`, and
   * `GET /api/mcp/status`. The host injects a runtime-specific
   * {@link McpLifecycleManager} (Bun separate port or OHOS gate).
   */
  mcp?: {
    manager: McpLifecycleManager;
  };
  /**
   * Optional Bearer token auth for HTTP routes. When `enabled` is true,
   * requests must send `Authorization: Bearer <token>`.
   */
  auth?: CoreRoutesAuthConfig;
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
