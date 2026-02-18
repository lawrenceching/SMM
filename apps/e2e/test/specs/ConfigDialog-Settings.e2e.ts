import { expect, browser } from '@wdio/globals'
import Menu from '../componentobjects/Menu'
import ConfigDialog from '../componentobjects/ConfigDialog'
import StatusBar from '../componentobjects/StatusBar'
import Page from '../pageobjects/page'
import { createBeforeHook } from '../lib/testbed'
import { delay } from 'es-toolkit'

const slowdown = process.env.SLOWDOWN === 'true'

describe('Config Dialog Settings', () => {
    before(async () => {
        await createBeforeHook({ setupMediaFolders: false })()
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

})
