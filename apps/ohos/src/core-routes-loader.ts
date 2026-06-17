import { createRequire } from "node:module"
import path from "node:path"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { Server as HttpServer } from "node:http"
import { getAppRoot } from "./paths"

export interface SocketIOManager {
  io: unknown
  broadcast: (message: WebSocketMessage) => void
  acknowledge: (message: WebSocketMessage, timeoutMs?: number) => Promise<unknown>
  getSocketIOInstance: () => unknown
  getFirstAvailableSocket: () => { socket: unknown; clientId: string } | null
  findSocketByClientId: (clientId?: string) => { socket: unknown; clientId: string }
  getFirstActiveConnection: () => string | null
  isClientConnected: (clientId: string) => boolean
  getConnectedClientIds: () => string[]
}

export interface WebSocketMessage {
  event: string
  data?: unknown
  clientId?: string
}

export interface CoreRoutesModule {
  createCoreRoutesRequestHandler: (
    config: CoreRoutesConfig,
    options?: { fallbackPort?: number },
  ) => (req: IncomingMessage, res: ServerResponse) => void
  createNodeHttpFetch: () => typeof fetch
  /** @since 1.3.8 — streaming variant; falls back to createNodeHttpFetch on old bundles */
  createStreamingNodeHttpFetch?: () => typeof fetch
  createReverseProxyManager: (
    config: ReverseProxyConfig,
  ) => ReverseProxyManager
  createReverseProxyRequestHandler: (
    config: ReverseProxyConfig,
  ) => (req: IncomingMessage, res: ServerResponse) => void
  createSocketIOManager: (
    httpServer: HttpServer,
    config?: SocketIOConfig,
  ) => SocketIOManager
  DEFAULT_ALLOWED_UPSTREAM_HOSTS: readonly string[]
  createOpenAICompatible?: (
    opts: { name: string; baseURL: string; apiKey: string },
  ) => unknown
  migrateAIConfig?: (raw: Record<string, unknown>) => boolean
}

export interface SocketIOConfig {
  logger?: CoreRoutesLogger
  cors?: { origin: string; methods: string[] }
  path?: string
}

export interface CoreRoutesLogger {
  debug: (obj: unknown, msg?: string) => void
  info: (obj: unknown, msg?: string) => void
  warn: (obj: unknown, msg?: string) => void
  error: (obj: unknown, msg?: string) => void
}

export interface CoreRoutesConfig {
  allowlist: string[]
  logger: CoreRoutesLogger
  hello: Record<string, unknown>
  appDataDir?: string
  broadcast?: (message: WebSocketMessage) => void
  fetchImpl?: typeof fetch
  /**
   * Optional chat config. When set, `POST /api/chat` is mounted onto
   * the core-routes `node:http` server. The shape is a superset of
   * the fields the OHOS main process injects at startup.
   */
  chat?: {
    appDataDir: string
    logger: CoreRoutesLogger
    createAIProvider: (userConfig: unknown) => unknown
    getUserConfig: () => Promise<unknown>
    acknowledge?: (message: unknown, timeoutMs?: number) => Promise<unknown>
  }
}

export interface ReverseProxyConfig {
  allowedUpstreamHosts: readonly string[]
  logger: CoreRoutesLogger
  fetchImpl: typeof fetch
}

export interface ReverseProxyManager {
  start: () => Promise<void>
  url: string | null
}

export function loadCoreRoutes(): CoreRoutesModule {
  const require = createRequire(path.join(getAppRoot(), "package.json"))
  return require(path.join(getAppRoot(), "core-routes.js")) as CoreRoutesModule
}
