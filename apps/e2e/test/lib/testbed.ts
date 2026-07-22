/**
 * Test Bed - Common E2E Test Setup Utilities
 *
 * This module provides shared setup functions and helpers for E2E tests.
 * Import these functions in your test files to avoid code duplication.
 */
import * as path from 'node:path'
import * as fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { setupTestMediaFolders, resetUserConfig as resetUserConfigV1, getUserConfigPath as getUserConfigPathV1, getMetadataDir, removeMetadataDir as removeMetadataDirV1, removeTestMediaTmpDir as removeTestMediaTmpDirV1, removePlansDir as removePlansDirV1, prepareMediaMetadata, removePlanFolder, hello } from '@smm/test'
import { Path } from '@smm/core'
import { createMediaMetadata as coreCreateMediaMetadata } from '@smm/core/mediaMetadata'
import type { MediaFileMetadata, MediaMetadata, UserConfig } from '@smm/core/types'
import type { TestFolder } from 'test/actions/import-folders'
import Sidebar from '../componentobjects/Sidebar'
import StatusBar from '../componentobjects/StatusBar'
import {
    deleteAppDataSubdirViaBrowser,
    ensureBrowserOnUiPage,
    fetchHelloPathsViaBrowser,
    joinPlatformPath,
    readFileViaBrowser,
    resetUserConfigViaBrowser,
    setActiveTestbedOs,
    updateUserConfigViaBrowser,
    writeFileViaBrowser,
} from './browser-fs'
import type { TestbedOs } from './ui-page-url'
import { testbedOs as defaultTestbedOs } from './e2e-platform'

export type { TestbedOs } from './ui-page-url'
// Re-export for convenience (switched wrappers are `export async function` below)
export { setupTestMediaFolders, getMetadataDir }

export {
    useEmbeddedHttpProxy,
    getCurrentProxyAddress,
    startEmbeddedHttpProxy,
    stopEmbeddedHttpProxy,
    DEFAULT_EMBEDDED_PROXY_ADDRESS,
} from './httpProxyServer'

export { startConfigServer, stopConfigServer } from './configServer'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env.local from e2e folder. Use `override: true` so the e2e-specific
// values win over the root .env.local (which may set the same keys to empty
// values). Without override, dotenv's default behavior leaves any
// already-set env var untouched, so an empty value from the root file would
// block the e2e value.
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env.local'), override: true })

/**
 * Options for the before hook
 */
export interface TestBedBeforeOptions {
    /** Whether to set up test media folders before the test */
    setupMediaFolders?: boolean
    setupMediaMetadata?: boolean
    /** Custom setup function to run after basic setup */
    customSetup?: () => Promise<void>
    userConfig?: Partial<UserConfig>
}

export type UserConfigUpdater = (
    userConfig: UserConfig
) => UserConfig | void | Promise<UserConfig | void>

export type ResetUserConfigOption = boolean | UserConfigUpdater

/**
 * Flip to `false` to roll back all browser-protocol setup/cleanup paths to host Node fs.
 */
const TESTBED_V2: boolean = true

async function applyResetUserConfig(option: ResetUserConfigOption): Promise<void> {
    if (option === false) {
        return
    }

    if (option === true) {
        await resetUserConfig()
        return
    }

    await resetUserConfig()
    await updateUserConfig(async (userConfig) => {
        const updated = await Promise.resolve(option(userConfig))
        return updated ?? userConfig
    })
}

