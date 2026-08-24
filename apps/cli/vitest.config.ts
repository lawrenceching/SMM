import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

const coreRoot = resolve(__dirname, '../../packages/core')

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts', 'test/**/*.e2e.ts'],
    exclude: ['test/test-mcp.e2e.ts'],
  },
  resolve: {
    alias: [
      { find: '@', replacement: resolve(__dirname, './src') },
      { find: '@core', replacement: coreRoot },
      // Subpaths (`@smm/core/path`, …) must win over bare `@smm/core` → types.ts.
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
