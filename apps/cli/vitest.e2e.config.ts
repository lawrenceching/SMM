import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

const coreRoot = resolve(__dirname, '../../packages/core')

/** Network/integration CLI tests — not part of default `pnpm test`. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.e2e.ts'],
    exclude: ['test/test-mcp.e2e.ts'],
    testTimeout: 10 * 60 * 1000,
  },
  resolve: {
    alias: [
      { find: '@', replacement: resolve(__dirname, './src') },
      { find: '@core', replacement: coreRoot },
      {
        find: /^@smm\/core\/(.+)$/,
        replacement: `${coreRoot}/$1`,
      },
      {
        find: '@smm/core',
        replacement: resolve(coreRoot, 'types.ts'),
      },
      {
        find: '@smm/test',
        replacement: resolve(__dirname, '../../packages/test/src/index.ts'),
      },
      {
        find: 'core-app',
        replacement: resolve(__dirname, '../core/src/index.ts'),
      },
    ],
  },
})
