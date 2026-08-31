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
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
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
    alias: [
      {
        find: /^@smm\/types\/(.+)$/,
        replacement: `${path.resolve(__dirname, '../../packages/types')}/$1`,
      },
      {
        find: '@smm/types',
        replacement: path.resolve(__dirname, '../../packages/types/types.ts'),
      },
      {
        find: /^@smm\/utils\/(.+)$/,
        replacement: `${path.resolve(__dirname, '../../packages/utils/src')}/$1`,
      },
      {
        find: '@smm/utils',
        replacement: path.resolve(__dirname, '../../packages/utils/src/index.ts'),
      },
      {
        find: /^@smm\/core\/(.+)$/,
        replacement: `${path.resolve(__dirname, '../core/src')}/$1`,
      },
      {
        find: '@smm/core',
        replacement: path.resolve(__dirname, '../core/src/index.ts'),
      },
      {
        find: '@smm/tvdb4/',
        replacement: `${path.resolve(__dirname, '../../packages/tvdb4/src')}/`,
      },
      {
        find: '@smm/tvdb4',
        replacement: path.resolve(__dirname, '../../packages/tvdb4/src/index.ts'),
      },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
})
