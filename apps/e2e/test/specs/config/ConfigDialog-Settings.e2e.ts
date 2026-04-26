import { expect, browser } from '@wdio/globals'
import Menu from '../../componentobjects/Menu'
import ConfigDialog from '../../componentobjects/ConfigDialog'
import StatusBar from '../../componentobjects/StatusBar'
import Page from '../../pageobjects/page'
import { setup, cleanup } from '../../lib/testbed'
import { delay } from 'es-toolkit'

const slowdown = process.env.SLOWDOWN === 'true'

describe('Config Dialog Settings - General Settings', () => {
    before(async () => {
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: true,
            openBrowserPage: true,
        })
    })

    after(async () => {
        await cleanup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: true,
        })
    })

    beforeEach(async () => {
        await reloadAndWaitForReady()
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
    }

    async function saveAndCloseDialog(): Promise<void> {
        await ConfigDialog.clickSave()
        await ConfigDialog.pressEscape()
        await browser.pause(200)
        await ConfigDialog.pressEscape()
        await ConfigDialog.waitForClosed()
    }

    it('should persist all general settings after save and page refresh', async function() {
        if (slowdown) {
            this.timeout(120 * 1000)
        }

        const newSettings = {
            applicationLanguage: 'en',
            theme: 'dark' as const,
            tmdbHost: 'http://tmdb.local',
            tmdbApiKey: 'tmdb-key-for-e2e',
            tmdbProxy: 'http://127.0.0.1:8899',
            primaryDatabase: 'TVDB' as const,
            preferMediaLanguage: 'ja-JP' as const,
            tvdbHost: 'http://tvdb.local',
            tvdbApiKey: 'tvdb-key-for-e2e',
            enableMcpServer: true,
            mcpHost: '127.0.0.2',
            mcpPort: '30021',
        }

        // 1) Open ConfigDialog
        await Menu.openConfigDialog()
        await ConfigDialog.waitForDisplayed()
        expect(await ConfigDialog.isDisplayed()).toBe(true)

        // 2) Update all writable GeneralSettings fields
        await ConfigDialog.selectLanguage(newSettings.applicationLanguage)
        await ConfigDialog.selectTheme(newSettings.theme)
        await ConfigDialog.setTmdbHost(newSettings.tmdbHost)
        await ConfigDialog.setTmdbApiKey(newSettings.tmdbApiKey)
        await ConfigDialog.setTmdbProxy(newSettings.tmdbProxy)
        await ConfigDialog.setPrimaryDatabase(newSettings.primaryDatabase)
        await ConfigDialog.setPreferMediaLanguage(newSettings.preferMediaLanguage)
        await ConfigDialog.setTvdbHost(newSettings.tvdbHost)
        await ConfigDialog.setTvdbApiKey(newSettings.tvdbApiKey)
        await ConfigDialog.toggleMcpServer(newSettings.enableMcpServer)
        await ConfigDialog.setMcpHost(newSettings.mcpHost)
        await ConfigDialog.setMcpPort(newSettings.mcpPort)

        if (slowdown) {
            await delay(600)
        }

        // 3) Save then refresh page
        await saveAndCloseDialog()
        await reloadAndWaitForReady()

        // 4) Re-open ConfigDialog
        await Menu.openConfigDialog()
        await ConfigDialog.waitForDisplayed()

        // 5) Validate all values are the updated values
        expect(await ConfigDialog.getSelectedLanguage()).toContain('English')
        expect(await ConfigDialog.getSelectedTheme()).toContain('Dark')
        expect(await ConfigDialog.getTmdbHost()).toBe(newSettings.tmdbHost)
        expect(await ConfigDialog.getTmdbApiKey()).toBe(newSettings.tmdbApiKey)
        expect(await ConfigDialog.getTmdbProxy()).toBe(newSettings.tmdbProxy)
        expect(await ConfigDialog.getSelectedPrimaryDatabase()).toContain('TVDB')
        expect(await ConfigDialog.getSelectedPreferMediaLanguage()).toContain(newSettings.preferMediaLanguage)
        expect(await ConfigDialog.getTvdbHost()).toBe(newSettings.tvdbHost)
        expect(await ConfigDialog.getTvdbApiKey()).toBe(newSettings.tvdbApiKey)
        expect(await ConfigDialog.isMcpServerEnabled()).toBe(newSettings.enableMcpServer)
        expect(await ConfigDialog.getMcpHost()).toBe(newSettings.mcpHost)
        expect(await ConfigDialog.getMcpPort()).toBe(newSettings.mcpPort)
    })
})
