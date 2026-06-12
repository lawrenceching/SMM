import { createRequire } from "node:module"
import path from "node:path"
import type { IncomingMessage, ServerResponse } from "node:http"
import { getAppRoot } from "./paths"

export interface CoreRoutesModule {
  createCoreRoutesRequestHandler: (
    config: CoreRoutesConfig,
    options?: { fallbackPort?: number },
  ) => (req: IncomingMessage, res: ServerResponse) => void
  createNodeHttpFetch: () => typeof fetch
  createReverseProxyManager: (
    config: ReverseProxyConfig,
  ) => ReverseProxyManager
  createReverseProxyRequestHandler: (
    config: ReverseProxyConfig,
  ) => (req: IncomingMessage, res: ServerResponse) => void
  DEFAULT_ALLOWED_UPSTREAM_HOSTS: readonly string[]
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
