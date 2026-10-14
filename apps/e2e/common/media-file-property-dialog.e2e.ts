import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { browser, expect } from '@wdio/globals'
import Menu from 'test/componentobjects/Menu'
import Sidebar from 'test/componentobjects/Sidebar'
import StatusBar from 'test/componentobjects/StatusBar'
import { cleanup, setup } from 'test/lib/testbed'
import {
    createTestFolderViaBrowser,
    getFileSizeViaBrowser,
    joinPlatformPath,
    resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'
import { isDockerE2e, skipIfOhos, testbedOs } from 'test/lib/e2e-platform'

const EXAMPLE_MP4_NAME = 'file_example_MP4_480_1_5MG.mp4'
const EXAMPLE_MP4_HOST_PATH = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../test/examples',
    EXAMPLE_MP4_NAME,
)

const DOCKER_CONTAINER_NAME = 'smm'

function dockerCpHostFileToContainer(hostFile: string, containerDestPath: string): void {
    const result = spawnSync(
        'docker',
        ['cp', hostFile, `${DOCKER_CONTAINER_NAME}:${containerDestPath}`],
        { encoding: 'utf-8', shell: false },
    )
    if (result.status !== 0) {
        const detail = (result.stderr || result.stdout || '').trim()
        throw new Error(
            `docker cp failed (${hostFile} -> ${containerDestPath}): ${detail || `exit ${result.status}`}`,
        )
    }
}

async function waitForFirstTrackRow() {
    await browser.waitUntil(
        async () => {
            const rows = await $$('div[role="table"] > div[role="row"]')
            return (await rows.length) >= 2
        },
        {
            timeout: 30_000,
            interval: 500,
            timeoutMsg: 'Music file table never showed a data row',
        },
    )
}

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
 * True when `serverPath` is also writable from the WDIO host process
 * (local `smm web` / Electron). Docker / remote Linux paths are not.
 */
function canWriteServerPathViaHostFs(serverPath: string): boolean {
    if (/^[A-Za-z]:[\\/]/.test(serverPath)) {
        return true
    }
    if (serverPath.startsWith('/') && fs.existsSync(path.dirname(serverPath))) {
        return true
    }
    return false
}

/**
 * Place the example MP4 at the server-visible path created via browser APIs.
 * Prefer host `fs` when the CLI shares the runner filesystem; otherwise `docker cp`.
 */
function placeExampleMp4OnServer(destOnServer: string): void {
    if (isDockerE2e || !canWriteServerPathViaHostFs(destOnServer)) {
        dockerCpHostFileToContainer(EXAMPLE_MP4_HOST_PATH, destOnServer)
        return
    }
    fs.mkdirSync(path.dirname(destOnServer), { recursive: true })
    fs.copyFileSync(EXAMPLE_MP4_HOST_PATH, destOnServer)
}

/**
 * Prepare a temporary media folder containing the example MP4, then import it.
 *
 * Always create under the CLI's `{tmpDir}/smm-test-folder` via browser APIs so
 * paths match the process that serves `/api/*` (critical for `e2e:web`).
 *
 * SMM has no standalone "video" folder type — loose video files are imported as
 * `music` (same pattern as MediaFileProperties / ConvertVideoFormat).
 */
async function prepareAndImportExampleVideoFolder(traceId: string): Promise<{
    folderName: string
    folderPath: string
    videoFileName: string
}> {
    if (!fs.existsSync(EXAMPLE_MP4_HOST_PATH)) {
        throw new Error(`Missing example video fixture: ${EXAMPLE_MP4_HOST_PATH}`)
    }

    const folderName = `MediaFilePropertyDialog-${Date.now()}`
    const folderDef = {
        folderName,
        type: 'music' as const,
        files: [EXAMPLE_MP4_NAME],
    }

    const root = await resolveSmmTestFolderViaBrowser()
    const folderPath = await createTestFolderViaBrowser(root, folderDef)
    const destFile = joinPlatformPath(folderPath, EXAMPLE_MP4_NAME)

    placeExampleMp4OnServer(destFile)

    const size = fs.existsSync(destFile)
        ? fs.statSync(destFile).size
        : await getFileSizeViaBrowser(destFile)
    expect(size).toBeGreaterThan(100_000)

    await Menu.importMediaFolder({
        type: 'music',
        folderPathInPlatformFormat: folderPath,
        traceId,
    })

    return { folderName, folderPath, videoFileName: EXAMPLE_MP4_NAME }
}