export async function setup(options: {
    removeMetadataDir: boolean,
    removePlansDir: boolean,
    removeMediaFolders: boolean,
    removeDirInSidebar: boolean,
    resetUserConfig: ResetUserConfigOption,
    openBrowserPage: boolean,
    /**
     * Clear `localStorage` during cleanup and again after opening the page.
     * Defaults to `true` so Ohos/Electron attach sessions do not leak debug
     * overrides (e.g. wronghost TMDB asset host) across specs.
     */
    clearLocalStorage?: boolean,
    /**
     * Target platform for Page.open / UI origin.
     * Default: `"HarmonyOS"` when `E2E_PLATFORM=ohos`, else `"general"`.
     */
    os?: TestbedOs,
}) {
    const os = options.os ?? defaultTestbedOs ?? 'general'
    const clearLocalStorage = options.clearLocalStorage !== false
    setActiveTestbedOs(os)

    // Browser-protocol cleanup (e.g. removeMetadataDir v2) needs a real app origin
    // so relative fetch('/api/...') can resolve. Open only when not already there.
    await ensureBrowserOnUiPage(os)

    await cleanup({
        removePlansDir: options.removePlansDir,
        removeMetadataDir: options.removeMetadataDir,
        removeMediaFolders: options.removeMediaFolders,
        removeDirInSidebar: options.removeDirInSidebar,
        resetUserConfig: options.resetUserConfig,
        clearLocalStorage,
        os,
    })


    await applyResetUserConfig(options.resetUserConfig)

    if(options.openBrowserPage) {
        const { default: Page } = await import('../pageobjects/page')
        // Electron: stay on the app window (embedded UI); refresh for a clean page.
        // Browser/ohos: navigate to the platform UI origin.
        if (process.env.E2E_PLATFORM === 'electron') {
            await Page.refresh()
        } else {
            await Page.open(undefined, os)
        }

        await browser.waitUntil(async () => {
            return await StatusBar.isDisplayed()
        }, {
            timeout: 10000,
            timeoutMsg: 'Status bar was not displayed after 10 seconds'
        })

        if (clearLocalStorage) {
            await clearBrowserLocalStorage()
        }
    }
    
}

/**
 * Create a before hook with common test setup
 * This hook:
 * 1. Optionally sets up test media folders
 * 2. Calls API to get user data directory
 * 3. Resets user config
 * 4. Opens the page
 * 5. Waits for StatusBar to be displayed
 * 6. Checks Sidebar is in initial state (no folders displayed)
 *
 * @deprecated 
 * @param options - Configuration options for the before hook
 * @returns A before hook function for Mocha describe blocks
 */
export function createBeforeHook(options: TestBedBeforeOptions = {}) {
    const { setupMediaFolders = false, setupMediaMetadata = true, customSetup, userConfig } = options

    return async function() {
        // Import browser dynamically inside the hook to ensure it's fully initialized
        const { browser } = await import('@wdio/globals')

        // Remove metadata directory if it exists. The metadata dir may contain files from previous tests.
        await removeMetadataDir();
        await removePlanFolder();
        

        // Set up test media folders if requested
        if (setupMediaFolders) {
            const { mediaDir, tmpDir } = setupTestMediaFolders()
            console.log(`setup media folder for testing: tmpDir=${tmpDir}, mediaDir=${mediaDir}`)
            const tvshowFolderPlatformPath = path.join(mediaDir, '古见同学有交流障碍症');
            const tvshowFolderPosixPath = Path.posix(tvshowFolderPlatformPath);

            if(setupMediaMetadata) {
                await prepareMediaMetadata(tvshowFolderPosixPath, '古见同学有交流障碍症.metadata.json')
            }
        }

        

        // Get user config path and reset user config
        const userConfigPath = await getUserConfigPath()
        await resetUserConfig(userConfigPath, userConfig)

        // Import Page dynamically to avoid circular dependencies
        const { default: Page } = await import('../pageobjects/page')
        const { default: StatusBar } = await import('../componentobjects/StatusBar')
        const { default: Sidebar } = await import('../componentobjects/Sidebar')

        await Page.open()

        // Wait for the page to be ready by checking StatusBar is displayed
        await browser.waitUntil(async () => {
            return await StatusBar.isDisplayed()
        }, {
            timeout: 10000,
            timeoutMsg: 'Status bar was not displayed after 10 seconds'
        })
        console.log('StatusBar is displayed, page is ready for testing')

        if((userConfig?.folders?.length ?? 0) === 0) {
            console.log('No folders configured, checking if Sidebar is in initial state (no folders displayed)')
            // Check Sidebar is in initial state (no folders displayed)
            await browser.waitUntil(async () => {
                return await Sidebar.isInInitialState()
            }, {
                timeout: 5000,
                timeoutMsg: 'Sidebar was not in initial state after 5 seconds'
            })
            console.log('Sidebar is in initial state (no folders displayed)')
        }
        

        // Run custom setup if provided
        if (customSetup) {
            await customSetup()
        }
    }
}

/**
 * Delete test media tmp dir, plans in user data dir, and metadata in app data dir.
 * Use in after/afterEach hooks to tear down test artifacts.
 * removeMetadataDir and removePlansDir require the app (hello API) to be running.
 */
