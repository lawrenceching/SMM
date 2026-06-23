import fs from "node:fs/promises"
import http from "node:http"
import os from "node:os"
import path from "node:path"
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
import { handleMcpRequest, resetMcpHandler } from "./mcp"
import { createOhosMcpLifecycleManager } from "./ohosMcpLifecycleManager"
import { activateOhosPersistedFileAccess } from "./ohosFileAccess"
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

// OHOS Electron (openharmony-sig/electron, musl + aarch64) compiles its
// Node.js runtime without WebAssembly support. The built-in `fetch`
// (undici) depends on WebAssembly internally, so any code path that
// calls `fetch()` — including the AI SDK's `streamText` — would crash
// with `ReferenceError: WebAssembly is not defined`.
//
// The fix is twofold:
//
// 1. Replace `globalThis.fetch` with `createStreamingNodeHttpFetch()`.
//    This is a streaming-capable fetch backed by `node:http` / `node:https`
//    (no WebAssembly dependency). The response body is a true Web
//    `ReadableStream` (converted via `Readable.toWeb`), so the AI SDK
//    can process SSE events incrementally.
//
// 2. Polyfill `globalThis.WebAssembly` with a minimal object so that
//    any `typeof WebAssembly !== "undefined"` guard passes, preventing
//    `ReferenceError` crashes from other conditional code paths.
//
// These patches apply ONLY to the OHOS Electron main process. Desktop
// (Bun) and the UI renderer are unaffected.
if (typeof globalThis.WebAssembly === "undefined") {
  const dummyWasm = {
    Module: class {},
    Instance: class {},
    compile: () => Promise.reject(new Error("WebAssembly not available on this platform")),
    compileStreaming: () => Promise.reject(new Error("WebAssembly not available on this platform")),
    instantiate: () => Promise.reject(new Error("WebAssembly not available on this platform")),
    instantiateStreaming: () => Promise.reject(new Error("WebAssembly not available on this platform")),
    validate: () => false,
  }
  ;(globalThis as Record<string, unknown>).WebAssembly = dummyWasm
}