const EDITED_TAGS = {
    title: 'E2E Property Title',
    artist: 'E2E Property Artist',
    comment: 'E2E Property Comment',
    date: '2026',
} as const

async function openPropertiesDialog() {
    await rightClickFirstTrackRow()
    await clickContextMenuItem(['Properties', '属性'])
    const dialog = $('[data-testid="media-file-property-dialog"]')
    await dialog.waitForDisplayed({ timeout: 10_000 })
    return dialog
}

async function waitForPreviewScreenshots(dialog: ReturnType<typeof $>) {
    await browser.waitUntil(
        async () => {
            const imgs = await dialog.$$('[data-testid="proxied-preview-image"]')
            if ((await imgs.length) === 0) return false
            for (const img of imgs) {
                const src = await img.getAttribute('src')
                if (src && src.startsWith('data:image')) return true
            }
            return false
        },
        {
            timeout: 120_000,
            interval: 1_000,
            timeoutMsg:
                'Video screenshot previews never loaded (proxied-preview-image data URL). ' +
                'Check ffmpeg screenshot generation and that /api/image requests succeed with auth (not 401).',
        },
    )
    const previewImages = await dialog.$$('[data-testid="proxied-preview-image"]')
    expect(await previewImages.length).toBeGreaterThanOrEqual(1)
}

async function waitForEditableTagsReady(dialog: ReturnType<typeof $>) {
    const titleInput = dialog.$('[data-testid="media-file-property-title"]')
    // Loading spinner replaces the form; wait until ffprobe round-trip finished.
    await titleInput.waitForDisplayed({ timeout: 30_000 })
    return titleInput
}

/**
 * Fixture must not already contain our unique edit values — otherwise reopen
 * asserts would pass without proving write+read.
 */
async function assertTagsDoNotMatchEdited(dialog: ReturnType<typeof $>) {
    await waitForEditableTagsReady(dialog)
    for (const [testId, unexpected] of [
        ['media-file-property-title', EDITED_TAGS.title],
        ['media-file-property-artist', EDITED_TAGS.artist],
        ['media-file-property-comment', EDITED_TAGS.comment],
        ['media-file-property-date', EDITED_TAGS.date],
    ] as const) {
        const input = dialog.$(`[data-testid="${testId}"]`)
        await expect(input).not.toHaveValue(unexpected)
    }
    // comment/date are not shown on the music track row — empty proves we are
    // reading file tags (or blank), not leftover React state from a prior edit.
    await expect(dialog.$('[data-testid="media-file-property-comment"]')).toHaveValue('')
    await expect(dialog.$('[data-testid="media-file-property-date"]')).toHaveValue('')
}

async function fillEditableTags(dialog: ReturnType<typeof $>) {
    await waitForEditableTagsReady(dialog)
    const fields: Array<{ testId: string; value: string }> = [
        { testId: 'media-file-property-title', value: EDITED_TAGS.title },
        { testId: 'media-file-property-artist', value: EDITED_TAGS.artist },
        { testId: 'media-file-property-comment', value: EDITED_TAGS.comment },
        { testId: 'media-file-property-date', value: EDITED_TAGS.date },
    ]
    for (const { testId, value } of fields) {
        const input = dialog.$(`[data-testid="${testId}"]`)
        await input.waitForDisplayed({ timeout: 5_000 })
        await input.click()
        await input.clearValue()
        await input.setValue(value)
        await expect(input).toHaveValue(value)
    }
}

