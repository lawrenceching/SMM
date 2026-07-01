import * as cp from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { execSync } from 'node:child_process'
import { browser, expect } from '@wdio/globals'
import { createFolderInTestFolder } from 'test/actions/import-folders'
import Menu from 'test/componentobjects/Menu'
import Sidebar from 'test/componentobjects/Sidebar'
import StatusBar from 'test/componentobjects/StatusBar'
import { cleanup, setup } from 'test/lib/testbed'

const testMp4Path = path.join(import.meta.dirname, '../../../../../test/local/test.mp4')

/** Path to the bundled ffmpeg executable used by SMM. */
const ffmpegBin = path.join(import.meta.dirname, '../../../../../bin/ffmpeg/ffmpeg.exe')

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

/** Try to detect whether ffmpeg is available on the system. */
function checkFfmpegAvailable(): boolean {
  try {
    cp.execSync('ffmpeg -version', { stdio: 'ignore', timeout: 5_000 })
    return true
  } catch {
    return false
  }
}

const isFfmpegAvailable = checkFfmpegAvailable()

if (!isFfmpegAvailable) {
  describe.skip('MediaFileProperties - ffmpeg not available in this environment', () => {
    it('skipped', () => {})
  })
} else {

describe('MediaFileProperties', () => {
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
        await cleanup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: true,
            clearLocalStorage: true,
        })
    })

    it('Edit video file tags and verify properties after refresh', async function () {
        this.timeout(120_000)

        // ── 1. Create a Music-type folder with test.mp4 ────────────────────────
        const folder = createFolderInTestFolder({
            folderName: 'TestVideoProperties',
            type: 'music',
            files: ['test.mp4'],
        })

        const testMp4Dest = path.join(folder.path!, 'test.mp4')

        // Copy the real test.mp4 file (the helper creates an empty file)
        fs.copyFileSync(testMp4Path, testMp4Dest)

        // ── 2. Import the folder via the app's custom event ────────────────────
        await Menu.importMediaFolder({
            type: 'music',
            folderPathInPlatformFormat: folder.path!,
            traceId: 'e2eTest:MediaFileProperties',
        })

        // ── 3. Wait for the folder in the sidebar and click it ────────────────
        await Sidebar.waitForFolderName('TestVideoProperties')
        await Sidebar.clickFolder('TestVideoProperties')

        // Give the MusicPanel time to initialise and read file tags
        await browser.pause(5000)

        // ── 4. Right-click the track and open Properties ──────────────────────
        await rightClickFirstTrackRow()
        await clickContextMenuItem(['Properties', '属性'])

        // Verify the media-file-property dialog is displayed
        const filePropDialog1 = $('[data-testid="media-file-property-dialog"]')
        await filePropDialog1.waitForDisplayed({ timeout: 5000 })

        // Close the dialog via Escape
        await browser.keys(['\uE00C']) // Escape
        await browser.pause(500)
        await expect(filePropDialog1).not.toBeDisplayed()

        // Give the screenshot-generation ffmpeg child processes time to fully
        // release file handles on Windows (EBUSY otherwise).
        await browser.pause(2000)

        // ── 5. Edit tags in the file directly via ffmpeg ─────────────────────
        // The SMM UI Edit Tags dialog uses writeMediaTags → executeCmdToCompletion
        // which hangs for this write-tags ffmpeg command.  As a workaround we
        // write metadata via a local ffmpeg process instead.
        {
            // ffmpeg needs a recognised extension to auto-detect the output format.
            // Using a plain suffix (e.g. .edited or .smm-temp) causes "Unable to
            // choose an output format".  We write to a temp file with the same
            // extension, then swap.
            const ext = path.extname(testMp4Dest) // .mp4
            const base = testMp4Dest.slice(0, -ext.length)
            const editedFile = base + '.edited' + ext
            const cmd = [
                `"${ffmpegBin}"`,
                `-i "${testMp4Dest}"`,
                '-c copy',
                '-metadata "title=My Test Title"',
                '-metadata "artist=My Test Artist"',
                `-y "${editedFile}"`,
            ].join(' ')
            console.log(`[DIAG] Running: ${cmd}`)
            execSync(cmd, { timeout: 30_000, encoding: 'utf-8' })
            console.log('[DIAG] ffmpeg write-tags succeeded')

            // Swap the files: delete original, move edited into place.
            // On Windows the screenshot ffmpeg processes may still hold a
            // handle on the source file for a short while — retry on EBUSY.
            const maxRetries = 10
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    fs.unlinkSync(testMp4Dest)
                    break
                } catch (err: any) {
                    if (attempt === maxRetries || err?.code !== 'EBUSY') throw err
                    console.log(`[DIAG] unlink EBUSY, retry ${attempt}/${maxRetries}...`)
                    await new Promise((r) => setTimeout(r, 500))
                }
            }
            fs.renameSync(editedFile, testMp4Dest)
            console.log('[DIAG] File swap complete')
        }

        await browser.pause(1000)

        // ── 6. Refresh the web page ───────────────────────────────────────────
        await browser.refresh()

        // Wait for the page to be fully loaded
        await browser.waitUntil(
            async () => await StatusBar.isDisplayed(),
            { timeout: 15_000 },
        )

        // Navigate back to the folder
        await Sidebar.waitForFolderName('TestVideoProperties')
        await Sidebar.clickFolder('TestVideoProperties')

        // Allow the MusicPanel to load and re-read file tags
        await browser.pause(5000)

        // ── 7. Right-click and open Properties again; assert the saved tags ───
        await rightClickFirstTrackRow()
        await clickContextMenuItem(['Properties', '属性'])

        const filePropDialog2 = $('[data-testid="media-file-property-dialog"]')
        await filePropDialog2.waitForDisplayed({ timeout: 5000 })

        // The dialog title shows "File Properties"
        const dialogTitleEl = filePropDialog2.$('[data-slot="dialog-title"]')
        await dialogTitleEl.waitForDisplayed({ timeout: 5000 })
        await expect(dialogTitleEl).toHaveText(expect.stringContaining('Properties'))

        // Check the title input field shows the saved title
        const titleInput = filePropDialog2.$('[data-testid="media-file-property-title"]')
        await titleInput.waitForDisplayed({ timeout: 5000 })
        const actualTitle = await titleInput.getValue()
        expect(actualTitle).toBe('My Test Title')

        // Check the artist input field shows the saved artist
        const artistInput = filePropDialog2.$('[data-testid="media-file-property-artist"]')
        const actualArtist = await artistInput.getValue()
        expect(actualArtist).toBe('My Test Artist')

        // ── 8. Close the Properties dialog so afterEach cleanup can access the sidebar
        await browser.keys(['\uE00C']) // Escape
        await browser.pause(500)
        await expect(filePropDialog2).not.toBeDisplayed()
    })
})
}
