/**
 * Host-filesystem testbed setup/cleanup shared by wdio and CLI e2e tests.
 *
 * CLI e2e: pass `binary` and paths are resolved via `smm hello -f json` (no HTTP server).
 * Wdio host fallback: omit `binary` and paths come from `GET /api/hello` via `@smm/test`.
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
import { runCliHello } from './cli-hello'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env.local'), override: true })

export type UserConfigUpdater = (
    userConfig: UserConfig,
) => UserConfig | void | Promise<UserConfig | void>

export type ResetUserConfigOption = boolean | UserConfigUpdater

export interface TestBedCoreCleanupOptions {
    /** Path to the `smm` CLI executable. When set, `smm hello -f json` resolves data dirs. */
    binary?: string
    removeMetadataDir?: boolean
    removePlansDir?: boolean
    removeMediaFolders?: boolean
    resetUserConfig?: ResetUserConfigOption
}

export interface TestBedCoreSetupOptions extends TestBedCoreCleanupOptions {
    resetUserConfig: ResetUserConfigOption
}

async function resolveHelloPaths(binary?: string): Promise<{
    userDataDir: string
    appDataDir: string
}> {
    if (binary) {
        const body = await runCliHello(binary)
        return { userDataDir: body.userDataDir, appDataDir: body.appDataDir }
    }

    const data = await helloHttp()
    return { userDataDir: data.userDataDir, appDataDir: data.appDataDir }
}

async function getUserConfigPath(binary?: string): Promise<string> {
    const { userDataDir } = await resolveHelloPaths(binary)
    return path.join(userDataDir, 'smm.json')
}

async function removeMetadataDir(binary?: string): Promise<string | null> {
    const { appDataDir } = await resolveHelloPaths(binary)
    const metadataDir = path.join(appDataDir, 'metadata')
    if (!fs.existsSync(metadataDir)) {
        return null
    }
    fs.rmSync(metadataDir, { recursive: true, force: true })
    console.log(`Removed metadata directory: ${metadataDir}`)
    return metadataDir
}

async function removePlansDir(binary?: string): Promise<string | null> {
    const { appDataDir } = await resolveHelloPaths(binary)
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
    options?: { binary?: string },
): Promise<void> {
    const userConfigPath = await getUserConfigPath(options?.binary)
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
    options?: { binary?: string },
): Promise<void> {
    if (option === false) {
        return
    }

    const userConfigPath = await getUserConfigPath(options?.binary)

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
        binary,
        removeMetadataDir: isToRemoveMetadataDir = true,
        removePlansDir: isToRemovePlansDir = true,
        removeMediaFolders: isToRemoveMediaFolders = true,
        resetUserConfig: needToResetUserConfig = false,
    } = options ?? {}

    if (isToRemoveMediaFolders) {
        await removeTestMediaTmpDirV1({ waitForUnlockMs: 30_000 })
    }
    if (isToRemovePlansDir) {
        await removePlansDir(binary)
    }
    if (isToRemoveMetadataDir) {
        await removeMetadataDir(binary)
    }
    await applyResetUserConfig(needToResetUserConfig, { binary })
}

/**
 * Prepare a clean host test environment (cleanup, then apply user config).
 */
export async function setupCore(options: TestBedCoreSetupOptions): Promise<void> {
    await cleanupCore(options)
    await applyResetUserConfig(options.resetUserConfig, { binary: options.binary })
}
