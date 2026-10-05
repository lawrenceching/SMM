import { expect, browser } from '@wdio/globals'
import Menu from 'test/componentobjects/Menu'
import ConfigDialog from 'test/componentobjects/ConfigDialog'
import StatusBar from 'test/componentobjects/StatusBar'
import Page from 'test/pageobjects/page'
import { setup, cleanup } from 'test/lib/testbed'
import { testbedOs } from 'test/lib/e2e-platform'

function normalizePath(p: string): string {
    return p.replace(/\\/g, '/')
}

/**
 * External Applications settings: project `bin/` 3pp paths and versions.
 *
 * @supports web
 */
describe('Settings - External Applications (3pp discovery)', () => {
    before(async () => {
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: (config) => {
                // Force app auto-discovery (placeholder + version), not a saved custom path.
                delete config.ytdlpExecutablePath
                delete config.ffmpegExecutablePath
                delete config.quickjsExecutablePath
            },
            openBrowserPage: true,
            os: testbedOs,
        })
    })

    after(async () => {
        await cleanup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: true,
            os: testbedOs,
        })
    })

    it('shows discovered paths and versions for yt-dlp, ffmpeg, and QuickJS', async () => {
        await Page.refresh()
        await browser.waitUntil(async () => StatusBar.isDisplayed(), {
            timeout: 10000,
            timeoutMsg: 'Status bar was not displayed after page reload',
        })

        await Menu.openConfigDialog()
        await ConfigDialog.waitForDisplayed()
        await ConfigDialog.switchToTab('external-apps')
        await ConfigDialog.waitForExternalAppsDiscovery()

        const ytdlpPath = normalizePath(await ConfigDialog.getYtdlpResolvedPath())
        const ffmpegPath = normalizePath(await ConfigDialog.getFfmpegResolvedPath())
        const quickjsPath = normalizePath(await ConfigDialog.getQuickjsResolvedPath())

        expect(ytdlpPath).toMatch(/\/bin\/yt-dlp\/yt-dlp(\.exe)?$/i)
        expect(ffmpegPath).toMatch(/\/bin\/ffmpeg\/ffmpeg(\.exe)?$/i)
        expect(quickjsPath).toMatch(/\/bin\/quickjs\/qjs(\.exe)?$/i)

        expect(await ConfigDialog.getYtdlpVersionText()).toMatch(/^Version:\s+\S+/)
        expect(await ConfigDialog.getFfmpegVersionText()).toMatch(/^Version:\s+\S+/)
        expect(await ConfigDialog.getQuickjsVersionText()).toMatch(/^Version:\s+\S+/)
    })
})
