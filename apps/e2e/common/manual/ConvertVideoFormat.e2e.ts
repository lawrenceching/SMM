import * as cp from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { browser, expect } from '@wdio/globals'
import { createFolderInTestFolder } from 'test/actions/import-folders'
import Menu from 'test/componentobjects/Menu'
import Sidebar from 'test/componentobjects/Sidebar'
import { cleanup, setup } from 'test/lib/testbed'
import { skipIfOhos, testbedOs } from 'test/lib/e2e-platform'

const testMp4Path = path.join(import.meta.dirname, '../../../../test/local/test.mp4')

async function waitForFirstTrackRow() {
    await browser.waitUntil(
        async () => {
            const rows = await $$('div[role="table"] > div[role="row"]')
            return rows.length >= 2
        },
        {
            timeout: 30_000,
            interval: 500,
            timeoutMsg: 'Music file table never showed a data row',
        },
    )
}

/**
 * Remove numbered conversion outputs (e.g. test (1).webm) left from prior runs.
 */
function removeConvertedOutputFiles(dir: string) {
    if (!fs.existsSync(dir)) return
    for (const name of fs.readdirSync(dir)) {
        if (/^test\s*\(\d+\)\.[a-z0-9]+$/i.test(name)) {
            try {
                fs.unlinkSync(path.join(dir, name))
                console.log(`[CLEANUP] Removed converted output: ${path.join(dir, name)}`)
            } catch (err) {
                console.warn(`[CLEANUP] Failed to remove converted output ${name}: ${err}`)
            }
        }
    }
}

/**
 * Helper: right-click on the first data row in the music file table.
 * Index 0 is the header row; index 1 is the first track.
 */
async function rightClickFirstTrackRow() {
    await browser.waitUntil(
        async () => {
            try {
                const rows = await $$('div[role="table"] > div[role="row"]')
                const dataRow = rows[1]
                if (!dataRow) return false
                await dataRow.scrollIntoView()
                await dataRow.waitForDisplayed({ timeout: 2000 })
                await dataRow.click({ button: 'right' })
                return true
            } catch {
                return false
            }
        },
        {
            timeout: 10_000,
            interval: 500,
            timeoutMsg: 'No data row found in music file table',
        },
    )
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
  describe.skip('ConvertVideoFormat - ffmpeg not available in this environment', () => {
    it('skipped', () => {})
  })
} else {

/**
 * Format conversion via music track context menu (ffmpeg background job).
 *
 * HarmonyOS: requires host-side ffmpeg and host test media fixtures (`skipIfOhos`).
 *
 * @supports local, Electron
 * @unsupported HarmonyOS
 */
describe('ConvertVideoFormat', () => {
    before(function () {
        skipIfOhos(this)
    })

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
            os: testbedOs,
        })
    })

    afterEach(async () => {
        if (folderPath) {
            removeConvertedOutputFiles(folderPath)
        }

        // Dismiss any open dialog by pressing Escape, so the sidebar is accessible
        await browser.keys(['\uE00C']) // Escape
        await browser.pause(500)

        if (folderPath) {
            removeConvertedOutputFiles(folderPath)
        }

        await cleanup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: true,
            clearLocalStorage: true,
            os: testbedOs,
        })
    })

    it('Convert video format via track context menu', async function () {
        this.timeout(60_000)

        // ── 1. Create a Music-type folder with test.mp4 ────────────────────────
        const folderName = `TestConvertFormat-${Date.now()}`
        const folder = createFolderInTestFolder({
            folderName,
            type: 'music',
            files: ['test.mp4'],
        })
        folderPath = folder.path
        removeConvertedOutputFiles(folderPath)

        // Copy the real test.mp4 file (the helper creates an empty file)
        const testMp4Dest = path.join(folderPath, 'test.mp4')
        fs.copyFileSync(testMp4Path, testMp4Dest)

        // ── 2. Import the folder via the app's custom event ────────────────────
        await Menu.importMediaFolder({
            type: 'music',
            folderPathInPlatformFormat: folder.path!,
            traceId: 'e2eTest:ConvertVideoFormat',
        })

        // ── 3. Wait for the folder in the sidebar and click it ────────────────
        await Sidebar.waitForFolderName(folderName)
        await Sidebar.clickFolder(folderName)

        await waitForFirstTrackRow()
        await browser.pause(2000)

        // ── 4. Right-click the track → Format conversion (opens converter directly) ─
        await rightClickFirstTrackRow()
        await clickContextMenuItem(['Format conversion', '格式转换'])

        // ── 5. Verify Format Converter dialog ─────────────────────────────────
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
        expect(dirValue).toContain(folderName)

        // Verify output file name is pre-filled with "(1).mp4"
        const fileNameInput = await formatDialog.$('#format-converter-filename')
        const fileNameValue = await fileNameInput.getValue()
        expect(fileNameValue).toMatch(/test\s*\(1\)\.mp4/)

        // ── 6. Change output format to WebM ───────────────────────────────────
        // "WebM" matches "WebM (VP9)" in any locale
        await selectDropdownValue('format-converter-format', 'WebM')

        // Verify the file extension updated to .webm
        const updatedFileName = await fileNameInput.getValue()
        expect(updatedFileName).toMatch(/test\s*\(1\)\.webm/)

        // ── 7. Change preset to "Speed" / "速度优先" ──────────────────────────
        await selectDropdownValue('format-converter-preset', 'Speed', '速度')

        const updatedPresetText = await presetTrigger.getText()
        expect(updatedPresetText).toMatch(/Speed|速度/i)

        // ── 8. Start conversion ───────────────────────────────────────────────
        const startBtn = await formatDialog.$('[data-testid="format-converter-start"]')
        await startBtn.waitForClickable({ timeout: 5000 })
        await startBtn.click()

        // ── 9. Verify the conversion was initiated ───────────────────────────
        // On success the dialog closes immediately after createJob. Poll via DOM
        // script to avoid stale WebDriver element references when the dialog unmounts.
        await browser.waitUntil(
            async () => {
                const state = await browser.execute(() => {
                    const dialog = document.querySelector('[data-testid="format-converter-dialog"]')
                    if (!dialog) {
                        return { closed: true, loading: false, error: null as string | null }
                    }

                    const errorEl = dialog.querySelector('[data-testid="format-converter-error"]')
                    const errorText = errorEl?.textContent?.trim() ?? null
                    if (errorText) {
                        return { closed: false, loading: false, error: errorText }
                    }

                    const btn = dialog.querySelector(
                        '[data-testid="format-converter-start"]',
                    ) as HTMLButtonElement | null
                    const style = window.getComputedStyle(dialog)
                    const visible =
                        style.display !== 'none' &&
                        style.visibility !== 'hidden' &&
                        dialog.getAttribute('data-state') !== 'closed'

                    if (!visible) {
                        return { closed: true, loading: false, error: null }
                    }

                    return { closed: false, loading: btn?.disabled ?? false, error: null }
                })

                if (state.error) {
                    throw new Error(`Format conversion failed: ${state.error}`)
                }

                return state.closed || state.loading
            },
            {
                timeout: 10_000,
                interval: 200,
                timeoutMsg: 'Format converter dialog did not close or enter loading state after start',
            },
        )
        console.log('[DIAG] Conversion initiated successfully')

        // Discard the converted file reference since we didn't wait for completion
        // The afterEach hook will clean up any leftover files
    })
})
}
