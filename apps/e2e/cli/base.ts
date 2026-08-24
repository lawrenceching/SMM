/**
 * Testbed setup/cleanup for CLI e2e tests (`bun test` under `apps/e2e/cli`).
 *
 * Pass `binary` (path to `smm` executable). Data dirs are resolved via `smm hello -f json`,
 * not `GET /api/hello`. Browser-only wdio options are omitted.
 */
export {
    cleanupCore as cleanup,
    setupCore as setup,
    updateUserConfig,
    type ResetUserConfigOption,
    type TestBedCoreCleanupOptions as CliTestBedCleanupOptions,
    type TestBedCoreSetupOptions as CliTestBedSetupOptions,
    type UserConfigUpdater,
} from '../test/lib/testbed-core'

export { runCliHello } from '../test/lib/cli-hello'

const isWindows = process.platform === 'win32'

/** Path to the compiled `smm` CLI executable (relative to `apps/e2e/cli`). */
export const bin = `../../cli/dist/cli${isWindows ? '.exe' : ''}`
