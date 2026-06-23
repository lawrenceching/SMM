import type { IncomingMessage, ServerResponse } from "node:http"
import type { SocketIOManager } from "../core-routes-loader"
import { loadCoreRoutes } from "../core-routes-loader"
import { nodeRequestToWebRequest, writeWebResponse } from "./webRequestAdapter"
import { isOhosMcpEnabled } from "./ohosMcpLifecycleManager"
import { MAIN_HTTP_ORIGIN } from "../paths"
import type { UserConfig } from "@smm/core/types"

type McpRequestHandler = (req: Request) => Promise<Response>

/**
 * Lazily-initialised MCP HTTP handler. Created on the first
 * `/mcp/*` request so the OHOS main process boots fast and the
 * handler is built only when an external AI assistant actually
 * connects.
 *
 * The handler itself is the shared
 * {@link createMcpStreamableHttpHandler} from `@smm/core-routes`,
 * which returns a `(req: Request) => Promise<Response>`. The
 * OHOS-specific bit here is the dependency-injection layer:
 *  - `getUserConfig` is the same `node:fs`-based reader used by
 *    the OHOS chat pipeline (see `server.ts#chatConfig`).
 *  - `appDataDir` is resolved from `hello.appDataDir` so the
 *    metadata cache + plan files match the chat pipeline.
 *  - `acknowledge` delegates to the existing Socket.IO manager.
 *  - `logger` is the same console-backed logger used by
 *    `core-routes` HTTP requests.
 */
let mcpHandlerPromise: Promise<McpRequestHandler> | null = null

export interface CreateMcpHandlerOptions {
  appDataDir: string
  getUserConfig: () => Promise<UserConfig>
  /** Returns the live Socket.IO manager. May return `null` before the
   *  manager is constructed (the OHOS server boots the manager
   *  shortly after `http.createServer`); the MCP acknowledge
   *  handler tolerates this and resolves `undefined`. */
  getSocketManager: () => SocketIOManager | null
  logger: {
    debug: (obj: unknown, msg?: string) => void
    info: (obj: unknown, msg?: string) => void
    warn: (obj: unknown, msg?: string) => void
    error: (obj: unknown, msg?: string) => void
  }
}

export function getMcpHandler(
  options: CreateMcpHandlerOptions,
): Promise<McpRequestHandler> {
  if (mcpHandlerPromise) return mcpHandlerPromise

  mcpHandlerPromise = (async () => {
    const coreRoutesModule = loadCoreRoutes() as Record<string, unknown>
    const createMcpStreamableHttpHandler =
      coreRoutesModule.createMcpStreamableHttpHandler as
        | ((config: unknown) => Promise<McpRequestHandler>)
        | undefined

    if (!createMcpStreamableHttpHandler) {
      throw new Error(
        "createMcpStreamableHttpHandler is not available in the core-routes bundle. Rebuild core-routes: pnpm --filter @smm/core-routes build:cjs",
      )
    }

    return createMcpStreamableHttpHandler({
      getUserConfig: options.getUserConfig,
      appDataDir: options.appDataDir,
      acknowledge: async (
        message: unknown,
        timeoutMs?: number,
      ) => {
        const manager = options.getSocketManager()
        if (!manager) return undefined
        return manager.acknowledge(message as never, timeoutMs)
      },
      broadcast: (message) => {
        const manager = options.getSocketManager()
        if (!manager) return
        manager.broadcast(message as never)
      },
      logger: options.logger,
    })
  })()

  return mcpHandlerPromise
}

/**
 * Drop the cached MCP handler. Useful for tests; the next call to
 * {@link getMcpHandler} rebuilds the handler with a fresh
 * `McpServer` and transport.
 */
export function resetMcpHandler(): void {
  mcpHandlerPromise = null
}

/**
 * Handle a `node:http` request destined for `/mcp/*`. Converts
 * the `IncomingMessage` to a Web `Request`, dispatches it through
 * the MCP handler, and writes the resulting Web `Response` back
 * to the `ServerResponse`.
 *
 * Returns `true` if the request was handled, `false` if the URL
 * does not start with `/mcp/` (so the caller can fall through to
 * other handlers).
 */
export async function handleMcpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: CreateMcpHandlerOptions,
): Promise<boolean> {
  const url = req.url?.split("?")[0] ?? ""
  if (!url.startsWith("/mcp/") && url !== "/mcp") return false

  if (!isOhosMcpEnabled()) {
    if (!res.headersSent) {
      res.writeHead(503, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "MCP server is stopped" }))
    }
    return true
  }

  try {
    const handler = await getMcpHandler(options)
    const webRequest = await nodeRequestToWebRequest(req, MAIN_HTTP_ORIGIN)
    const webResponse = await handler(webRequest)
    await writeWebResponse(res, webResponse)
    return true
  } catch (err) {
    console.error("[mcp] request handling failed:", err)
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" })
      res.end(
        JSON.stringify({
          error: "MCP request failed",
          message: err instanceof Error ? err.message : String(err),
        }),
      )
    } else {
      res.end()
    }
    return true
  }
}
