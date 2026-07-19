/** HarmonyOS e2e runs against a device; host-side FS / MCP clients cannot reach it. */
export const isOhosE2e = process.env.E2E_PLATFORM === 'ohos'

/**
 * Call from a Mocha `before` / `it` with `function ()` (not arrow) so `this.skip()` works.
 * Skips the whole suite when invoked from `before`.
 */
export function skipIfOhos(testContext: { skip: () => void }): void {
  if (isOhosE2e) {
    testContext.skip()
  }
}
