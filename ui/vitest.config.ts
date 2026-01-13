import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8', // Fast, accurate, and recommended for modern projects
      reporter: ['text', 'json', 'html', 'lcov'], // lcov format for VSCode Coverage Gutters extension
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.{ts,tsx}',
        '**/*.config.{ts,js}',
        '**/test/**',
        '**/coverage/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@core': path.resolve(__dirname, '../core'),
    },
  },
})
