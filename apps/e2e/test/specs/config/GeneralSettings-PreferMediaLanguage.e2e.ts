import { expect, browser } from '@wdio/globals'
import Menu from '../../componentobjects/Menu'
import ConfigDialog from '../../componentobjects/ConfigDialog'
import StatusBar from '../../componentobjects/StatusBar'
import Page from '../../pageobjects/page'
import { createBeforeHook } from '../../lib/testbed'
import { delay } from 'es-toolkit'
import { createAndImportFolder, folder3 } from 'test/actions/import-folders'
import TvShowPanelCO from 'test/componentobjects/TVShowPanel.co'
import { env } from 'node:process'

const slowdown = process.env.SLOWDOWN === 'true'

type PreferMediaLanguageRollback = '__unset__' | 'zh-CN' | 'en-US' | 'ja-JP'

describe('General Settings - Prefer Media Language', () => {
    let rollbackPreferMediaLanguage: PreferMediaLanguageRollback | null = null
    let preferMediaLanguageConfigSaved = false

    before(createBeforeHook({ setupMediaFolders: false }))

    beforeEach(async () => {
        rollbackPreferMediaLanguage = null
        preferMediaLanguageConfigSaved = false
        await reloadAndWaitForReady()
    })

    afterEach(async () => {
        if (!preferMediaLanguageConfigSaved || rollbackPreferMediaLanguage === null) {
            return
        }
        try {
            console.log(`Reverting preferMediaLanguage to: ${rollbackPreferMediaLanguage}`)
            if (!await ConfigDialog.isDisplayed()) {
                await Menu.openConfigDialog()
                await ConfigDialog.waitForDisplayed()
            }
            await ConfigDialog.setPreferMediaLanguage(rollbackPreferMediaLanguage)
            await saveAndCloseDialog()
        } finally {
            rollbackPreferMediaLanguage = null
            preferMediaLanguageConfigSaved = false
        }
    })

    async function reloadAndWaitForReady(): Promise<void> {
        await Page.refresh()
        await browser.waitUntil(async () => {
            return await StatusBar.isDisplayed()
        }, {
            timeout: 10000,
            timeoutMsg: 'Status bar was not displayed after page reload'
        })
        await browser.pause(500)
        console.log('Page reloaded and ready')
    }

    async function saveAndCloseDialog(): Promise<void> {
        await ConfigDialog.clickSave()
        await ConfigDialog.pressEscape()
        await browser.pause(200)
        await ConfigDialog.pressEscape()
        await ConfigDialog.waitForClosed()
    }

    it('should change and persist prefer media language setting', async function() {
        if (slowdown) {
            this.timeout(120 * 1000)
        }

        await createAndImportFolder(folder3, 'e2eTest:Import Media Folder')
        await browser.pause(2000)

        await TvShowPanelCO.immersiveInput.click()
        await browser.pause(2000)

        expect(await TvShowPanelCO.searchbox.database.getText()).toBe('TMDB')
        expect(await TvShowPanelCO.searchbox.language.getText()).toBe('English (US)')

        console.log('Opening config dialog...')
        if (env.slowdown) {
            await delay(1000)
        }
        await Menu.openConfigDialog()
        await ConfigDialog.waitForDisplayed()
        expect(await ConfigDialog.isDisplayed()).toBe(true)

        if (slowdown) {
            await delay(1000)
        }

        const initialSelected = await ConfigDialog.getSelectedPreferMediaLanguage()
        const initialCode: PreferMediaLanguageRollback = initialSelected.includes('zh-CN')
            ? 'zh-CN'
            : initialSelected.includes('en-US')
                ? 'en-US'
                : initialSelected.includes('ja-JP')
                    ? 'ja-JP'
                    : '__unset__'
        rollbackPreferMediaLanguage = initialCode

        const newCode = initialCode === 'zh-CN' ? 'en-US' : 'zh-CN'
        console.log(`Initial preferMediaLanguage: ${initialCode}, changing to: ${newCode}`)

        await ConfigDialog.setPreferMediaLanguage(newCode)

        if (slowdown) {
            await delay(1000)
        }

        console.log('Saving settings...')
        await saveAndCloseDialog()
        preferMediaLanguageConfigSaved = true

        console.log(`Saved preferMediaLanguage: ${newCode}`)

        await TvShowPanelCO.immersiveInput.click()
        await browser.pause(2000)

        expect(await TvShowPanelCO.searchbox.database.getText()).toBe('TMDB')
        expect(await TvShowPanelCO.searchbox.language.getText()).toBe('简体中文')

        console.log('Reloading page...')
        await reloadAndWaitForReady()
        await Menu.openConfigDialog()
        await ConfigDialog.waitForDisplayed()

        const savedSelected = await ConfigDialog.getSelectedPreferMediaLanguage()
        console.log(`Saved preferMediaLanguage label: ${savedSelected}`)
        expect(savedSelected).toContain(newCode)
    })
})
