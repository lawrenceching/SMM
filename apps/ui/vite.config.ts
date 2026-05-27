import path from "path"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  envDir: path.resolve(__dirname, "../.."),
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
      "@smm/tvdb4": path.resolve(__dirname, "../../packages/tvdb4/src/index.ts")
    },
  },
})
