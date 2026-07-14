import { expect, browser } from '@wdio/globals'
import { setup, cleanup } from '../../lib/testbed'
import { given, when, then, resetStepContext } from '../../lib/gherkin'
import '../../steps'
import { TvShowPanelCO } from '../../componentobjects/TVShowPanel.co'
import { logTvShowHeaderLayoutDiagnostics } from '../../lib/tvShowHeaderLayoutDiagnostics'
import { folder1 } from 'test/actions/import-folders'

const RENAMED_EPISODE_TABLE = `Specials
S00E01 - - - -
Season 1
S01E01 Season 01/WATATEN!: an Angel Flew Down to Me - S01E01 - A Funny, Squirmy Feeling.mkv V V V
S01E02 Season 01/WATATEN!: an Angel Flew Down to Me - S01E02 - Incontestably Cute.mkv V V V
S01E03 Season 01/WATATEN!: an Angel Flew Down to Me - S01E03 - Imprinting.mkv V V V
S01E04 - - - -
S01E05 - - - -
S01E06 - - - -
S01E07 - - - -
S01E08 - - - -
S01E09 - - - -
S01E10 - - - -
S01E11 - - - -
S01E12 - - - -`

describe('TVShow - Rename By Plan', () => {

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

    it('Rename by AI and then rename by rule', async function () {
        this.timeout(90 * 1000)

        await given('TV show folder with three episodes was imported and recognized')
        await when(`folder "${folder1.folderName}" was selected`)
        await logTvShowHeaderLayoutDiagnostics(
            'RenameByPlan: before rename-button click',
        )
        await when('I click "Rename" button')
        await then('"Rename" prompt is open')
        await when('I click "Confirm" on rename prompt')
        await then('episode table shows renamed Plex-style paths', async () => {
            await browser.waitUntil(
                async () =>
                    (await TvShowPanelCO.toString()).includes(
                        'Season 01/WATATEN!: an Angel Flew Down to Me - S01E01 - A Funny, Squirmy Feeling.mkv',
                    ),
                { timeout: 15000, interval: 500 },
            )
            expect(await TvShowPanelCO.toString()).toContain(RENAMED_EPISODE_TABLE)
        })
    })

})
