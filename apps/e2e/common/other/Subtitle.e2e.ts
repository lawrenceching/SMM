import { browser, expect } from '@wdio/globals'
import Sidebar from 'test/componentobjects/Sidebar'
import { cleanup, setup } from 'test/lib/testbed'
import { testbedOs } from 'test/lib/e2e-platform'
import {
    clearFolderViaBrowser,
    createAndImportFolderViaBrowser,
    resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'

/**
 * Helper: click the expand toggle button on the first data row.
 * The expand button is the last cell's <button> with aria-label "Expand" / "展开".
 */
async function expandFirstTrackRow() {
    for (const label of ['Expand', '展开']) {
        const btn = await $(`button[aria-label="${label}"]`)
        if (await btn.isDisplayed().catch(() => false)) {
            await btn.waitForClickable({ timeout: 5000 })
            await btn.click()
            await browser.pause(1000)
            return
        }
    }
    throw new Error('Expand button not found (tried: Expand, 展开)')
}

/**
 * Helper: right-click on the first data row in the music file table.
 * The MusicFileTable uses a CSS grid with role="table" and role="row".
 * The first row (index 0) is the header, so we skip to index 1.
 */
async function rightClickFirstTrackRow() {
    const rows = await $$('div[role="table"] > div[role="row"]')
    const dataRow = rows[1]
    if (!dataRow) {
        throw new Error('No data row found in music file table')
    }
    await dataRow.scrollIntoView()
    await dataRow.waitForDisplayed({ timeout: 5000 })
    await dataRow.click({ button: 'right' })
}

describe('Subtitle', () => {
    let testFolder = ''

    beforeEach(async () => {
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            openBrowserPage: true,
            resetUserConfig: true,
            clearLocalStorage: true,
            os: testbedOs,
        })

        testFolder = await resolveSmmTestFolderViaBrowser()
        await clearFolderViaBrowser(testFolder)
    })

    afterEach(async () => {
        await browser.keys(['\uE00C']) // Escape
        await browser.pause(500)

        await cleanup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: true,
            clearLocalStorage: true,
            os: testbedOs,
        })
        if (testFolder) {
            await clearFolderViaBrowser(testFolder)
        }
    })

    it('Verify subtitle associated file display and context menu structure', async function () {
        this.timeout(60_000)

        // Empty fixture files are enough to assert associated-file UI (same as DeleteFile).
        await createAndImportFolderViaBrowser(
            {
                folderName: 'TestSubtitle',
                type: 'music',
                files: ['test.mp4', 'test.srt'],
            },
            'e2eTest:Subtitle',
            testFolder,
        )

        await Sidebar.waitForFolderName('TestSubtitle')
        await Sidebar.clickFolder('TestSubtitle')

        await browser.pause(5000)

        await expandFirstTrackRow()

        const rows = await $$('div[role="table"] > div[role="row"]')
        const subtitleRow = rows[2]
        if (!subtitleRow) {
            throw new Error('No subtitle associated file row found')
        }
        await subtitleRow.scrollIntoView()
        await subtitleRow.waitForDisplayed({ timeout: 5000 })

        const subtitleRowText = await subtitleRow.getText()
        expect(subtitleRowText).toMatch(/test\.srt/i)

        await rightClickFirstTrackRow()

        const contextMenu = await $('[role="menu"]')
        await contextMenu.waitForDisplayed({ timeout: 5000 })

        await browser.waitUntil(
            async () => {
                for (const label of ['Subtitle', '字幕']) {
                    const item = await $(`[role="menuitem"]=${label}`)
                    if (await item.isDisplayed().catch(() => false)) return true
                }
                return false
            },
            {
                timeout: 5000,
                interval: 200,
                timeoutMsg: 'Subtitle menu item [Subtitle, 字幕] did not appear',
            },
        )

        await browser.keys(['\uE00C']) // Escape
        await browser.pause(500)

        await expect(contextMenu).not.toBeDisplayed()
    })
})
