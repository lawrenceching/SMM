import * as fs from 'node:fs'
import * as path from 'node:path'
import { browser, expect } from '@wdio/globals'
import { createFolderInTestFolder } from 'test/actions/import-folders'
import Sidebar from 'test/componentobjects/Sidebar'
import StatusBar from 'test/componentobjects/StatusBar'
import { cleanup, setup } from 'test/lib/testbed'

const testMp4Path = path.join(import.meta.dirname, '../../../../../test/local/test.mp4')

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
            // Allow the associated files section to render
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
    // Index 0 = header row, index 1 = first data row
    const dataRow = rows[1]
    if (!dataRow) {
        throw new Error('No data row found in music file table')
    }
    await dataRow.scrollIntoView()
    await dataRow.waitForDisplayed({ timeout: 5000 })
    await dataRow.click({ button: 'right' })
}

/**
 * Helper: click a context menu item by its visible label text.
 * Supports multiple label variants (e.g. English and Chinese).
 */
async function clickContextMenuItem(labels: string[]) {
    await browser.waitUntil(
        async () => {
            for (const label of labels) {
                const item = await $(`[role="menuitem"]=${label}`)
                if (await item.isDisplayed().catch(() => false)) return true
            }
            return false
        },
        {
            timeout: 5000,
            interval: 200,
            timeoutMsg: `Context menu item [${labels.join(', ')}] did not appear`,
        },
    )

    for (const label of labels) {
        const item = await $(`[role="menuitem"]=${label}`)
        if (await item.isDisplayed().catch(() => false)) {
            await item.waitForClickable({ timeout: 5000 })
            await item.click()
            return
        }
    }

    throw new Error(`Context menu item [${labels.join(', ')}] not found`)
}

describe('Subtitle', () => {
    beforeEach(async () => {
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            openBrowserPage: true,
            resetUserConfig: true,
            clearLocalStorage: true,
        })
    })

    afterEach(async () => {
        // Dismiss any open menu/dialog by pressing Escape
        await browser.keys(['\uE00C']) // Escape
        await browser.pause(500)

        await cleanup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: true,
            clearLocalStorage: true,
        })
    })

    it('Verify subtitle associated file display and context menu structure', async function () {
        this.timeout(60_000)

        // ── 1. Create a Music-type folder with test.mp4 and test.srt ───────────
        const folder = createFolderInTestFolder({
            folderName: 'TestSubtitle',
            type: 'music',
            files: ['test.mp4', 'test.srt'],
        })

        // Copy the real test.mp4 file (the helper creates an empty file)
        const testMp4Dest = path.join(folder.path!, 'test.mp4')
        fs.copyFileSync(testMp4Path, testMp4Dest)

        // ── 2. Import the folder via the app's custom event ────────────────────
        await browser.executeScript(
            `document.dispatchEvent(new CustomEvent('ui.mediaFolderImported', { detail: arguments[0] }))`,
            [{ type: 'music', folderPathInPlatformFormat: folder.path, traceId: 'e2eTest:Subtitle' }],
        )

        // ── 3. Wait for the folder in the sidebar and click it ────────────────
        await Sidebar.waitForFolderName('TestSubtitle')
        await Sidebar.clickFolder('TestSubtitle')

        // Give the MusicPanel time to initialise and read file tags
        await browser.pause(5000)

        // ── 4. Expand the first track row to show associated subtitle file ────
        await expandFirstTrackRow()

        // ── 5. Verify the subtitle associated file is visible ─────────────────
        const rows = await $$('div[role="table"] > div[role="row"]')
        // Index 0 = header, 1 = track data, 2 = associated subtitle file
        const subtitleRow = rows[2]
        if (!subtitleRow) {
            throw new Error('No subtitle associated file row found')
        }
        await subtitleRow.scrollIntoView()
        await subtitleRow.waitForDisplayed({ timeout: 5000 })

        // Verify the subtitle row shows the .srt filename
        const subtitleRowText = await subtitleRow.getText()
        expect(subtitleRowText).toMatch(/test\.srt/i)

        // ── 6. Right-click on the track row and verify the context menu ──────
        await rightClickFirstTrackRow()

        // Wait for the context menu to appear
        const contextMenu = await $('[role="menu"]')
        await contextMenu.waitForDisplayed({ timeout: 5000 })

        // Verify the context menu contains "Subtitle" / "字幕" submenu trigger
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

        // Close the context menu by pressing Escape
        await browser.keys(['\uE00C']) // Escape
        await browser.pause(500)

        // ── 7. Verify the context menu is no longer displayed ─────────────────
        await expect(contextMenu).not.toBeDisplayed()
    })
})
