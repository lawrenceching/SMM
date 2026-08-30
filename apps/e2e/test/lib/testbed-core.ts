/**
 * Host-filesystem testbed setup/cleanup for Web UI e2e (wdio) host fallback.
 *
 * Resolves data dirs via `GET /api/hello` (`@smm/test` hello).
 * CLI e2e must not import this path for hello — see `apps/e2e/cli/base.ts`,
 * which injects `smm hello -f json` via {@link HelloPathsResolver}.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import type { UserConfig } from '@smm/core/types'
import {
    hello as helloHttp,
    removeTestMediaTmpDir as removeTestMediaTmpDirV1,
    resetUserConfig as resetUserConfigV1,
} from '@smm/test'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env.local'), override: true })

export type UserConfigUpdater = (
    userConfig: UserConfig,
) => UserConfig | void | Promise<UserConfig | void>

export type ResetUserConfigOption = boolean | UserConfigUpdater

export type HelloPaths = {
    userDataDir: string
    appDataDir: string
}

/** Optional override; default uses `GET /api/hello`. CLI supplies `smm hello`. */
export type HelloPathsResolver = () => Promise<HelloPaths>

export interface TestBedCoreCleanupOptions {
    /** When set, used instead of `GET /api/hello` (CLI e2e). */
    resolveHelloPaths?: HelloPathsResolver
    removeMetadataDir?: boolean
    removePlansDir?: boolean
    removeMediaFolders?: boolean
    resetUserConfig?: ResetUserConfigOption
}

export interface TestBedCoreSetupOptions extends TestBedCoreCleanupOptions {
    resetUserConfig: ResetUserConfigOption
}

async function defaultHelloPaths(): Promise<HelloPaths> {
    const data = await helloHttp()
    return { userDataDir: data.userDataDir, appDataDir: data.appDataDir }
}

function helloPathsOf(options?: { resolveHelloPaths?: HelloPathsResolver }): HelloPathsResolver {
    return options?.resolveHelloPaths ?? defaultHelloPaths
}

async function getUserConfigPath(resolveHelloPaths: HelloPathsResolver): Promise<string> {
    const { userDataDir } = await resolveHelloPaths()
    return path.join(userDataDir, 'smm.json')
}

async function removeMetadataDir(resolveHelloPaths: HelloPathsResolver): Promise<string | null> {
    const { appDataDir } = await resolveHelloPaths()
    const metadataDir = path.join(appDataDir, 'metadata')
    if (!fs.existsSync(metadataDir)) {
        return null
    }
    fs.rmSync(metadataDir, { recursive: true, force: true })
    console.log(`Removed metadata directory: ${metadataDir}`)
    return metadataDir
}

async function removePlansDir(resolveHelloPaths: HelloPathsResolver): Promise<string | null> {
    const { appDataDir } = await resolveHelloPaths()
    const plansDir = path.join(appDataDir, 'plans')
    if (!fs.existsSync(plansDir)) {
        return null
    }
    fs.rmSync(plansDir, { recursive: true, force: true })
    console.log(`Removed plans directory: ${plansDir}`)
    return plansDir
}

export async function updateUserConfig(
    updateFn: UserConfigUpdater,
    options?: { resolveHelloPaths?: HelloPathsResolver },
): Promise<void> {
    const resolveHelloPaths = helloPathsOf(options)
    const userConfigPath = await getUserConfigPath(resolveHelloPaths)
    if (!fs.existsSync(userConfigPath)) {
        throw new Error(`updateUserConfig: user config not found at ${userConfigPath}`)
    }

    const raw = fs.readFileSync(userConfigPath, 'utf-8')
    const current = JSON.parse(raw) as UserConfig
    const next = await Promise.resolve(updateFn(current))
    const toWrite = next ?? current

    fs.writeFileSync(userConfigPath, JSON.stringify(toWrite, null, 2), 'utf-8')
    console.log(`Updated user config at: ${userConfigPath}`)
}

export async function applyResetUserConfig(
    option: ResetUserConfigOption,
    options?: { resolveHelloPaths?: HelloPathsResolver },
): Promise<void> {
    if (option === false) {
        return
    }

    const resolveHelloPaths = helloPathsOf(options)
    const userConfigPath = await getUserConfigPath(resolveHelloPaths)

    if (option === true) {
        await resetUserConfigV1(userConfigPath)
        return
    }

    await resetUserConfigV1(userConfigPath)
    await updateUserConfig(async (userConfig) => {
        const updated = await Promise.resolve(option(userConfig))
        return updated ?? userConfig
    }, options)
}

/**
 * Tear down test artifacts on the host filesystem.
 */
export async function cleanupCore(options?: TestBedCoreCleanupOptions): Promise<void> {
    const {
        resolveHelloPaths,
        removeMetadataDir: isToRemoveMetadataDir = true,
        removePlansDir: isToRemovePlansDir = true,
        removeMediaFolders: isToRemoveMediaFolders = true,
        resetUserConfig: needToResetUserConfig = false,
    } = options ?? {}

    const resolve = helloPathsOf({ resolveHelloPaths })

    if (isToRemoveMediaFolders) {
        await removeTestMediaTmpDirV1({ waitForUnlockMs: 30_000 })
    }
    if (isToRemovePlansDir) {
        await removePlansDir(resolve)
    }
    if (isToRemoveMetadataDir) {
        await removeMetadataDir(resolve)
    }
    await applyResetUserConfig(needToResetUserConfig, { resolveHelloPaths: resolve })
}

/**
 * Prepare a clean host test environment (cleanup, then apply user config).
 */
export async function setupCore(options: TestBedCoreSetupOptions): Promise<void> {
    await cleanupCore(options)
    await applyResetUserConfig(options.resetUserConfig, {
        resolveHelloPaths: helloPathsOf(options),
    })
}
