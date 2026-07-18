import { browser } from '@wdio/globals'
import { setup, cleanup } from 'test/lib/testbed'
import { given, resetStepContext } from 'test/lib/gherkin'
import 'test/steps'

/**
 * Smoke check that cucumber import steps work when WDIO attaches to HarmonyOS Electron.
 * Not a full functional TV-show import assertion — only exercises the statement and holds.
 */
describe('TVShow - Import (HarmonyOS)', () => {
    beforeEach(async () => {
        resetStepContext()
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: true,
            openBrowserPage: true,
        })
    })

    afterEach(async () => {
        await cleanup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: true,
        })
    })

    it('Import TV show folder and initialize as unknown TV show folder', async function () {
        this.timeout(6 * 60 * 1000)

        await given('unknown TV show folder was imported')

        console.log(`${new Date().toISOString()} PAUSED 5 minutes (ohos cucumber import smoke)`)
        await browser.pause(5 * 60 * 1000)
        console.log(`${new Date().toISOString()} RESUMED`)
    })
})
