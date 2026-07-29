import type { TestbedOs } from './ui-page-url'

/** HarmonyOS e2e runs against a device; host-side FS / MCP clients cannot reach it. */
export const isOhosE2e = process.env.E2E_PLATFORM === 'ohos'

/** Docker e2e: browser and MCP test client run on the host; CLI runs in a container. */
export const isDockerE2e = process.env.E2E_PLATFORM === 'docker'

const DEFAULT_MCP_PORT = 30001

/**
 * MCP URL for `test/mcp-test-client` on the test runner (host).
 * Docker publishes container :30001 to host localhost; local/Electron share loopback with CLI.
 */
export function resolveMcpAddressForE2eRunner(port: number = DEFAULT_MCP_PORT): string {
  const host = isDockerE2e ? 'localhost' : '127.0.0.1'
  return `http://${host}:${port}/mcp`
}

/**
 * Pass to `setup` / `cleanup` as `os` in common specs so `--platform ohos`
 * uses device-local UI origin (`http://127.0.0.1:18081`) instead of Vite.
 * `undefined` keeps desktop/Electron defaults (`general`).
 */
export const testbedOs: TestbedOs | undefined = isOhosE2e ? 'HarmonyOS' : undefined

/**
 * Call from a Mocha `before` / `it` with `function ()` (not arrow) so `this.skip()` works.
 * Skips the whole suite when invoked from `before`.
 */
export function skipIfOhos(testContext: { skip: () => void }): void {
  if (isOhosE2e) {
    testContext.skip()
  }
}
