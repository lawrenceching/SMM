/**
 * Test Bed - Common E2E Test Setup Utilities
 *
 * This module provides shared setup functions for E2E tests.
 * Import these functions in your test files to avoid code duplication.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import type { UserConfig } from '@smm/core/types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env.local from e2e folder
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env.local') })

/**
 * Reset user config to default state
 * @param userConfigPath Path to the user config file
 */
export function resetUserConfig(userConfigPath: string): void {
    const deepseekApiKey = process.env.DEEPSEEK_API_KEY

    const userConfig: UserConfig = {
        applicationLanguage: 'en',
        tmdb: {},
        folders: [],
        renameRules: [],
        dryRun: false,
        ai: {
            deepseek: {
                baseURL: 'https://api.deepseek.com',
                model: 'deepseek-chat',
                apiKey: deepseekApiKey,
            },
            openAI: {},
            openrouter: {},
            glm: {},
            other: {},
        },
        selectedAI: 'DeepSeek',
        selectedTMDBIntance: 'public',
        selectedRenameRule: 'Plex(TvShow/Anime)',
        enableMcpServer: false,
        mcpHost: '127.0.0.1',
        mcpPort: 30001,
    }

    fs.writeFileSync(userConfigPath, JSON.stringify(userConfig, null, 2), 'utf-8')
    console.log(`Reset user config at: ${userConfigPath}`)
}

/**
 * Set up test media folders for import tests
 * This creates a temporary directory and copies test media files
 *
 * Use this function only for tests that require actual media files
 */
export function setupTestMediaFolders(): void {
    const tmpDir = path.join(os.tmpdir(), 'smm-test-media')

    // 1. Create or recreate tmp folder
    if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    }
    fs.mkdirSync(tmpDir, { recursive: true })
    console.log(`Created tmp folder: ${tmpDir}`)

    // 2. Copy `test/media` to tmp folder (project root test/media, not e2e/test/media)
    const testMediaPath = path.resolve(__dirname, '..', '..', '..', '..', 'test', 'media')
    const targetMediaPath = path.join(tmpDir, 'media')

    // Recursive copy function
    function copyRecursiveSync(source: string, destination: string): void {
        const stats = fs.statSync(source)

        if (stats.isDirectory()) {
            // Create destination directory
            fs.mkdirSync(destination, { recursive: true })

            // Read all items in the directory
            const items = fs.readdirSync(source)

            // Copy each item recursively
            for (const item of items) {
                const sourcePath = path.join(source, item)
                const destPath = path.join(destination, item)
                copyRecursiveSync(sourcePath, destPath)
            }
        } else if (stats.isFile()) {
            // Copy file
            fs.copyFileSync(source, destination)
        }
    }

    copyRecursiveSync(testMediaPath, targetMediaPath)
    console.log(`Copied test/media to ${targetMediaPath}`)
}

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

        // Set up test media folders if requested
        if (setupMediaFolders) {
            setupTestMediaFolders()
        }

        // Call API to get user data directory
        const response = await fetch('http://localhost:30000/api/execute', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: 'hello',
            }),
        })
        const data = await response.json() as any

        /**
         * API response: {
         *      uptime: 7.725934100000001,
         *      version: '1.0.0',
         *      userDataDir: 'C:\\Users\\zzz\\AppData\\Roaming\\SMM',
         *      appDataDir: 'C:\\Users\\zzz\\AppData\\Roaming\\SMM'
         *    }
         */
        console.log('API response:', data)
        const appDataDir = data.appDataDir as string
        const userDataDir = data.userDataDir as string
        const userConfigPath = path.join(userDataDir, 'smm.json')
        resetUserConfig(userConfigPath)

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
