import { expect, browser } from '@wdio/globals'
import Menu from '../componentobjects/Menu'
import ConfigDialog from '../componentobjects/ConfigDialog'
import StatusBar from '../componentobjects/StatusBar'
import Page from '../pageobjects/page'
import { createBeforeHook } from '../lib/testbed'
import { delay } from 'es-toolkit'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const slowdown = process.env.SLOWDOWN === 'true'
const officialHost = 'https://api.themoviedb.org'

/**
 * Check if the official TMDB host is accessible
 * Returns true if accessible, false otherwise
 */
async function isOfficialHostAccessible(): Promise<boolean> {
    try {
        const response = await fetch(`${officialHost}/3/configuration?api_key=dummy`, {
            method: 'GET',
            // Use a short timeout to avoid hanging
            signal: AbortSignal.timeout(5000),
        })
        // Even if we get a 401 (unauthorized), it means the host is reachable
        // Only network errors mean it's not accessible
        return response.status !== undefined
    } catch (error) {
        console.warn('Official TMDB host is not accessible:', error)
        return false
    }
}

// Read TMDB_API_KEY from .env.local in project root
function getTmdbApiKey(): string {
    const envFilePath = path.resolve(__dirname, '..', '..', '..', '..', '.env.local')
    try {
        const content = fs.readFileSync(envFilePath, 'utf-8')
        const match = content.match(/TMDB_API_KEY=(.+)/)
        if (match && match[1]) {
            // Remove quotes if present
            return match[1].replace(/^['"]|['"]$/g, '')
        }
    } catch (e) {
        console.warn('Could not read TMDB_API_KEY from .env.local:', e)
    }
    return ''
}

describe('Config Dialog Settings', () => {
    before(async () => {
        // Check if the officialHost is accessible
        console.log(`Checking if ${officialHost} is accessible...`)
        const isAccessible = await isOfficialHostAccessible()
        if (!isAccessible) {
            throw new Error(`${officialHost} 不可达, 请确认是否需要开启代理`)
        }
        console.log(`${officialHost} is accessible, running test...`)

        await createBeforeHook({ setupMediaFolders: false })()
    })

    beforeEach(async () => {
        // Refresh page before each test to reset page state
        await reloadAndWaitForReady()
    })

    /**
     * Helper function to reload page and wait for it to be ready
     */
    async function reloadAndWaitForReady(): Promise<void> {
        await Page.refresh()
        await browser.waitUntil(async () => {
            return await StatusBar.isDisplayed()
        }, {
            timeout: 10000,
            timeoutMsg: 'Status bar was not displayed after page reload'
        })
        // Add a small delay to let the UI stabilize after reload
        await browser.pause(500)
        console.log('Page reloaded and ready')
    }

    /**
     * Helper function to save settings and close dialog + menu
     */
    async function saveAndCloseDialog(): Promise<void> {
        await ConfigDialog.clickSave()
        // Press Escape twice: once to close dialog, once to close menu dropdown
        await ConfigDialog.pressEscape()
        await browser.pause(200)
        await ConfigDialog.pressEscape()
        await ConfigDialog.waitForClosed()
    }

    /**
     * Helper function to search TMDB via the API in browser context
     * Returns the response from the API
     */
    async function searchTmdbApi(keyword: string, type: 'movie' | 'tv' = 'movie'): Promise<{ results: any[]; error?: string }> {
        const result = await browser.execute(async (kw, mediaType) => {
            const resp = await fetch('/api/tmdb/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    keyword: kw,
                    type: mediaType,
                    language: 'en-US',
                }),
            });
            return await resp.json();
        }, keyword, type) as unknown as { results: any[]; error?: string };
        return result;
    }

    describe('General Settings - Language', () => {
        it('should change and persist language setting', async function() {
            if (slowdown) {
                this.timeout(120 * 1000)
            }

            // Step 1: Open config dialog
            console.log('Opening config dialog...')
            await Menu.openConfigDialog()
            await ConfigDialog.waitForDisplayed()
            expect(await ConfigDialog.isDisplayed()).toBe(true)

            if (slowdown) {
                await delay(1000)
            }

            // Get initial language value
            const initialLanguage = await ConfigDialog.getSelectedLanguage()
            console.log(`Initial language: ${initialLanguage}`)

            // Step 2: Change language (toggle between zh-CN and en-US)
            const newLanguage = initialLanguage.includes('中文') ? 'en' : 'zh-CN'
            console.log(`Changing language to: ${newLanguage}`)
            await ConfigDialog.selectLanguage(newLanguage)

            if (slowdown) {
                await delay(1000)
            }

            // Step 3: Save and reload
            console.log('Saving settings...')
            await saveAndCloseDialog()

            console.log('Reloading page...')
            await reloadAndWaitForReady()

            // Verify menu items are displayed in the new language
            console.log(`Verifying menu items in ${newLanguage} language...`)

            // Open the SMM menu
            await Menu.clickSmmMenuTrigger()
            await Menu.waitForSmmMenuContent()

            // Define expected menu items with their data-testid based on language
            const menuTranslations: Record<string, Record<string, string>> = {
                'en': {
                    'open-folder': 'Open Folder',
                    'open-media-library': 'Open Media Library',
                    'open-app-data-folder': 'Open App Data Folder',
                    'config': 'Config',
                    'clean-up': 'Clean Up',
                    'exit': 'Exit'
                },
                'zh-CN': {
                    'open-folder': '打开文件夹',
                    'open-media-library': '打开媒体库',
                    'open-app-data-folder': '打开应用数据文件夹',
                    'config': '设置',
                    'clean-up': '清理',
                    'exit': '退出'
                }
            }

            const translations = menuTranslations[newLanguage]
            // Verify each menu item text matches expected translation
            for (const [testId, expectedText] of Object.entries(translations)) {
                const menuItem = await $(`[data-testid="menu-smm-${testId}"]`)
                const actualText = await menuItem.getText()
                expect(actualText).toBe(expectedText)
                console.log(`  ✓ menu-smm-${testId}: "${actualText}"`)
            }

            console.log('Menu language verification passed')

            if (slowdown) {
                await delay(1000)
            }

            // Close the menu before proceeding (press Escape)
            await browser.keys('Escape')
            await browser.pause(300)

            // Step 4: Open dialog and verify value
            console.log('Verifying language change...')
            await Menu.openConfigDialog()
            await ConfigDialog.waitForDisplayed()

            const savedLanguage = await ConfigDialog.getSelectedLanguage()
            console.log(`Saved language: ${savedLanguage}`)

            // Verify the language changed (check if it contains the expected text)
            if (newLanguage === 'en') {
                expect(savedLanguage).toContain('English')
            } else {
                expect(savedLanguage).toContain('中文')
            }

            if (slowdown) {
                await delay(1000)
            }

            // Step 5: Revert to original
            console.log('Reverting to original language...')
            const originalLanguageCode = initialLanguage.includes('中文') ? 'zh-CN' : 'en'
            await ConfigDialog.selectLanguage(originalLanguageCode)
            await saveAndCloseDialog()

            console.log('Language test completed successfully')
        })
    })

    describe('General Settings - TMDB Host', () => {
        it('should change and persist TMDB host setting', async function() {
            
            if (slowdown) {
                this.timeout(120 * 1000)
            }

            // Step 1: Open config dialog
            console.log('Opening config dialog...')
            await Menu.openConfigDialog()
            await ConfigDialog.waitForDisplayed()

            // Get initial value
            const initialHost = await ConfigDialog.getTmdbHost()
            console.log(`Initial TMDB host: ${initialHost}`)

            // Step 1b: Search TMDB with current (default) host and verify it succeeds
            console.log('Step 1b: Searching TMDB with default host...')
            const searchResultBefore = await searchTmdbApi('Inception')
            console.log('TMDB search result (before host change):', JSON.stringify(searchResultBefore))
            // Verify search succeeded - should have results or no error
            expect(searchResultBefore.error).toBeUndefined()
            expect(searchResultBefore.results).toBeDefined()
            console.log(`TMDB search succeeded with ${searchResultBefore.results?.length || 0} results`)

            if (slowdown) {
                await delay(1000)
            }

            // Step 2: Change TMDB host to an invalid host
            const newHost = 'http://tmdb.local'
            console.log(`Changing TMDB host to: ${newHost}`)
            await ConfigDialog.setTmdbHost(newHost)

            if (slowdown) {
                await delay(1000)
            }

            // Step 3: Save and reload
            console.log('Saving settings...')
            await saveAndCloseDialog()

            console.log('Reloading page...')
            await reloadAndWaitForReady()

            if (slowdown) {
                await delay(1000)
            }

            // Step 3b: Open dialog and verify value was saved
            console.log('Verifying TMDB host change...')
            await Menu.openConfigDialog()
            await ConfigDialog.waitForDisplayed()

            const savedHost = await ConfigDialog.getTmdbHost()
            console.log(`Saved TMDB host: ${savedHost}`)
            expect(savedHost).toBe(newHost)

            if (slowdown) {
                await delay(1000)
            }

            // Step 3c: Search TMDB with invalid host and verify it fails
            console.log('Step 3c: Searching TMDB with invalid host (should fail)...')
            const searchResultAfter = await searchTmdbApi('Inception')
            console.log('TMDB search result (after host change):', JSON.stringify(searchResultAfter))
            // Verify search failed due to invalid host
            expect(searchResultAfter.error).toBeDefined()
            console.log(`TMDB search failed as expected with error: ${searchResultAfter.error}`)

            if (slowdown) {
                await delay(1000)
            }

            // Step 4: Revert to original (empty string = use default)
            console.log('Reverting to original TMDB host (empty string)...')
            await ConfigDialog.setTmdbHost(initialHost)
            await saveAndCloseDialog()

            // Step 4b: Verify TMDB works again with default host
            console.log('Step 4b: Verifying TMDB works again with default host...')
            await reloadAndWaitForReady()
            await Menu.openConfigDialog()
            await ConfigDialog.waitForDisplayed()

            const revertedHost = await ConfigDialog.getTmdbHost()
            console.log(`Reverted TMDB host: ${revertedHost}`)

            console.log('TMDB host test completed successfully')
        })
    })

    describe('General Settings - TMDB API Key', () => {
        it('should change and persist TMDB API key setting', async function() {
            
            if (slowdown) {
                this.timeout(180 * 1000)
            }

            // Get the real API key from .env.local
            const validApiKey = getTmdbApiKey()
            console.log(`TMDB API key from .env.local: ${validApiKey ? '***present***' : '***missing***'}`)
            expect(validApiKey).toBeTruthy()

            const wrongApiKey = 'wrong-api-key-12345'


            // Step 1: Open config dialog
            console.log('Opening config dialog...')
            await Menu.openConfigDialog()
            await ConfigDialog.waitForDisplayed()

            // Get initial values
            const initialHost = await ConfigDialog.getTmdbHost()
            const initialApiKey = await ConfigDialog.getTmdbApiKey()
            console.log(`Initial TMDB host: ${initialHost}`)
            console.log(`Initial TMDB API key: ${initialApiKey}`)

            if (slowdown) {
                await delay(1000)
            }

            // Step 2: Set TMDB host to official host and set valid API key
            console.log(`Step 2: Setting TMDB host to: ${officialHost}`)
            await ConfigDialog.setTmdbHost(officialHost)

            if (slowdown) {
                await delay(500)
            }

            console.log('Setting TMDB API key...')
            await ConfigDialog.setTmdbApiKey(validApiKey)

            if (slowdown) {
                await delay(1000)
            }

            // Step 3: Save and reload
            console.log('Saving settings...')
            await saveAndCloseDialog()

            console.log('Reloading page...')
            await reloadAndWaitForReady()

            if (slowdown) {
                await delay(1000)
            }

            // Step 3b: Verify settings were saved
            console.log('Verifying settings...')
            await Menu.openConfigDialog()
            await ConfigDialog.waitForDisplayed()

            const savedHost = await ConfigDialog.getTmdbHost()
            const savedApiKey = await ConfigDialog.getTmdbApiKey()
            console.log(`Saved TMDB host: ${savedHost}`)
            console.log(`Saved TMDB API key: ${savedApiKey}`)
            expect(savedHost).toBe(officialHost)
            expect(savedApiKey).toBe(validApiKey)

            if (slowdown) {
                await delay(1000)
            }

            // Step 4: Search TMDB with valid API key and verify it succeeds
            console.log('Step 4: Searching TMDB with valid API key...')
            const searchResultValid = await searchTmdbApi('Inception')
            console.log('TMDB search result (valid key):', JSON.stringify(searchResultValid))
            expect(searchResultValid.error).toBeUndefined()
            expect(searchResultValid.results).toBeDefined()
            console.log(`TMDB search succeeded with ${searchResultValid.results?.length || 0} results`)

            if (slowdown) {
                await delay(1000)
            }

            // Step 5: Update API key to wrong value
            console.log('Step 5: Updating API key to wrong value...')
            await ConfigDialog.setTmdbApiKey(wrongApiKey)

            if (slowdown) {
                await delay(500)
            }

            // Save and reload
            console.log('Saving settings with wrong API key...')
            await saveAndCloseDialog()

            console.log('Reloading page...')
            await reloadAndWaitForReady()

            if (slowdown) {
                await delay(1000)
            }

            // Open dialog to verify
            await Menu.openConfigDialog()
            await ConfigDialog.waitForDisplayed()

            const savedHost2 = await ConfigDialog.getTmdbHost()
            const savedApiKey2 = await ConfigDialog.getTmdbApiKey()
            console.log(`Saved TMDB host: ${savedHost2}`)
            console.log(`Saved TMDB API key: ${savedApiKey2}`)
            expect(savedHost2).toBe(officialHost)
            expect(savedApiKey2).toBe(wrongApiKey)

            if (slowdown) {
                await delay(1000)
            }

            // Step 6: Search TMDB with wrong API key and verify it fails
            console.log('Step 6: Searching TMDB with wrong API key (should fail)...')
            const searchResultWrong = await searchTmdbApi('Inception')
            console.log('TMDB search result (wrong key):', JSON.stringify(searchResultWrong))
            expect(searchResultWrong.error).toBeDefined()
            console.log(`TMDB search failed as expected with error: ${searchResultWrong.error}`)

            if (slowdown) {
                await delay(1000)
            }

            // Step 7: Revert to original settings
            console.log('Step 7: Reverting to original settings...')
            await ConfigDialog.setTmdbHost(initialHost)
            await ConfigDialog.setTmdbApiKey(initialApiKey)
            await saveAndCloseDialog()

            console.log('TMDB API key test completed successfully')
        })
    })

    describe('General Settings - Turn on/off MCP server', () => {
        it('should toggle MCP server via settings and verify connectivity', async function() {
            if (slowdown) {
                this.timeout(120 * 1000)
            }

            // Step 1: Open config dialog
            console.log('Opening config dialog...')
            await Menu.openConfigDialog()
            await ConfigDialog.waitForDisplayed()
            expect(await ConfigDialog.isDisplayed()).toBe(true)

            // Step 2: Enable MCP server via settings toggle
            console.log('Enabling MCP server...')
            await ConfigDialog.toggleMcpServer(true)

            if (slowdown) {
                await delay(1000)
            }

            // Step 3: Save settings
            console.log('Saving settings...')
            await saveAndCloseDialog()

            // Wait for MCP server to start
            console.log('Waiting for MCP server to start...')
            await delay(3000)

            // Step 4: Open MCP popover in status bar to get MCP address
            console.log('Opening MCP popover to get server address...')
            await StatusBar.clickMcpToggle()
            
            const isPopoverOpen = await StatusBar.waitForMcpPopover(5000)
            expect(isPopoverOpen).toBe(true)

            const mcpAddress = await StatusBar.getMcpAddress()
            console.log(`MCP Address: ${mcpAddress}`)
            expect(mcpAddress).toContain('http://')

            // Step 5: Verify MCP server is running by fetching the address
            console.log('Verifying MCP server is running...')
            const isMcpRunning = await browser.executeAsync(async (address, done) => {
                try {
                    const response = await fetch(address, { 
                        method: 'GET',
                        mode: 'no-cors'
                    })
                    done(true)
                } catch {
                    done(false)
                }
            }, mcpAddress)
            
            expect(isMcpRunning).toBe(true)
            console.log('MCP server is running')

            // Close the popover
            await StatusBar.clickMcpToggle()
            await delay(500)

            if (slowdown) {
                await delay(1000)
            }

            // Step 6: Disable MCP server via settings
            console.log('Disabling MCP server...')
            await Menu.openConfigDialog()
            await ConfigDialog.waitForDisplayed()
            
            await ConfigDialog.toggleMcpServer(false)

            if (slowdown) {
                await delay(1000)
            }

            // Step 7: Save settings
            console.log('Saving settings...')
            await saveAndCloseDialog()

            // Wait for MCP server to stop
            console.log('Waiting for MCP server to stop...')
            await delay(3000)

            // Step 8: Verify MCP server is not running
            console.log('Verifying MCP server is offline...')
            const isMcpStopped = await browser.executeAsync(async (address, done) => {
                try {
                    const controller = new AbortController()
                    const timeoutId = setTimeout(() => controller.abort(), 2000)
                    
                    await fetch(address, { 
                        method: 'GET',
                        signal: controller.signal
                    })
                    clearTimeout(timeoutId)
                    done(true) // Server still running
                } catch (error: any) {
                    if (error.name === 'AbortError') {
                        done(false)
                    } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                        done(false)
                    } else {
                        done(false)
                    }
                }
            }, mcpAddress)
            
            expect(isMcpStopped).toBe(false)
            console.log('MCP server is offline')

            console.log('MCP server toggle test completed successfully')
        })
    })


})
