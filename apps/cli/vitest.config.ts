import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

const coreRoot = resolve(__dirname, '../../packages/core')

export default defineConfig({
  test: {
    environment: 'node',
    // Unit tests only. E2E lives in test/*.e2e.ts — run via `pnpm run test:e2e`.
    include: ['src/**/*.test.ts', 'test/helpers/**/*.test.ts'],
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
      // core-app subpaths must win over the bare `core-app` → index alias
      // (otherwise vitest cannot resolve package.json exports for nested deps).
      {
        find: 'core-app/createRenameEpisodePlan',
        replacement: resolve(
          __dirname,
          '../core/src/pipeline/createRenameEpisodePlan.ts',
        ),
      },
      {
        find: 'core-app/FsPort',
        replacement: resolve(__dirname, '../core/src/ports/FsPort.ts'),
      },
      {
        find: 'core-app',
        replacement: resolve(__dirname, '../core/src/index.ts'),
      },
    ],
  },
})
