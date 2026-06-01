import * as fs from 'node:fs'
import * as path from 'node:path'
import { browser, expect } from '@wdio/globals'
import { createFolderInTestFolder } from 'test/actions/import-folders'
import Sidebar from 'test/componentobjects/Sidebar'
import StatusBar from 'test/componentobjects/StatusBar'
import { cleanup, setup } from 'test/lib/testbed'

const testMp4Path = path.join(import.meta.dirname, '../../../../../test/local/test.mp4')

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
            await item.waitForClickable({ timeout: 3000 })
            await item.click()
            return
        }
    }

    throw new Error(`Context menu item [${labels.join(', ')}] not found`)
}

/**
 * Helper: select a value in a Radix UI Select component by clicking its trigger
 * and then clicking the matching option. Accepts multiple possible text labels
 * to handle different UI locales.
 */
async function selectDropdownValue(triggerId: string, ...textVariants: string[]) {
    const trigger = await $(`#${triggerId}`)
    await trigger.waitForClickable({ timeout: 5000 })
    await trigger.click()

    // Wait for the portal content to animate in (Radix uses animation)
    await browser.pause(500)

    // Radix Select portals its content into <body>. Items have role="option".
    for (const text of textVariants) {
        const item = await $(`[role="option"]*=${text}`)
        if (await item.isDisplayed().catch(() => false)) {
            await item.waitForClickable({ timeout: 5000 })
            await item.click()
            await browser.pause(200)
            return
        }
    }

    throw new Error(`None of the select options [${textVariants.join(', ')}] are visible`)
}

/**
 * Helper: find the first visible and clickable button from a list of possible
 * label texts within a parent element (or globally).  This handles i18n variants
 * (English / Chinese).
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

describe('ConvertVideoFormat', () => {
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
        // Clean up any leftover converted file
        if (folderPath) {
            const outputFile = path.join(folderPath, 'test (1).webm')
            try {
                if (fs.existsSync(outputFile)) {
                    fs.unlinkSync(outputFile)
                    console.log(`[CLEANUP] Removed output file: ${outputFile}`)
                }
            } catch (err) {
                console.warn(`[CLEANUP] Failed to remove output file: ${err}`)
            }
        }

        // Dismiss any open dialog by pressing Escape, so the sidebar is accessible
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

    it('Convert video format via File Properties dialog', async function () {
        this.timeout(60_000)

        // ── 1. Create a Music-type folder with test.mp4 ────────────────────────
        const folder = createFolderInTestFolder({
            folderName: 'TestConvertFormat',
            type: 'music',
            files: ['test.mp4'],
        })
        folderPath = folder.path

        // Copy the real test.mp4 file (the helper creates an empty file)
        const testMp4Dest = path.join(folderPath, 'test.mp4')
        fs.copyFileSync(testMp4Path, testMp4Dest)

        // ── 2. Import the folder via the app's custom event ────────────────────
        await browser.executeScript(
            `document.dispatchEvent(new CustomEvent('ui.mediaFolderImported', { detail: arguments[0] }))`,
            [{ type: 'music', folderPathInPlatformFormat: folder.path, traceId: 'e2eTest:ConvertVideoFormat' }],
        )

        // ── 3. Wait for the folder in the sidebar and click it ────────────────
        await Sidebar.waitForFolderName('TestConvertFormat')
        await Sidebar.clickFolder('TestConvertFormat')

        // Give the MusicPanel time to initialise and read file tags
        await browser.pause(5000)

        // ── 4. Right-click the track and open Properties ──────────────────────
        await rightClickFirstTrackRow()
        await clickContextMenuItem(['Properties', '属性'])

        // Verify the file-property dialog is displayed
        const filePropDialog = $('[data-testid="media-file-property-dialog"]')
        await filePropDialog.waitForDisplayed({ timeout: 5000 })

        // Verify the dialog shows expected file info
        const dialogTitleEl = filePropDialog.$('[data-slot="dialog-title"]')
        await dialogTitleEl.waitForDisplayed({ timeout: 5000 })

        // ── 5. Click "Convert format" button to open Format Converter ────────
        // Find the visible clickable button (supports English and Chinese labels)
        const convertBtn = await findVisibleButton(filePropDialog, ['Convert format', '格式转换'])
        await convertBtn.click()

        // File property dialog should close; Format Converter dialog should appear
        await browser.pause(500)

        // ── 6. Verify Format Converter dialog ─────────────────────────────────
        const formatDialog = $('[data-testid="format-converter-dialog"]')
        await formatDialog.waitForDisplayed({ timeout: 5000 })

        // Verify default state: source video label shows the file name
        await expect(formatDialog).toHaveText(expect.stringContaining('test.mp4'))

        // Verify output format defaults to "MP4 (H.264)" / "MP4 (H.264)"
        const formatTrigger = await formatDialog.$('#format-converter-format')
        const formatTriggerText = await formatTrigger.getText()
        // Locale agnostic: English "MP4 (H.264)" or Chinese "MP4 (H.264)"
        expect(formatTriggerText).toMatch(/MP4.*H\.?264/i)

        // Verify preset defaults to "Balanced" or "平衡"
        const presetTrigger = await formatDialog.$('#format-converter-preset')
        const presetTriggerText = await presetTrigger.getText()
        expect(presetTriggerText).toMatch(/Balanced|平衡/i)

        // Verify save-to directory is pre-filled with source directory
        const dirInput = await formatDialog.$('#format-converter-dir')
        const dirValue = await dirInput.getValue()
        expect(dirValue).toBeTruthy()
        // The path should point to the test media folder
        expect(dirValue).toContain('TestConvertFormat')

        // Verify output file name is pre-filled with "(1).mp4"
        const fileNameInput = await formatDialog.$('#format-converter-filename')
        const fileNameValue = await fileNameInput.getValue()
        expect(fileNameValue).toMatch(/test\s*\(1\)\.mp4/)

        // ── 7. Change output format to WebM ───────────────────────────────────
        // "WebM" matches "WebM (VP9)" in any locale
        await selectDropdownValue('format-converter-format', 'WebM')

        // Verify the file extension updated to .webm
        const updatedFileName = await fileNameInput.getValue()
        expect(updatedFileName).toMatch(/test\s*\(1\)\.webm/)

        // ── 8. Change preset to "Speed" / "速度优先" ──────────────────────────
        await selectDropdownValue('format-converter-preset', 'Speed', '速度')

        const updatedPresetText = await presetTrigger.getText()
        expect(updatedPresetText).toMatch(/Speed|速度/i)

        // ── 9. Start conversion ───────────────────────────────────────────────
        const startBtn = await findVisibleButton(formatDialog, ['Start conversion', '开始转换'])
        await startBtn.click()

        // ── 10. Verify the conversion was initiated ───────────────────────────
        // The start button should become disabled (loading state) after clicking
        await browser.waitUntil(
            async () => {
                const btn = await findVisibleButton(formatDialog, ['Start conversion', '开始转换'])
                    .catch(() => null)
                // Button is either disabled (loading) or dialog has closed (conversion success)
                return btn === null || !(await btn.isEnabled().catch(() => false))
            },
            {
                timeout: 10_000,
                interval: 500,
                timeoutMsg: 'Start conversion button did not enter loading state',
            },
        )
        console.log('[DIAG] Conversion initiated successfully')

        // ── 11. Close the dialog (conversion runs in background) ──────────────
        await browser.keys(['\uE00C']) // Escape to close dialog
        await browser.pause(500)

        // Discard the converted file reference since we didn't wait for completion
        // The afterEach hook will clean up any leftover files
    })
})
