import { expect, browser } from '@wdio/globals'
import { setup, cleanup } from 'test/lib/testbed'
import {
    clearFolderViaBrowser,
    listFileNamesViaBrowser,
    resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'
import { given, when, then, resetStepContext, getStepContext } from 'test/lib/gherkin'
import 'test/steps'
import env from 'test/lib/env'

import { testbedOs } from 'test/lib/e2e-platform'

const FOLDER_NAME = '天使降临到我身边！ (2019) {tmdbid=84666}'
const EPISODE_FILE_NAME = 'S01E01.mp4'
const RENAMED_FILE_NAME = 'S01E01_renamed.mp4'
const ASSOCIATED_FILES = ['S01E01.srt', 'S01E01.en.srt', 'S01E01.ass'] as const
const RENAMED_ASSOCIATED_FILES = ['S01E01_renamed.srt', 'S01E01_renamed.en.srt', 'S01E01_renamed.ass'] as const

function waitForFilesInFolder(
    folderPath: string,
    options: {
        mustInclude: string[]
        mustExclude: string[]
        timeout?: number
    },
): Promise<void> {
    const { mustInclude, mustExclude, timeout = 30_000 } = options
    return browser.waitUntil(
        async () => {
            const names = await listFileNamesViaBrowser(folderPath)
            return (
                mustInclude.every((name) => names.includes(name)) &&
                mustExclude.every((name) => !names.includes(name))
            )
        },
        {
            timeout,
            interval: 500,
            timeoutMsg:
                `Rename did not update files in ${folderPath}. ` +
                `Expected: ${mustInclude.join(', ')}; removed: ${mustExclude.join(', ')}`,
        },
    )
}

/**
 * @supports local, Electron, HarmonyOS, Docker
 */
describe('TVShow - Rename Episode File', () => {
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
        await clearFolderViaBrowser(testFolder)
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

    it('renames the video file and its associated files via context menu', async function () {
        this.timeout(90 * 1000)

        await given(`TV show folder "${FOLDER_NAME}" with files "${EPISODE_FILE_NAME},${ASSOCIATED_FILES.join(',')}" was imported via menu`)
        await when('TV show panel is ready with TMDB data')
        await when('I click "Rename" from episode "S01E01" context menu')
        await then(`rename dialog is displayed with value "${EPISODE_FILE_NAME}"`)
        await then('rename dialog confirm button is disabled')
        await when(`I enter "${RENAMED_FILE_NAME}" in rename dialog`)
        await then('rename dialog confirm button is enabled')
        await when('I confirm rename dialog')

        await then('video and associated files are renamed on disk', async () => {
            const folder = getStepContext()._folder as { path: string }
            await waitForFilesInFolder(folder.path, {
                mustInclude: [RENAMED_FILE_NAME, ...RENAMED_ASSOCIATED_FILES],
                mustExclude: [EPISODE_FILE_NAME, ...ASSOCIATED_FILES],
            })

            const filesInMediaFolder = await listFileNamesViaBrowser(folder.path)
            expect(filesInMediaFolder).toContain(RENAMED_FILE_NAME)
            expect(filesInMediaFolder).not.toContain(EPISODE_FILE_NAME)

            for (let i = 0; i < ASSOCIATED_FILES.length; i++) {
                expect(filesInMediaFolder).toContain(RENAMED_ASSOCIATED_FILES[i]!)
                expect(filesInMediaFolder).not.toContain(ASSOCIATED_FILES[i]!)
            }
        })

        if (env.slowdown) {
            await browser.pause(10 * 1000)
        }
    })
})
