import { defineConfig } from 'vitest/config'

/** MCP binary e2e tests under `mcp/` — run via `ci/run-mcp-e2e-test.ts`. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['mcp/**/*.test.ts'],
    testTimeout: 10 * 60 * 1000,
    passWithNoTests: true,
  },
})
