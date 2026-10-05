import { expect, browser } from '@wdio/globals'
import { setup, cleanup } from 'test/lib/testbed'
import {
    clearFolderViaBrowser,
    joinPlatformPath,
    resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'
import { TvShowPanelCO } from 'test/componentobjects/TVShowPanel.co'
import Sidebar from 'test/componentobjects/Sidebar'
import StatusBar from 'test/componentobjects/StatusBar'
import { then, resetStepContext } from 'test/lib/gherkin'
import 'test/steps'
import { folder1 } from 'test/actions/import-folders'
import { testbedOs } from 'test/lib/e2e-platform'

/** Expected panel after folder1 ({tmdbid=84666}) init — matches InitializeTvShowByTmdb. */
const EXPECTED_EPISODE_TABLE = `Specials
S00E01 - - - -
Season 1
S01E01 S01E01.mkv V V V
S01E02 S01E02.mkv V V V
S01E03 S01E03.mkv V V V
S01E04 - - - -
S01E05 - - - -
S01E06 - - - -
S01E07 - - - -
S01E08 - - - -
S01E09 - - - -
S01E10 - - - -
S01E11 - - - -
S01E12 - - - -`

/**
 * Import a TV show folder (common spec: browser / Electron / HarmonyOS).
 * folder1 embeds {tmdbid=84666}; recognition should populate TvShowPanel episodes.
 *
 * testFolder: `{tmpDir}/smm-test-folder` from {@link resolveSmmTestFolderViaBrowser}
 * (app temp sandbox on Ohos — not Download/).
 * @supports local, Electron, HarmonyOS, Docker
 */
describe('TVShow - Import', () => {
    let testFolder = ''

    beforeEach(async () => {
        resetStepContext()
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: true,
            openBrowserPage: true,
            os: testbedOs,
        })

        testFolder = await resolveSmmTestFolderViaBrowser()
    })

    afterEach(async () => {
        await cleanup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: true,
            os: testbedOs,
        })
        if (testFolder) {
            await clearFolderViaBrowser(testFolder)
        }
    })

    it('Import and initialize TV show folder by TMDB ID in folder name', async function () {
        this.timeout(6 * 60 * 1000)

        const folder = {
            ...folder1,
        }

        const folderPathInOhos = joinPlatformPath(testFolder, folder.folderName)

        await then('Create folder in HarmonyOS', {
            base: testFolder,
            folder: folder,
        })

        await then(`Import folder "${folderPathInOhos}" in HarmonyOS`)

        await then('folder name is displayed in sidebar', async () => {
            await Sidebar.waitForFolderName(folder.folderName, 60000)
        })

        await then('TvShowPanel shows recognized S01E01..03 episode rows', async () => {
            await TvShowPanelCO.waitFor(
                (state) => state.includes('S01E01 S01E01.mkv V V V'),
                120000,
                500,
            )
            expect(await TvShowPanelCO.toString()).toBe(EXPECTED_EPISODE_TABLE)
        })

        await then('BackgroundJobsPopover ImportFolderJob log shows import stages', async () => {
            await StatusBar.ensureBackgroundJobsPopoverOpen()
            const jobId = await StatusBar.findBackgroundJobIdContaining(folder.folderName)
            expect(jobId).not.toBeNull()

            await browser.waitUntil(
                async () => {
                    const badge = (await StatusBar.backgroundJobStatusBadge(jobId!).getText())
                        .trim()
                        .toLowerCase()
                    return badge === 'succeeded' || badge.includes('succeeded') || badge.includes('成功')
                },
                {
                    timeout: 30000,
                    interval: 500,
                    timeoutMsg: 'ImportFolderJob did not reach succeeded in the background jobs popover',
                },
            )

            await StatusBar.openBackgroundJobLog(jobId!)
            // Wait until AbstractJob lifecycle footer is present (import finished).
            const logText = await StatusBar.waitForLogDialogContaining(`${jobId} completed`)

            // LogDialog body must equal the ImportFolderJob log line-for-line.
            // Do not weaken to toContain / partial matches, and do not drop lines
            // to make a later change easier. Update the expected string only when
            // production log wording changes on purpose.
            const expected = [
                `${jobId} started`,
                `Started to import folder: ${folderPathInOhos}, type: tvshow`,
                `Recognize ${folderPathInOhos}: WATATEN!: an Angel Flew Down to Me (tmdbId:84666)`,
                'Recognize 3 episode files',
                `${jobId} completed`,
            ].join('\n')
            expect(logText.replace(/\r\n/g, '\n')).toBe(expected)
        })
    })
})
