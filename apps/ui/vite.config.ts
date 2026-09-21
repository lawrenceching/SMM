import path from "path"
import { readFileSync } from "fs"
import type { ClientRequest, IncomingMessage } from "node:http"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'

// Read version from package.json at config-evaluation time so Vite's
// `define` can inject it into the build (replaces the previous runtime
// `import.meta.env.VITE_APP_VERSION ?? "unknown"` fallback that always
// resolved to "unknown" in production).
const pkg = JSON.parse(
  readFileSync(path.resolve(__dirname, "package.json"), "utf8"),
) as { version: string }

const DEFAULT_UI_DEV_PORT = 8000

type DiagIncomingMessage = IncomingMessage & { diagStartMs?: number }

/** E2E-only. Times Vite's /api proxy separately from the CLI so a stall can be placed on one side. */
function apiProxyTiming(): Pick<ProxyOptions, "configure"> {
  if (process.env.E2E_PLATFORM !== "desktop" && process.env.DIAG_HTTP_TIMING !== "1") {
    return {}
  }

  let inflight = 0
  const pathOf = (url: string | undefined) => (url ?? "").split("?")[0] ?? ""
  const tracked = (url: string | undefined) => {
    const pathname = pathOf(url)
    return pathname.startsWith("/api/") && pathname !== "/api/log"
  }
  const finish = (req: DiagIncomingMessage, detail: string) => {
    if (req.diagStartMs === undefined) return
    const durMs = Date.now() - req.diagStartMs
    req.diagStartMs = undefined
    inflight = Math.max(0, inflight - 1)
    console.log(`[proxy-timing] ${detail} dur=${durMs}ms inflight=${inflight}`)
  }

  return {
    configure(proxy) {
      console.log("[proxy-timing] enabled for /api (except /api/log)")
      proxy.on("proxyReq", (proxyReq: ClientRequest, req: IncomingMessage) => {
        const diagReq = req as DiagIncomingMessage
        if (!tracked(diagReq.url)) return
        inflight += 1
        diagReq.diagStartMs = Date.now()
        const pathname = pathOf(diagReq.url)
        console.log(`[proxy-timing] -> ${diagReq.method} ${pathname} inflight=${inflight}`)
        proxyReq.on("socket", (socket) => {
          const local = socket.localPort || 0
          const remote = socket.remotePort || 0
          console.log(
            `[proxy-timing] socket ${diagReq.method} ${pathname} local=${local} remote=${remote}`,
          )
        })
      })
      proxy.on("proxyRes", (proxyRes: IncomingMessage, req: IncomingMessage) => {
        const diagReq = req as DiagIncomingMessage
        finish(
          diagReq,
          `<- ${proxyRes.statusCode} ${diagReq.method} ${pathOf(diagReq.url)}`,
        )
      })
      proxy.on("error", (err: Error, req: IncomingMessage) => {
        const diagReq = req as DiagIncomingMessage
        finish(
          diagReq,
          `error ${diagReq.method} ${pathOf(diagReq.url)} ${err.message}`,
        )
      })
    },
  }
}

function resolveUiDevPort(raw: string | undefined = process.env.UI_PORT): number {
  if (raw === undefined) {
    return DEFAULT_UI_DEV_PORT
  }
  const trimmed = raw.trim()
  if (trimmed === "") {
    return DEFAULT_UI_DEV_PORT
  }
  const port = Number.parseInt(trimmed, 10)
  if (!Number.isFinite(port) || port <= 0) {
    return DEFAULT_UI_DEV_PORT
  }
  return port
}

// https://vite.dev/config/
export default defineConfig({
  envDir: path.resolve(__dirname, "../.."),
  envPrefix: ["VITE_", "TEST_"],
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(pkg.version),
  },
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
    tailwindcss(),
  ],
  server: {
    port: resolveUiDevPort(),
    proxy: {
      '/api': {
        target: 'http://localhost:30000',
        changeOrigin: true,
        // Long-running streams (yt-dlp download, ffmpeg); default proxy idle timeout can drop ~30s connections.
        proxyTimeout: 0,
        ...apiProxyTiming(),
      },
      // CLI TMDB L7 reverse proxy (see apps/cli/src/route/TmdbProxy.ts)
      '/tmdb': {
        target: 'http://localhost:30000',
        changeOrigin: true,
      },
      '/tvdb': {
        target: 'http://localhost:30000',
        changeOrigin: true,
      },
      // Socket.IO endpoint (HTTP long-polling and WebSocket upgrade)
      '/socket.io': {
        target: 'http://localhost:30000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: [
      {
        find: /^@smm\/core\/(.+)$/,
        replacement: `${path.resolve(__dirname, "../core/src")}/$1`,
      },
      {
        find: "@smm/core",
        replacement: path.resolve(__dirname, "../core/src/index.ts"),
      },
      { find: "@/", replacement: `${path.resolve(__dirname, "./src")}/` },
      {
        find: "@smm/tvdb4",
        replacement: path.resolve(__dirname, "../../packages/tvdb4/src/index.ts"),
      },
      // Force a single React instance for app code and @base-ui/react (avoids invalid hook call).
      { find: "react", replacement: path.resolve(__dirname, "node_modules/react") },
      { find: "react-dom", replacement: path.resolve(__dirname, "node_modules/react-dom") },
    ],
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "@base-ui/react"],
  },
})
