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
import { setupTestMediaFolders, resetUserConfig, getUserConfigPath, getMetadataDir, removeMetadataDir, removeTestMediaTmpDir, removePlansDir, prepareMediaMetadata, removePlanFolder } from '@smm/test'
import { Path } from '@smm/core'
import { createMediaMetadata as coreCreateMediaMetadata } from '@smm/core/mediaMetadata'
import type { MediaFileMetadata, MediaMetadata, UserConfig } from '@smm/core/types'
import type { TestFolder } from 'test/actions/import-folders'
import Sidebar from '../componentobjects/Sidebar'
import StatusBar from '../componentobjects/StatusBar'
// Re-export for convenience
export { setupTestMediaFolders, resetUserConfig, getUserConfigPath, removeMetadataDir, removeTestMediaTmpDir, removePlansDir }

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env.local from e2e folder
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env.local') })

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

export async function setup(options: {
    removeMetadataDir: boolean,
    removePlansDir: boolean,
    removeMediaFolders: boolean,
    removeDirInSidebar: boolean,
    resetUserConfig: boolean,
    openBrowserPage: boolean,
}) {

    await cleanup({
        removePlansDir: options.removePlansDir,
        removeMetadataDir: options.removeMetadataDir,
        removeMediaFolders: options.removeMediaFolders,
        removeDirInSidebar: options.removeDirInSidebar,
        resetUserConfig: options.resetUserConfig,
    })


    if(options.openBrowserPage) {
        const { default: Page } = await import('../pageobjects/page')
        await Page.open()
        
        await browser.waitUntil(async () => {
            return await StatusBar.isDisplayed()
        }, {
            timeout: 10000,
            timeoutMsg: 'Status bar was not displayed after 10 seconds'
        })
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

        Page.open()

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
    resetUserConfig: boolean,
}): Promise<void> {
    const { removeMetadataDir: isToRemoveMetadataDir = true, removePlansDir: isToRemovePlansDir = true, removeMediaFolders: isToRemoveMediaFolders = true, removeDirInSidebar: isToRemoveDirInSidebar = true, resetUserConfig: needToResetUserConfig } = options ?? {
        removeMetadataDir: true,
    };
    if (isToRemoveMediaFolders) {
        removeTestMediaTmpDir()
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
    if(needToResetUserConfig) {
        await resetUserConfig()
    }
}

export async function removeDirInSidebar(): Promise<void> {
    await Sidebar.deleteAllFolders()
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
            tmdbTvShow: m.tmdbTvShow !== undefined ? {
                id: m.tmdbTvShow?.id,
                name: m.tmdbTvShow?.name,
            } : undefined,
            tmdbMovie: m.tmdbMovie !== undefined ? {
                id: m.tmdbMovie?.id,
                name: m.tmdbMovie?.title,
            } : undefined,
            tvdbTvShow: m.tvShow !== undefined ? {
                id: m.tvShow?.id,
                name: m.tvShow?.name,
            } : undefined,
            tvdbMovie: m.movie !== undefined ? {
                id: m.movie?.id,
                name: m.movie?.name,
            } : undefined,
        }

        throw new Error(`Media metadata for "${mediaFolderPathInPlatformFormat}" did not satisfy expectations.\nActual JSON: ${JSON.stringify(obj)}`)
    }
}
