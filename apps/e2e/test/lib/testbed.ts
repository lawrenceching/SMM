/**
 * Test Bed - Common E2E Test Setup Utilities
 *
 * This module provides shared setup functions for E2E tests.
 * Import these functions in your test files to avoid code duplication.
 */
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { setupTestMediaFolders, resetUserConfig, getUserConfigPath, getMetadataDir, removeMetadataDir, prepareMediaMetadata } from '@smm/test'

// Re-export for convenience
export { setupTestMediaFolders, resetUserConfig, getUserConfigPath, removeMetadataDir }

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
    /** Custom setup function to run after basic setup */
    customSetup?: () => Promise<void>
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
 * @param options - Configuration options for the before hook
 * @returns A before hook function for Mocha describe blocks
 */
export function createBeforeHook(options: TestBedBeforeOptions = {}) {
    const { setupMediaFolders = false, customSetup } = options

    return async function() {
        // Import browser dynamically inside the hook to ensure it's fully initialized
        const { browser } = await import('@wdio/globals')

        const metadataDir = await getMetadataDir();
        // Remove metadata directory if it exists. The metadata dir may contain files from previous tests.
        await removeMetadataDir();

        // Set up test media folders if requested
        if (setupMediaFolders) {
            setupTestMediaFolders()
        }

        // Get user config path and reset user config
        const userConfigPath = await getUserConfigPath()
        await resetUserConfig(userConfigPath)

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

        // Check Sidebar is in initial state (no folders displayed)
        await browser.waitUntil(async () => {
            return await Sidebar.isInInitialState()
        }, {
            timeout: 5000,
            timeoutMsg: 'Sidebar was not in initial state after 5 seconds'
        })
        console.log('Sidebar is in initial state (no folders displayed)')

        // Run custom setup if provided
        if (customSetup) {
            await customSetup()
        }
    }
}
