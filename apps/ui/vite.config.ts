import path from "path"
import { readFileSync } from "fs"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Read version from package.json at config-evaluation time so Vite's
// `define` can inject it into the build (replaces the previous runtime
// `import.meta.env.VITE_APP_VERSION ?? "unknown"` fallback that always
// resolved to "unknown" in production).
const pkg = JSON.parse(
  readFileSync(path.resolve(__dirname, "package.json"), "utf8"),
) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  envDir: path.resolve(__dirname, "../.."),
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
    proxy: {
      '/api': {
        target: 'http://localhost:30000',
        changeOrigin: true,
        // Long-running streams (yt-dlp download, ffmpeg); default proxy idle timeout can drop ~30s connections.
        proxyTimeout: 0,
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
    alias: {
      "@/": `${path.resolve(__dirname, "./src")}/`,
      "@core": path.resolve(__dirname, "../../packages/core"),
      "@smm/tvdb4": path.resolve(__dirname, "../../packages/tvdb4/src/index.ts"),
      // Force a single React instance for app code and @base-ui/react (avoids invalid hook call).
      react: path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
    },
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "@base-ui/react"],
  },
})
