import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@core': resolve(__dirname, '../../packages/core'),
      '@smm/core': resolve(__dirname, '../../packages/core/types.ts'),
      '@smm/test': resolve(__dirname, '../../packages/test/src/index.ts'),
    },
  },
})
