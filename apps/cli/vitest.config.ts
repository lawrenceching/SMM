import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts', 'test/**/*.e2e.ts'],
    exclude: ['test/test-mcp.e2e.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@core': resolve(__dirname, '../../packages/core'),
      '@smm/core': resolve(__dirname, '../../packages/core/types.ts'),
      '@smm/test': resolve(__dirname, '../../packages/test/src/index.ts'),
      'core-app': resolve(__dirname, '../core/src/index.ts'),
    },
  },
})
