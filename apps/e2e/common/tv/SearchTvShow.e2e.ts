import { expect, browser } from '@wdio/globals'
import {
    setup,
    cleanup,
    expectMediaMetadataViaBrowser,
} from 'test/lib/testbed'
import {
    clearFolderViaBrowser,
    resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'
import { TvShowPanelCO } from 'test/componentobjects/TVShowPanel.co'
import { given, when, then, resetStepContext, getStepContext } from 'test/lib/gherkin'
import 'test/steps'
import env from 'test/lib/env'
import type { MediaMetadata, UserConfig } from '@smm/types'

import { testbedOs } from 'test/lib/e2e-platform'

const OSHI_NO_KO_TMDB_EPISODE_TABLE = `特别篇
S00E01 - - - -
S00E02 - - - -
第 1 季
S01E01 - - - -
S01E02 - - - -
S01E03 - - - -
S01E04 - - - -
S01E05 - - - -
S01E06 - - - -
S01E07 - - - -
S01E08 - - - -
S01E09 - - - -
S01E10 - - - -
S01E11 - - - -
S01E12 - - - -
S01E13 - - - -
S01E14 - - - -
S01E15 - - - -
S01E16 - - - -
S01E17 - - - -
S01E18 - - - -
S01E19 - - - -
S01E20 - - - -
S01E21 - - - -
S01E22 - - - -
S01E23 - - - -
S01E24 - - - -
S01E25 - - - -
S01E26 - - - -
S01E27 - - - -
S01E28 - - - -
S01E29 - - - -
S01E30 - - - -
S01E31 - - - -
S01E32 - - - -
S01E33 - - - -
S01E34 - - - -
S01E35 - - - -`

/** TVDB lists 5 aired-order seasons (S0–S4); empty season names render as "Season N" in zh-CN UI. */
function buildEpisodeTableExpectation(
    seasons: ReadonlyArray<{ season: number; episodes: number }>,
): string {
    const lines: string[] = []
    for (const { season, episodes } of seasons) {
        lines.push(`Season ${season}`)
        for (let episode = 1; episode <= episodes; episode += 1) {
            lines.push(
                `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')} - - - -`,
            )
        }
    }
    return lines.join('\n')
}

const OSHI_NO_KO_TVDB_EPISODE_TABLE = buildEpisodeTableExpectation([
    { season: 0, episodes: 2 },
    { season: 1, episodes: 11 },
    { season: 2, episodes: 13 },
    { season: 3, episodes: 11 },
    { season: 4, episodes: 1 },
])

/**
 * @supports local, Electron, HarmonyOS, Docker
 */
describe('Search TV Show', () => {
    let testFolder = ''

    beforeEach(async () => {
        resetStepContext()
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            resetUserConfig: (config: UserConfig) => {
                config.preferMediaLanguage = 'zh-CN'
                config.applicationLanguage = 'zh-CN'
                return config
            },
            openBrowserPage: true,
            clearLocalStorage: true,
            os: testbedOs,
        })

        const { default: Page } = await import('test/pageobjects/page')
        await Page.refresh()

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
            clearLocalStorage: true,
            os: testbedOs,
        })
        if (testFolder) {
            await clearFolderViaBrowser(testFolder)
        }
    })

    it('Search TV Show - TMDB', async function () {
        this.timeout(5 * 60 * 1000)

        /**
         * Anime 我推的孩子 have 4 seasons in TVDB
         * while 2 seasons in TMDB
         * So it's a good example to verify SMM search TMDB database
         */
        await given('unknown TV show folder was imported')

        await then('searchbox input is empty')
        await when('searchbox input is focused')
        await browser.pause(300)
        await when('I select "TMDB" as the search database')
        await when('I select "zh-CN" as the search language')
        await when('I click the search button in the searchbox')
        await when('I search for "我推的孩子"')
        await when('I select search result with title "【我推的孩子】" and date "April 12, 2023"')

        // After select: UI clears the panel, then POST /api/get-tvshow-in-tmdb (~20–30s in e2e)
        // plus sequential season fetches. Wait for panel state (not full getHTML — slow on macOS).
        await then('episode table shows Oshi no Ko TMDB seasons', async () => {
            await browser.waitUntil(async () => {
                const stateInString = await TvShowPanelCO.toString()
                console.log(`${new Date().toISOString()} stateInString="${stateInString}"`)
                return stateInString.includes(OSHI_NO_KO_TMDB_EPISODE_TABLE)
            }, {
                timeout: 3 * 60 * 1000,
                interval: 2000,
                timeoutMsg: 'Expected to see Season 0 in the TV show panel within 3 minutes after TMDB select',
            })
        })

        await then('metadata is persisted with TMDB Oshi no Ko', async () => {
            const folder = getStepContext()._folder as { path: string }
            await expectMediaMetadataViaBrowser(folder.path, (obj) => {
                const mm = obj as MediaMetadata
                expect(mm.tvShow?.id).toBe('203737')
                expect(mm.tvShow?.name).toBe('【我推的孩子】')
                expect(mm.tvShow?.database).toBe('TMDB')
                return true
            })
        })

        if (env.slowdown) {
            await browser.pause(10 * 1000)
        }
    })

    it('Search TV Show - TVDB', async function () {
        this.timeout(5 * 60 * 1000)

        /**
         * Anime 我推的孩子 have 4 seasons in TVDB
         * while 2 seasons in TMDB
         * So it's a good example to verify SMM search TVDB database
         */
        await given('unknown TV show folder was imported')

        await then('searchbox input is empty')
        await when('searchbox input is focused')
        await browser.pause(300)
        await when('I select "TVDB" as the search database')
        await when('I select "zho" as the search language')
        await when('I click the search button in the searchbox')
        await when('I search for "我推的孩子"')
        await when('I select search result with title "【我推的孩子】"')

        await then('episode table shows Oshi no Ko TVDB seasons', async () => {
            await browser.waitUntil(async () => {
                const stateInString = await TvShowPanelCO.toString()
                console.log(`${new Date().toISOString()} stateInString="${stateInString}"`)
                return stateInString.includes(OSHI_NO_KO_TVDB_EPISODE_TABLE)
            }, {
                timeout: 3 * 60 * 1000,
                interval: 2000,
                timeoutMsg: 'Expected to see TVDB Season 4 in the TV show panel within 3 minutes after TVDB select',
            })
        })

        await then('metadata is persisted with TVDB Oshi no Ko', async () => {
            const folder = getStepContext()._folder as { path: string }
            await expectMediaMetadataViaBrowser(folder.path, (obj) => {
                const mm = obj as MediaMetadata
                expect(mm.tvShow?.id).toBe('421069')
                expect(mm.tvShow?.name).toBe('【我推的孩子】')
                expect(mm.tvShow?.database).toBe('TVDB')
                expect(mm.tvShow?.seasons?.length).toBe(5)
                return true
            })
        })

        if (env.slowdown) {
            await browser.pause(10 * 1000)
        }
    })
})
