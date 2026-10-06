import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

const typesRoot = resolve(__dirname, '../../packages/types')
const utilsSrc = resolve(__dirname, '../../packages/utils/src')

export default defineConfig({
  test: {
    environment: 'node',
    // Unit tests only. E2E lives in dedicated suites — run via dedicated scripts.
    include: ['src/**/*.test.ts', 'test/helpers/**/*.test.ts'],
    passWithNoTests: true,
  },
  resolve: {
    alias: [
      { find: '@server', replacement: resolve(__dirname, './src') },
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
