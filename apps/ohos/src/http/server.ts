import os from "node:os"
import http from "node:http"
import { app } from "electron"
import {
  loadCoreRoutes,
  type CoreRoutesLogger,
} from "../core-routes-loader"
import {
  getAppRoot,
  getDistDir,
  MAIN_HTTP_HELLO_BODY,
  MAIN_HTTP_ORIGIN,
  MAIN_HTTP_PORT,
} from "../paths"
import { applyCorsHeaders } from "./cors"
import { buildHelloConfig } from "./hello-config"
import { serveStaticFile } from "./static-files"

let mainHttpServer: http.Server | null = null
let reverseProxyUrl: string | null = null

function toPosixAllowlistEntry(dir: string): string {
  return dir.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "/$1")
}

function buildCoreRoutesAllowlist(): string[] {
  const entries = new Set<string>()
  const add = (dir: string | undefined) => {
    if (dir) entries.add(toPosixAllowlistEntry(dir))
  }

  try {
    add(app.getPath("userData"))
    add(app.getPath("temp"))
  } catch (err) {
    console.warn("[main] app.getPath failed, falling back to os.tmpdir():", err)
    add(os.tmpdir())
  }

  add(os.homedir())
  add(getAppRoot())

  return [...entries]
}

function createCoreRoutesLogger(): CoreRoutesLogger {
  return {
    debug: (obj, msg) => console.debug(`[core-routes] ${msg ?? "debug"}`, obj),
    info: (obj, msg) => console.info(`[core-routes] ${msg ?? "info"}`, obj),
    warn: (obj, msg) => console.warn(`[core-routes] ${msg ?? "warn"}`, obj),
    error: (obj, msg) => console.error(`[core-routes] ${msg ?? "error"}`, obj),
  }
}

export async function startMainHttpServer(): Promise<void> {
  if (mainHttpServer) return

  const {
    createCoreRoutesRequestHandler,
    createNodeHttpFetch,
    createReverseProxyManager,
    createReverseProxyRequestHandler,
    createSocketIOManager,
    DEFAULT_ALLOWED_UPSTREAM_HOSTS,
  } = loadCoreRoutes()

  const proxyLogger: CoreRoutesLogger = {
    debug: (obj, msg) => console.debug(`[reverse-proxy] ${msg ?? "debug"}`, obj),
    info: (obj, msg) => console.info(`[reverse-proxy] ${msg ?? "info"}`, obj),
    warn: (obj, msg) => console.warn(`[reverse-proxy] ${msg ?? "warn"}`, obj),
    error: (obj, msg) => console.error(`[reverse-proxy] ${msg ?? "error"}`, obj),
  }

  const nodeHttpFetch = createNodeHttpFetch()

  const reverseProxyConfig = {
    allowedUpstreamHosts: DEFAULT_ALLOWED_UPSTREAM_HOSTS,
    logger: proxyLogger,
    fetchImpl: nodeHttpFetch,
  }

  const reverseProxyManager = createReverseProxyManager(reverseProxyConfig)
  try {
    await reverseProxyManager.start()
    reverseProxyUrl = reverseProxyManager.url
    console.log(`[main] reverse proxy listening on ${reverseProxyUrl}`)
  } catch (err) {
    console.error("[main] failed to start reverse proxy:", err)
  }

  const allowlist = buildCoreRoutesAllowlist()
  console.log("[main] core-routes allowlist:", allowlist)

  const hello = buildHelloConfig(reverseProxyUrl)

  let socketManager: ReturnType<typeof createSocketIOManager> | null = null

  const coreRoutesHandler = createCoreRoutesRequestHandler(
    {
      allowlist,
      logger: createCoreRoutesLogger(),
      hello,
      appDataDir: typeof hello.appDataDir === "string" ? hello.appDataDir : undefined,
      broadcast: (message) => socketManager?.broadcast(message),
      fetchImpl: nodeHttpFetch,
    },
    { fallbackPort: MAIN_HTTP_PORT },
  )

  const reverseProxyHandler = createReverseProxyRequestHandler(reverseProxyConfig)

  mainHttpServer = http.createServer((req, res) => {
    applyCorsHeaders(req, res)

    if (req.method === "OPTIONS") {
      res.writeHead(204)
      res.end()
      return
    }

    const url = req.url?.split("?")[0] ?? ""

    if (url.startsWith("/socket.io/")) {
      return
    }

    if (req.method === "GET" && url === "/hello") {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" })
      res.end(MAIN_HTTP_HELLO_BODY)
      return
    }

    if (url.startsWith("/api/")) {
      coreRoutesHandler(req, res)
      return
    }

    if (url.startsWith("/tmdb/") || url.startsWith("/tvdb/")) {
      reverseProxyHandler(req, res)
      return
    }

    serveStaticFile(req, res, getDistDir())
  })

  socketManager = createSocketIOManager(mainHttpServer, {
    logger: createCoreRoutesLogger(),
    cors: { origin: "*", methods: ["GET", "POST"] },
  })

  mainHttpServer.on("error", (err) => {
    console.error("[main] HTTP server error:", err)
  })

  mainHttpServer.listen(MAIN_HTTP_PORT, "127.0.0.1", () => {
    console.log(`[main] HTTP server listening on ${MAIN_HTTP_ORIGIN}/`)
    console.log(`[main] Socket.IO available at ${MAIN_HTTP_ORIGIN}/socket.io/`)
  })
}
