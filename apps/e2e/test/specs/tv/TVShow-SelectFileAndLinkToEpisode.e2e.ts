import * as path from 'node:path'
import { browser } from '@wdio/globals'
import { setup, cleanup, expectMediaMetadataToBe } from '../../lib/testbed'
import { given, when, then, resetStepContext, getStepContext } from '../../lib/gherkin'
import '../../steps'
import { TvShowPanelCO } from '../../componentobjects/TVShowPanel.co'

const FOLDER_NAME = '天使降临到我身边！ (2019) {tmdbid=84666}'
const DUMMY_FILE_NAME = 'DummyTest.mp4'

describe('TVShow - Select File and Link To Episode', () => {

    before(async () => {
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
            clearLocalStorage: true,
        })
    })

    beforeEach(() => {
        resetStepContext()
    })

    it('links DummyTest.mp4 to S01E01 via Select File context menu', async function () {
        this.timeout(60 * 1000)

        await given(`TV show folder "${FOLDER_NAME}" with files "S01E01.mp4,${DUMMY_FILE_NAME}" was imported via menu`)
        await when('TV show panel is ready with TMDB data')
        await when('mock file pick is set for dummy file', async () => {
            const folder = getStepContext()._folder as { path: string }
            const dummyFilePath = path.join(folder.path, DUMMY_FILE_NAME)
            await browser.execute((mockFilePath) => {
                (window as unknown as { localStorage: Storage }).localStorage.setItem('test.mockFilePick', mockFilePath)
            }, dummyFilePath)
        })
        await when('I click "Select File" from episode "S01E01" context menu')
        await then('episode table shows dummy file linked to S01E01', async () => {
            await TvShowPanelCO.waitFor((state) => state.includes(`S01E01 ${DUMMY_FILE_NAME}`))
        })
        await then('metadata cache reflects dummy file on S01E01', async () => {
            const folder = getStepContext()._folder as { path: string }
            await expectMediaMetadataToBe(folder.path, (metadata) => {
                const mediaFiles: Array<{ absolutePath: string; seasonNumber?: number; episodeNumber?: number }> = metadata.mediaFiles ?? []
                return mediaFiles.some(
                    (f) =>
                        f.seasonNumber === 1 &&
                        f.episodeNumber === 1 &&
                        path.basename(f.absolutePath) === DUMMY_FILE_NAME,
                )
            })
        })
    })

})