export async function startMainHttpServer(): Promise<void> {
  if (mainHttpServer) return

  const coreRoutesModule = loadCoreRoutes()

  // Destructure the streaming fetch if available, fall back to the
  // buffered fetch for backward compatibility.
  const {
    createStreamingNodeHttpFetch,
    createNodeHttpFetch,
  } = coreRoutesModule as typeof coreRoutesModule & {
    createStreamingNodeHttpFetch?: () => typeof fetch
  }

  // Replace the built-in Node fetch (which depends on WebAssembly via
  // undici) with the streaming node:http-based implementation. All code
  // paths that call `fetch()` — reverse proxy, AI SDK streamText, etc.
  // — will use this instead.
  const fetchImpl: typeof fetch = createStreamingNodeHttpFetch
    ? createStreamingNodeHttpFetch()
    : (createNodeHttpFetch as typeof fetch)()
  globalThis.fetch = fetchImpl
  console.log("[SERVER] globalThis.fetch replaced with streaming node:http fetch")

  const {
    createCoreRoutesRequestHandler,
    createReverseProxyManager,
    createReverseProxyRequestHandler,
    createSocketIOManager,
    DEFAULT_ALLOWED_UPSTREAM_HOSTS,
    applyMcpLifecycleFromConfig,
  } = coreRoutesModule as typeof coreRoutesModule & {
    applyMcpLifecycleFromConfig?: (
      manager: unknown,
      getUserConfig: () => Promise<import("@smm/core/types").UserConfig>,
      logger?: CoreRoutesLogger,
    ) => Promise<void>
  }

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

  // The ohos Electron main process hosts the same /api/chat
  // endpoint as the cli (Bun). The chat pipeline (doChat + agent
  // tools) lives in `@smm/core-routes`; this module wires the
  // runtime-specific bits:
  //   - `createAIProvider` — uses the OHOS userConfig's AI provider
  //   - `getUserConfig` — reads from the same `smm.json` that the
  //      renderer writes through `POST /api/writeFile`, so the AI
  //      Assistant uses the same provider configuration the user
  //      selected in Settings.
  const userDataDir =
    typeof hello.userDataDir === "string"
      ? (hello.userDataDir as string)
      : os.homedir()
  const smmConfigPath = path.join(userDataDir, "smm.json")
  const ohosAppDataDir =
    typeof hello.appDataDir === "string" ? hello.appDataDir : ""

  // Shared `getUserConfig` reader — used by both the chat pipeline
  // and the MCP server. Reads the same `smm.json` the renderer
  // writes through `POST /api/writeFile`.
  const ohosGetUserConfig = async () => {
    try {
      const content = await fs.readFile(smmConfigPath, "utf-8")
      const raw = JSON.parse(content) as Record<string, unknown>
      // `migrateAIConfig` is bundled inside `core-routes.js`.
      // Call it via the loaded module to avoid a direct
      // dependency on `@smm/core/configMigration` (which is not
      // available when OHOS builds with `--external ./core-routes.js`).
      const coreRoutesModule = loadCoreRoutes() as Record<string, unknown>
      const migrate = coreRoutesModule.migrateAIConfig as
        | ((raw_: Record<string, unknown>) => boolean)
        | undefined
      if (migrate) migrate(raw)
      return raw as import("@smm/core/types").UserConfig
    } catch {
      // File doesn't exist or is malformed — return empty config.
      return { folders: [] } as unknown as import("@smm/core/types").UserConfig
    }
  }

  const chatConfig = {
    appDataDir: ohosAppDataDir,
    logger: createCoreRoutesLogger(),
    createAIProvider: (userConfig: Record<string, unknown>) => {
      const providerName = userConfig.selectedAIProvider as string | undefined
      const providers = userConfig.aiProviders as
        | Array<{ name: string; baseURL?: string; apiKey?: string; model?: string }>
        | undefined

      if (!providerName) {
        throw new Error("No AI provider selected")
      }

      const providerConfig = providers?.find((p) => p.name === providerName)
      if (!providerConfig) {
        throw new Error(`AI provider "${providerName}" not found in configured providers`)
      }
      if (!providerConfig.baseURL) {
        throw new Error(`baseURL is required for provider "${providerName}"`)
      }
      if (!providerConfig.apiKey) {
        throw new Error(`apiKey is required for provider "${providerName}"`)
      }
      if (!providerConfig.model) {
        throw new Error(`model is required for provider "${providerName}"`)
      }

      // `createOpenAICompatible` is re-exported from `@smm/core-routes`
      // (which bundles `@ai-sdk/openai-compatible`). The OHOS main
      // process loads core-routes via `loadCoreRoutes()`; the loaded
      // module is a CJS `exports` object that also includes the new
      // inline exports from `index.ts`.
      const coreRoutesModule = loadCoreRoutes() as Record<string, unknown>
      const createOpenAICompatible = coreRoutesModule.createOpenAICompatible as
        | ((opts: { name: string; baseURL: string; apiKey: string }) => unknown)
        | undefined

      if (!createOpenAICompatible) {
        throw new Error(
          "createOpenAICompatible not available in core-routes bundle. Rebuild core-routes.",
        )
      }

      const provider = createOpenAICompatible({
        name: providerName,
        baseURL: providerConfig.baseURL,
        apiKey: providerConfig.apiKey,
      })

      return {
        provider,
        model: providerConfig.model,
      }
    },
    getUserConfig: ohosGetUserConfig,
    acknowledge: async (message: unknown, timeoutMs?: number) => {
      if (!socketManager) {
        return undefined
      }
      return socketManager.acknowledge(message as never, timeoutMs)
    },
  }

  const ohosMcpManager = createOhosMcpLifecycleManager({
    mainOrigin: MAIN_HTTP_ORIGIN,
    onStop: resetMcpHandler,
  })

  const ohosActivatePersistedFileAccess = activateOhosPersistedFileAccess

  const coreRoutesHandler = createCoreRoutesRequestHandler(
    {
      allowlist,
      logger: createCoreRoutesLogger(),
      hello,
      appDataDir: typeof hello.appDataDir === "string" ? hello.appDataDir : undefined,
      broadcast: (message) => socketManager?.broadcast(message),
      fetchImpl: nodeHttpFetch,
      chat: chatConfig,
      mcp: { manager: ohosMcpManager },
      activatePersistedFileAccess: ohosActivatePersistedFileAccess,
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

    if (url.startsWith("/mcp/") || url === "/mcp") {
      // MCP uses Web Standards `Request` / `Response`. Convert the
      // `node:http` request, dispatch through the shared handler,
      // and write the result back. The handler is async; fire and
      // forget — it writes to `res` itself and resolves the
      // response on its own.
      void       handleMcpRequest(req, res, {
        appDataDir: ohosAppDataDir,
        getUserConfig: ohosGetUserConfig,
        getSocketManager: () => socketManager,
        logger: createCoreRoutesLogger(),
        activatePersistedFileAccess: ohosActivatePersistedFileAccess,
      })
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

    if (applyMcpLifecycleFromConfig) {
      void applyMcpLifecycleFromConfig(
        ohosMcpManager,
        ohosGetUserConfig,
        createCoreRoutesLogger(),
      ).catch((err) => {
        console.error("[main] Failed to apply MCP config on startup:", err)
      })
    } else {
      console.warn(
        "[main] applyMcpLifecycleFromConfig not in core-routes bundle; rebuild with pnpm --filter @smm/core-routes build:ohos",
      )
    }
  })
}