export async function cleanup(options?: {
    removeMetadataDir: boolean,
    removePlansDir: boolean,
    removeMediaFolders: boolean,
    removeDirInSidebar: boolean,
    resetUserConfig: ResetUserConfigOption,
    /**
     * Clear `localStorage` (debug overrides, agreement flags, etc.).
     * Defaults to `true` so leftover keys do not pollute the next spec
     * when the session is reused (Ohos/Electron attach).
     */
    clearLocalStorage?: boolean,
    /**
     * Target platform for UI origin used by browser-protocol helpers.
     * Default: `"HarmonyOS"` when `E2E_PLATFORM=ohos`, else `"general"`.
     */
    os?: TestbedOs,
}): Promise<void> {
    const { removeMetadataDir: isToRemoveMetadataDir = true, removePlansDir: isToRemovePlansDir = true, removeMediaFolders: isToRemoveMediaFolders = true, removeDirInSidebar: isToRemoveDirInSidebar = true, resetUserConfig: needToResetUserConfig, clearLocalStorage = true, os = defaultTestbedOs ?? 'general' } = options ?? {
        removeMetadataDir: true,
    };
    setActiveTestbedOs(os)
    if (isToRemoveMediaFolders) {
        await removeTestMediaTmpDir({ waitForUnlockMs: 30_000 })
    }
    if (isToRemovePlansDir) {
        await removePlansDir()
    }
    if (isToRemoveMetadataDir) {
        await removeMetadataDir()
    }
    if (isToRemoveDirInSidebar) {
        await removeDirInSidebar()
    }
    await applyResetUserConfig(needToResetUserConfig ?? false)
    if (clearLocalStorage) {
        await clearBrowserLocalStorage()
    }
}

/**
 * Remove `{appDataDir}/metadata` for e2e cleanup.
 * `TESTBED_V2`: browser `deleteFolder`; else host Node fs via `@smm/test`.
 */
export async function removeMetadataDir(): Promise<string | null> {
    if (TESTBED_V2) {
        const pathRemoved = await deleteAppDataSubdirViaBrowser('metadata')
        console.log(`Removed metadata directory (v2): ${pathRemoved}`)
        return pathRemoved
    }
    return removeMetadataDirV1()
}

/**
 * Remove `{appDataDir}/plans` for e2e cleanup.
 * `TESTBED_V2`: browser `deleteFolder`; else host Node fs via `@smm/test`.
 */
export async function removePlansDir(): Promise<string | null> {
    if (TESTBED_V2) {
        const pathRemoved = await deleteAppDataSubdirViaBrowser('plans')
        console.log(`Removed plans directory (v2): ${pathRemoved}`)
        return pathRemoved
    }
    return removePlansDirV1()
}

/**
 * Remove host test media tmp dir (`os.tmpdir()/smm-test-media`).
 *
 * Stays on host Node fs even when `TESTBED_V2` is true: that path is often
 * outside the CLI allowlist (`getTmpDir()` is `.../Temp/smm`, not `os.tmpdir()`).
 * Ohos device-side fixture deletion is deferred (see ohos-test-infrastructure.md).
 */
export async function removeTestMediaTmpDir(
    options?: { waitForUnlockMs?: number },
): Promise<string | null> {
    return removeTestMediaTmpDirV1(options)
}

/**
 * Resolve `userDataDir/smm.json`. v2 uses browser hello; v1 uses host hello.
 */
export async function getUserConfigPath(): Promise<string> {
    if (TESTBED_V2) {
        const { joinPlatformPath, fetchHelloPathsViaBrowser } = await import('./browser-fs')
        const { userDataDir } = await fetchHelloPathsViaBrowser()
        return joinPlatformPath(userDataDir, 'smm.json')
    }
    return getUserConfigPathV1()
}

/**
 * Reset `smm.json` to defaults (optional partial override).
 * `TESTBED_V2`: browser `writeFile`; else host Node fs via `@smm/test`.
 */
export async function resetUserConfig(
    userConfigPath?: string,
    initConfig?: Partial<UserConfig>,
): Promise<void> {
    if (TESTBED_V2) {
        // Path arg ignored in v2 — always resolve via hello inside the browser.
        void userConfigPath
        await resetUserConfigViaBrowser(initConfig)
        return
    }
    await resetUserConfigV1(userConfigPath, initConfig)
}

export async function removeDirInSidebar(): Promise<void> {
    await Sidebar.deleteAllFolders()
}

