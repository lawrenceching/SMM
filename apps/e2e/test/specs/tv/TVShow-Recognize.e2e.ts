import { expect, browser } from '@wdio/globals'
import { Path } from '@smm/core'
import { setup, cleanup, expectMediaMetadataToBe } from '../../lib/testbed'
import { TvShowPanelCO } from '../../componentobjects/TVShowPanel.co'
import { given, when, then, resetStepContext, getStepContext } from '../../lib/gherkin'
import '../../steps'

describe('TVShow - Rule Based Recognize', () => {

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
        })
    })

    beforeEach(() => {
        resetStepContext()
    })

    it('rule-based recognize: click recognize, confirm, then verify UI and on-disk metadata', async function () {
        this.timeout(60 * 1000)

        const folderName = 'UnKnown Folder 123123123123'

        await given('TV show folder "' + folderName + '" was imported with no media files')
        await when('folder "' + folderName + '" was selected')

        // Sanity: with mediaFiles=[] the table should show no recognized video files yet.
        await then('table shows no recognized episodes', async () => {
            expect(await TvShowPanelCO.toString()).toContain(`S01E01 - - - -`)
        })

        await when('I click "Recognize" button')
        await when('I click "Confirm" on recognize prompt')

        await then('episode table reflects recognized S01E01..03', async () => {
            await browser.waitUntil(
                async () => (await TvShowPanelCO.toString()).includes('S01E01 S01E01.mkv V V V'),
                { timeout: 15000, interval: 500 },
            )
            expect(await TvShowPanelCO.toString()).toContain(`S01E01 S01E01.mkv V V V
S01E02 S01E02.mkv V V V
S01E03 S01E03.mkv V V V`)
        })

        await then('metadata file is persisted on disk with S01E01..03 entries', async () => {
            const folder = getStepContext()._folder as { path: string }
            const folderPathPosix = Path.posix(folder.path)
            await expectMediaMetadataToBe(folder.path, (json) => {
                const mediaFiles = json?.mediaFiles
                if (!Array.isArray(mediaFiles) || mediaFiles.length !== 3) {
                    return false
                }
                const expected = [
                    { season: 1, episode: 1, file: 'S01E01.mkv' },
                    { season: 1, episode: 2, file: 'S01E02.mkv' },
                    { season: 1, episode: 3, file: 'S01E03.mkv' },
                ]
                return expected.every((e) =>
                    mediaFiles.some(
                        (mf: { seasonNumber?: number; episodeNumber?: number; absolutePath?: string }) =>
                            mf.seasonNumber === e.season &&
                            mf.episodeNumber === e.episode &&
                            typeof mf.absolutePath === 'string' &&
                            mf.absolutePath === `${folderPathPosix}/${e.file}`,
                    ),
                )
            })
        })
    })

    it('recognize confirm is disabled when all episodes already recognized (S5)', async function () {
        this.timeout(60 * 1000)

        const folderName = 'AlreadyRecognized 123123'

        await given('TV show folder "' + folderName + '" was recognized')
        await when('folder "' + folderName + '" was selected')

        await when('I click "Recognize" button')
        await then('"Recognize" confirm button is disabled')
    })

    it('shows the rule-based recognize limitation hint icon with tooltip when not all episodes are recognized', async function () {
        this.timeout(60 * 1000)

        await given('TV show folder "PartialRecognition 123123" was recognized with partial coverage')
        await when('folder "PartialRecognition 123123" was selected')
        await when('I click "Recognize" button')
        await then('"Recognize" prompt shows not all episodes message')
        await then('"Recognize" hint icon is visible')
        await when('I hover over "Recognize" hint icon')
        await then('"Recognize" hint tooltip is displayed with content')
    })

})