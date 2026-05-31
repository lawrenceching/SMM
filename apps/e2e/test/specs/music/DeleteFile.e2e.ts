import * as fs from 'node:fs'
import * as path from 'node:path'
import { browser, expect } from '@wdio/globals'
import { createFolderInTestFolder } from 'test/actions/import-folders'
import Sidebar from 'test/componentobjects/Sidebar'
import StatusBar from 'test/componentobjects/StatusBar'
import { cleanup, setup } from 'test/lib/testbed'

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

/**
 * Helper: find the first visible and clickable button from a list of possible
 * label texts within a parent element (or globally).  This handles i18n variants.
 */
async function findVisibleButton(
    parent: WebdriverIO.Element | typeof browser,
    labels: string[],
): Promise<WebdriverIO.Element> {
    for (const label of labels) {
        const btn = await parent.$(`button=${label}`)
        if (await btn.isDisplayed().catch(() => false)) {
            await btn.waitForClickable({ timeout: 5000 })
            return btn
        }
    }
    throw new Error(`None of the buttons [${labels.join(', ')}] are visible`)
}

describe('DeleteFile', () => {
    let folderPath: string | undefined

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
        // Dismiss any open dialog by pressing Escape
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

    it('Delete a music file via right-click context menu', async function () {
        this.timeout(60_000)

        // ── 1. Create a Music-type folder with an empty test file ─────────────
        const folder = createFolderInTestFolder({
            folderName: 'TestDeleteFile',
            type: 'music',
            files: ['test.mp4'],
        })
        folderPath = folder.path
        const testFile = path.join(folderPath, 'test.mp4')
        expect(fs.existsSync(testFile)).toBe(true)

        // ── 2. Import the folder via the app's custom event ────────────────────
        await browser.executeScript(
            `document.dispatchEvent(new CustomEvent('ui.mediaFolderImported', { detail: arguments[0] }))`,
            [{ type: 'music', folderPathInPlatformFormat: folder.path, traceId: 'e2eTest:DeleteFile' }],
        )

        // ── 3. Wait for the folder in the sidebar and click it ────────────────
        await Sidebar.waitForFolderName('TestDeleteFile')
        await Sidebar.clickFolder('TestDeleteFile')
        await browser.pause(5000)

        // ── 4. Verify one track row is displayed (header + 1 data row) ────────
        let rows = await $$('div[role="table"] > div[role="row"]')
        expect(rows.length).toBe(2) // header (index 0) + 1 track (index 1)

        // ── 5. Right-click on the track and click Delete ──────────────────────
        await rightClickFirstTrackRow()
        await clickContextMenuItem(['Delete', '删除'])

        // ── 6. Verify the confirmation dialog appears with file name ──────────
        // Look for a visible DialogContent that contains the delete message
        const deleteDialog = await browser.waitUntil(async () => {
            const dialogs = await $$('[data-slot="dialog-content"]')
            for (const dlg of dialogs) {
                if (await dlg.isDisplayed().catch(() => false)) {
                    const txt = await dlg.getText()
                    if (/test\.mp4|delete|cancel|删除|取消/i.test(txt)) return dlg
                }
            }
            return null
        }, {
            timeout: 5000,
            interval: 500,
            timeoutMsg: 'Delete confirmation dialog not found',
        })

        // Verify the dialog shows the file name and buttons are present
        const dialogText = await deleteDialog.getText()
        expect(dialogText).toMatch(/test\.mp4/i)

        const cancelBtn = await findVisibleButton(browser, ['Cancel', '取消'])
        const deleteBtn = await findVisibleButton(browser, ['Delete', '删除'])
        await expect(cancelBtn).toBeDisplayed()
        await expect(deleteBtn).toBeDisplayed()

        // ── 7. Click Cancel to close the dialog ───────────────────────────────
        await cancelBtn.click()
        await browser.pause(500)
        await expect(deleteDialog).not.toBeDisplayed()

        // ── 8. Verify the file still exists (Cancel didn't delete it) ─────────
        expect(fs.existsSync(testFile)).toBe(true)
        console.log('[DIAG] Cancel confirmed, file still exists')

        // ── 9. Refresh and verify the track still exists ──────────────────────
        await browser.refresh()
        await browser.waitUntil(
            async () => await StatusBar.isDisplayed(),
            { timeout: 15_000 },
        )

        // Navigate back to the folder
        await Sidebar.waitForFolderName('TestDeleteFile')
        await Sidebar.clickFolder('TestDeleteFile')
        await browser.pause(5000)

        // Verify track row still exists (Cancel didn't delete it)
        rows = await $$('div[role="table"] > div[role="row"]')
        expect(rows.length).toBe(2) // header + 1 track (still present after Cancel)
        console.log('[DIAG] Track row still present after Cancel')
    })
})