async function waitForWriteTagsJobSucceeded(videoFileName: string) {
    await StatusBar.ensureBackgroundJobsPopoverOpen()
    // Displayed name is i18n'd ("Write tags: …" / "写入标签: …"); file name is stable.
    const jobId = await browser.waitUntil(
        async () => StatusBar.findBackgroundJobIdContaining(videoFileName),
        {
            timeout: 15_000,
            interval: 500,
            timeoutMsg: `Write Tags background job not found for ${videoFileName}`,
        },
    )

    await browser.waitUntil(
        async () => {
            const badge = (await StatusBar.backgroundJobStatusBadge(jobId).getText())
                .trim()
                .toLowerCase()
            if (badge.includes('fail') || badge.includes('失败') || badge.includes('失敗')) {
                throw new Error(`Write Tags job failed (badge=${badge})`)
            }
            return (
                badge === 'succeeded' ||
                badge.includes('succeeded') ||
                badge.includes('成功')
            )
        },
        {
            timeout: 90_000,
            interval: 500,
            timeoutMsg: 'Write Tags job did not reach succeeded',
        },
    )
}

async function assertEditableTags(dialog: ReturnType<typeof $>, expected: typeof EDITED_TAGS) {
    const titleInput = await waitForEditableTagsReady(dialog)
    // Must observe a load cycle: values start cleared on open, then ffprobe fills them.
    // comment/date are file-tag-only (not music-row fields), so they can't pass via track fallback alone.
    await browser.waitUntil(
        async () => (await titleInput.getValue()) === expected.title,
        {
            timeout: 15_000,
            interval: 500,
            timeoutMsg: `Expected title "${expected.title}", got "${await titleInput.getValue()}"`,
        },
    )
    await expect(dialog.$('[data-testid="media-file-property-artist"]')).toHaveValue(
        expected.artist,
    )
    await expect(dialog.$('[data-testid="media-file-property-comment"]')).toHaveValue(
        expected.comment,
    )
    await expect(dialog.$('[data-testid="media-file-property-date"]')).toHaveValue(expected.date)
}

/**
 * Open media-file-property-dialog for an example MP4: preview, edit tags via UI,
 * wait for write-tags job, reopen and assert tags persisted.
 *
 * @supports local, Electron, Docker
 * @unsupported HarmonyOS
 */
describe('media-file-property-dialog', () => {
    before(function () {
        skipIfOhos(this)
    })

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

    it('shows preview, edits tags via UI, and reloads saved tags', async function () {
        this.timeout(240_000)

        const { folderName, videoFileName } = await prepareAndImportExampleVideoFolder(
            'e2eTest:media-file-property-dialog',
        )

        await Sidebar.waitForFolderName(folderName)
        await Sidebar.clickFolder(folderName)
        await waitForFirstTrackRow()

        // ── Open dialog: title / filename / preview ─────────────────────────
        const dialog = await openPropertiesDialog()

        const dialogTitle = dialog.$('[data-slot="dialog-title"]')
        await dialogTitle.waitForDisplayed({ timeout: 5_000 })
        await expect(dialogTitle).toHaveText(
            expect.stringMatching(/Properties|文件属性|文件屬性/i),
        )

        const dialogDescription = dialog.$('[data-slot="dialog-description"]')
        await dialogDescription.waitForDisplayed({ timeout: 5_000 })
        await expect(dialogDescription).toHaveText(expect.stringContaining(videoFileName))

        // Wait for screenshot ffmpeg to finish before writing tags (avoids EBUSY).
        await waitForPreviewScreenshots(dialog)

        // Prove fixture starts without our unique tags (guards false-green reopen).
        await assertTagsDoNotMatchEdited(dialog)

        // ── Edit metadata tags and save via background job ──────────────────
        await fillEditableTags(dialog)

        const saveBtn = dialog.$('[data-testid="media-file-property-save"]')
        await saveBtn.waitForClickable({ timeout: 5_000 })
        await saveBtn.click()

        await browser.waitUntil(async () => !(await dialog.isDisplayed().catch(() => false)), {
            timeout: 10_000,
            timeoutMsg: 'Property dialog did not close after save',
        })

        await waitForWriteTagsJobSucceeded(videoFileName)

        // Brief pause so Windows releases any leftover ffmpeg handles before
        // ffprobe re-reads the file on the next dialog open.
        await browser.pause(1_000)

        // ── Re-open and assert tags were written to the file ────────────────
        const dialogAgain = await openPropertiesDialog()
        await assertEditableTags(dialogAgain, EDITED_TAGS)

        await browser.keys(['\uE00C']) // Escape
        await browser.pause(500)
        await expect(dialogAgain).not.toBeDisplayed()
    })
})