async function clearBrowserLocalStorage(): Promise<void> {
    // In some cleanup paths browser context may not be ready.
    try {
        await browser.execute(() => {
            (globalThis as { localStorage?: { clear: () => void } }).localStorage?.clear()
        })
    } catch (error) {
        console.warn('Skip clearing localStorage because browser is not ready:', error)
    }
}

/**
 * Create an after hook that runs cleanup().
 * Use with Mocha after() or afterEach(), e.g. after(createAfterHook()).
 */
export function createAfterHook(): () => Promise<void> {
    return async function () {
        await cleanup()
    }
}

/**
 * Assert that media metadata JSON for a given media folder path satisfies the provided predicate.
 * 
 * @param mediaFolderPathInPlatformFormat Absolute media folder path in platform-specific format.
 *                                        It will be converted to POSIX and then to metadata cache file name.
 * @param predicate A function that receives the parsed JSON object and should return true when expectations are met.
 */
export async function expectMediaMetadataToBe(
    mediaFolderPathInPlatformFormat: string,
    predicate: (json: any) => boolean
): Promise<void> {
    const metadataDir = await getMetadataDir()

    // Convert media folder path to POSIX format for metadata file naming
    const mediaFolderPosix = Path.posix(mediaFolderPathInPlatformFormat)
    const safeFileName = mediaFolderPosix.replace(/[\/\\:?*|<>"]/g, '_')
    const metadataFilePath = path.join(metadataDir, `${safeFileName}.json`)

    // Wait a bit for metadata write to complete
    const { setTimeout } = await import('node:timers/promises')
    await setTimeout(2000)

    if (!fs.existsSync(metadataFilePath)) {
        throw new Error(`Expect file "${metadataFilePath}" to exist but it didn't`)
    }

    const metadataRaw = fs.readFileSync(metadataFilePath, 'utf-8')
    const metadataJson = JSON.parse(metadataRaw)

    const ok = predicate(metadataJson)
    if (!ok) {
        const m: MediaMetadata = metadataJson as MediaMetadata;
        const obj = {
            ...m,
            tvShow: m.tvShow !== undefined
                ? { id: m.tvShow.id, name: m.tvShow.name, database: m.tvShow.database }
                : undefined,
            movie: m.movie !== undefined
                ? { id: m.movie.id, name: m.movie.name, database: m.movie.database }
                : undefined,
        }

        throw new Error(`Media metadata for "${mediaFolderPathInPlatformFormat}" did not satisfy expectations.\nActual JSON: ${JSON.stringify(obj)}`)
    }
}

/**
 * Same assertions as {@link expectMediaMetadataToBe}, but reads metadata via
 * browser `POST /api/readFile` (works on ohos / electron / desktop).
 */
export async function expectMediaMetadataViaBrowser(
    mediaFolderPathInPlatformFormat: string,
    predicate: (json: unknown) => boolean,
    options?: { timeoutMs?: number; intervalMs?: number },
): Promise<void> {
    const { appDataDir } = await fetchHelloPathsViaBrowser()
    const metadataDir = joinPlatformPath(appDataDir, 'metadata')
    const mediaFolderPosix = Path.posix(mediaFolderPathInPlatformFormat)
    const safeFileName = mediaFolderPosix.replace(/[\/\\:?*|<>"]/g, '_')
    const metadataFilePath = joinPlatformPath(metadataDir, `${safeFileName}.json`)

    const timeoutMs = options?.timeoutMs ?? 90_000
    const intervalMs = options?.intervalMs ?? 2_000
    const deadline = Date.now() + timeoutMs
    let lastError: unknown

    while (Date.now() < deadline) {
        try {
            const metadataRaw = await readFileViaBrowser(metadataFilePath)
            const metadataJson = JSON.parse(metadataRaw) as MediaMetadata
            if (predicate(metadataJson)) {
                return
            }
            const m = metadataJson
            const obj = {
                ...m,
                tvShow: m.tvShow !== undefined
                    ? { id: m.tvShow.id, name: m.tvShow.name, database: m.tvShow.database }
                    : undefined,
                movie: m.movie !== undefined
                    ? { id: m.movie.id, name: m.movie.name, database: m.movie.database }
                    : undefined,
            }
            lastError = new Error(
                `predicate not satisfied yet. Actual: ${JSON.stringify(obj)}`,
            )
        } catch (err) {
            lastError = err
        }
        await browser.pause(intervalMs)
    }

    throw new Error(
        `expectMediaMetadataViaBrowser timed out after ${timeoutMs}ms for "${metadataFilePath}". ` +
            `Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    )
}

/**
 * Write a media metadata JSON file into the app's metadata cache directory.
 *
 * The output path matches {@link expectMediaMetadataToBe}: `getMetadataDir()` plus
 * a filename derived from the folder path (POSIX, invalid path chars replaced with `_`) + `.json`.
 *
 * @param mediaMetadata Must include `mediaFolderPath` (POSIX or platform path; normalized like in expect).
 */
export async function writeMediaMetadata(mediaMetadata: MediaMetadata): Promise<void> {
    const folderPath = mediaMetadata.mediaFolderPath
    if (folderPath === undefined || folderPath === '') {
        throw new Error('writeMediaMetadata: mediaMetadata.mediaFolderPath is required')
    }

    const mediaFolderPosix = Path.posix(folderPath)
    const safeFileName = mediaFolderPosix.replace(/[\/\\:?*|<>"]/g, '_')
    const payload = JSON.stringify(mediaMetadata, null, 4)

    if (TESTBED_V2) {
        const { appDataDir } = await fetchHelloPathsViaBrowser()
        const metadataFilePath = joinPlatformPath(
            joinPlatformPath(appDataDir, 'metadata'),
            `${safeFileName}.json`,
        )
        await writeFileViaBrowser(metadataFilePath, payload)
        console.log(`Wrote media metadata (v2) to ${metadataFilePath}`)
        return
    }

    const metadataDir = await getMetadataDir()
    if (!fs.existsSync(metadataDir)) {
        fs.mkdirSync(metadataDir, { recursive: true })
    }

    const metadataFilePath = path.join(metadataDir, `${safeFileName}.json`)
    fs.writeFileSync(metadataFilePath, payload, 'utf-8')
    console.log(`Wrote media metadata to ${metadataFilePath}`)
}

/**
 * Read smm.json, apply {@link updateFn}, and write the result back.
 * {@link updateFn} may be synchronous or return a Promise.
 * `TESTBED_V2`: browser readFile/writeFile; else host Node fs.
 */
export async function updateUserConfig(updateFn: UserConfigUpdater): Promise<void> {
    if (TESTBED_V2) {
        await updateUserConfigViaBrowser(updateFn)
        return
    }

    const userConfigPath = await getUserConfigPathV1()
    if (!fs.existsSync(userConfigPath)) {
        throw new Error(`updateUserConfig: user config not found at ${userConfigPath}`)
    }

    const raw = fs.readFileSync(userConfigPath, 'utf-8')
    const current = JSON.parse(raw) as UserConfig
    const next = await Promise.resolve(updateFn(current))
    const toWrite = next ?? current

    fs.writeFileSync(userConfigPath, JSON.stringify(toWrite, null, 2), 'utf-8')
    console.log(`Updated user config at: ${userConfigPath}`)
    console.log(`[DIAG] updateUserConfig: wrote folders=${JSON.stringify(toWrite.folders)} to ${userConfigPath}`)
}

export async function importFolderWithMediaMetadata(
    folder: TestFolder,
    mediaMetadataTemplateFileName: string,
    updateMediaMetadata?: (mediaMetadata: MediaMetadata) => MediaMetadata
): Promise<void> {
    const folderPath = folder.path
    if (folderPath === undefined || folderPath === '') {
        throw new Error('importFolderWithMediaMetadata: folder.path is required')
    }

    console.log(`[DIAG] importFolderWithMediaMetadata: writing userConfig folder=${folderPath}`)
    await updateUserConfig((userConfig) => {
        return {
            ...userConfig,
            folders: [folderPath],
        }
    })

    console.log(`[DIAG] importFolderWithMediaMetadata: writing mediaMetadata folder=${folderPath}`)

    const mediaMetadataTemplatePath = path.join(
        __dirname,
        '..',
        '..',
        '..',
        '..',
        'test',
        'templates',
        'mediaMetadatas',
        mediaMetadataTemplateFileName
    )

    if (!fs.existsSync(mediaMetadataTemplatePath)) {
        throw new Error(`importFolderWithMediaMetadata: template not found at ${mediaMetadataTemplatePath}`)
    }

    console.log('Read media metadata template from:', mediaMetadataTemplatePath)
    const template = fs.readFileSync(mediaMetadataTemplatePath, 'utf-8')
    const mediaMetadata = JSON.parse(template) as MediaMetadata

    mediaMetadata.mediaFolderPath = Path.posix(folderPath)
    mediaMetadata.mediaFiles = mediaMetadata.mediaFiles?.map(file => {
        return {
            ...file,
            /**
             * Assume the absolutePath in template is the relative path to the media folder.
             * Need to complete it with folder path
             */
            absolutePath: Path.posix(joinPlatformPath(folder.path!, file.absolutePath))
        }
    })

    const updatedMediaMetadata = updateMediaMetadata !== undefined
        ? updateMediaMetadata(mediaMetadata)
        : mediaMetadata

    await writeMediaMetadata({
        ...updatedMediaMetadata,
        mediaFolderPath: Path.posix(folderPath),
    })
    console.log(`[DIAG] importFolderWithMediaMetadata: DONE folder=${folderPath}`)
}


/**
 * Check if the official TMDB host is accessible
 * Returns true if accessible, false otherwise
 */
export async function isOfficialTmdbHostAccessible(): Promise<boolean> {
    const officialHost = 'https://api.themoviedb.org'
    return _isRemoteAccessible(`${officialHost}/3/configuration?api_key=dummy`, 'GET')
}

export async function isOfficialTvdbHostAccessible(): Promise<boolean> {
    const officialHost = 'https://api4.thetvdb.com/v4'
    return _isRemoteAccessible(`${officialHost}/people`, 'GET')
}

/**
 * Check if the CLI-managed reverse proxy is up and discoverable through the hello task.
 * Returns true when the hello response contains a `reverseProxyUrl` and that URL responds
 * to an OPTIONS preflight (which the proxy answers with `204 No Content`).
 */
export async function isReverseProxyAccessible(): Promise<boolean> {
    let proxyUrl: string | null = null
    try {
        const helloResp = await hello()
        proxyUrl = helloResp.reverseProxyUrl
    } catch (error) {
        console.warn('Failed to call hello API while probing reverse proxy', error)
        return false
    }

    if (!proxyUrl) {
        return false
    }

    return _isRemoteAccessible(proxyUrl, 'OPTIONS')
}

export async function _isRemoteAccessible(url: string, method: 'GET' | 'HEAD' | 'OPTIONS' = 'GET'): Promise<boolean> {
    try {
        const response = await fetch(url, {
            method,
            // Use a short timeout to avoid hanging
            signal: AbortSignal.timeout(5000),
        })
        // Even if response is 4xx/5xx, host is still reachable.
        // Only network errors mean it's not accessible.
        return response.status !== undefined
    } catch (error) {
        console.warn(`Remote is not accessible: ${url}`, error)
        return false
    }
}

/**
 * Probe whether an HTTP proxy URL is reachable.
 *
 * Used as a pre-flight check for the "custom host via HTTP proxy" e2e specs.
 * We can't `fetch()` through a generic HTTP proxy from Node without an
 * agent library, so this checks the lower bar: is the proxy's TCP endpoint
 * accepting connections? If the port is open we treat the proxy as
 * "ready"; a 4xx/5xx response from the actual proxied call would surface
 * as a different failure mode that the spec already exercises.
 */
export async function isHttpProxyAccessible(proxyUrl: string | null | undefined): Promise<boolean> {
    if (!proxyUrl || typeof proxyUrl !== 'string') return false
    let parsed: URL
    try {
        parsed = new URL(proxyUrl)
    } catch {
        console.warn(`Invalid HTTP proxy URL: ${proxyUrl}`)
        return false
    }
    const protocol = parsed.protocol.toLowerCase()
    if (protocol !== 'http:' && protocol !== 'https:') {
        console.warn(`Unsupported HTTP proxy protocol: ${parsed.protocol}`)
        return false
    }
    const host = parsed.hostname
    const port = parsed.port
        ? Number.parseInt(parsed.port, 10)
        : protocol === 'https:'
            ? 443
            : 80
    if (!host || !Number.isFinite(port) || port <= 0) return false

    const { createConnection } = await import('node:net')
    return await new Promise<boolean>((resolve) => {
        const socket = createConnection({ host, port })
        const finish = (ok: boolean) => {
            socket.removeAllListeners()
            if (!socket.destroyed) socket.destroy()
            resolve(ok)
        }
        const timer = setTimeout(() => finish(false), 5000)
        socket.once('connect', () => {
            clearTimeout(timer)
            finish(true)
        })
        socket.once('error', (error) => {
            clearTimeout(timer)
            console.warn(`HTTP proxy not accessible: ${proxyUrl}`, error)
            finish(false)
        })
    })
}