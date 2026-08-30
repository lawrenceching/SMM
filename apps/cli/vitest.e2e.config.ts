import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

const typesRoot = resolve(__dirname, '../../packages/types')
const utilsSrc = resolve(__dirname, '../../packages/utils/src')

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
      {
        find: /^@smm\/types\/(.+)$/,
        replacement: `${typesRoot}/$1`,
      },
      {
        find: '@smm/types',
        replacement: resolve(typesRoot, 'types.ts'),
      },
      {
        find: /^@smm\/utils\/(.+)$/,
        replacement: `${utilsSrc}/$1`,
      },
      {
        find: '@smm/utils',
        replacement: resolve(utilsSrc, 'index.ts'),
      },
      {
        find: '@smm/test',
        replacement: resolve(__dirname, '../../packages/test/src/index.ts'),
      },
    ],
  },
})
