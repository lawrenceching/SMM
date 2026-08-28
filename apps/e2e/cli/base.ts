/**
 * Testbed setup/cleanup for CLI e2e tests (`bun test` under `apps/e2e/cli`).
 *
 * Pass `binary` (path to `smm` executable). Data dirs are resolved via `smm hello -f json`,
 * not `GET /api/hello`. Browser-only wdio options are omitted.
 */
import {
    cleanupCore,
    setupCore,
    updateUserConfig as updateUserConfigCore,
    type HelloPathsResolver,
    type ResetUserConfigOption,
    type TestBedCoreCleanupOptions,
    type TestBedCoreSetupOptions,
    type UserConfigUpdater,
} from '../test/lib/testbed-core'
import { runCliHello } from '../test/lib/cli-hello'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export type { ResetUserConfigOption, UserConfigUpdater }

export type CliTestBedCleanupOptions = Omit<TestBedCoreCleanupOptions, 'resolveHelloPaths'> & {
    /** Path to the `smm` CLI executable. */
    binary: string
}

export type CliTestBedSetupOptions = Omit<TestBedCoreSetupOptions, 'resolveHelloPaths'> & {
    binary: string
}

function cliHelloResolver(binary: string): HelloPathsResolver {
    return async () => {
        const body = await runCliHello(binary)
        // CLI Core stores config, metadata, and plans under userDataDir (see getCore.ts).
        // hello.appDataDir is the reported XDG data dir and may differ on Linux.
        return { userDataDir: body.userDataDir, appDataDir: body.userDataDir }
    }
}

export async function cleanup(options: CliTestBedCleanupOptions): Promise<void> {
    const { binary, ...rest } = options
    await cleanupCore({
        ...rest,
        resolveHelloPaths: cliHelloResolver(binary),
    })
}

export async function setup(options: CliTestBedSetupOptions): Promise<void> {
    const { binary, ...rest } = options
    await setupCore({
        ...rest,
        resolveHelloPaths: cliHelloResolver(binary),
    })
}

export async function updateUserConfig(
    updateFn: UserConfigUpdater,
    options: { binary: string },
): Promise<void> {
    await updateUserConfigCore(updateFn, {
        resolveHelloPaths: cliHelloResolver(options.binary),
    })
}

export { runCliHello }

const isWindows = process.platform === 'win32'

/** Absolute path to the compiled `smm` CLI executable. */
export const bin = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'cli',
    'dist',
    `cli${isWindows ? '.exe' : ''}`,
)
