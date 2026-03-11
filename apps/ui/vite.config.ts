import path from "path"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
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
        // Screenshot API can take long (ffmpeg); avoid proxy closing the connection (node-http-proxy default can be ~2min)
        // proxyTimeout: 300_000, // 5 minutes
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
      "@": path.resolve(__dirname, "./src"),
      "@core": path.resolve(__dirname, "../../packages/core")
    },
  },
})
