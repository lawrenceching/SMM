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
import TvShowPanel from 'test/componentobjects/TVShowPanel.co'
import { delay } from 'es-toolkit'
import { given, then, resetStepContext, getStepContext } from 'test/lib/gherkin'
import 'test/steps'
import type { MediaMetadata } from '@smm/core/types'
import { env } from 'node:process'

import { testbedOs } from 'test/lib/e2e-platform'

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

const EXPECTED_EPISODE_TABLE_WITH_NFO = `nfo
Specials
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

const EXPECTED_TMDB_TVSHOW = {
    airDate: '2019-01-08',
    database: 'TMDB',
    id: '84666',
    name: 'WATATEN!: an Angel Flew Down to Me',
    seasons: [
        {
            episodes: [{
                episode: 1,
                name: 'You Never Let Us Down / Always Growing Closer / Let\'s Change You Into This! / I\'m Your Big Sister',
                season: 0,
            }],
            name: 'Specials',
            season: 0,
        },
        {
            episodes: [
                { episode: 1, name: 'A Funny, Squirmy Feeling', season: 1 },
                { episode: 2, name: 'Incontestably Cute', season: 1 },
                { episode: 3, name: 'Imprinting', season: 1 },
                { episode: 4, name: 'Can We Talk for a Moment?', season: 1 },
                { episode: 5, name: 'Don\'t Worry! Leave It to Me!', season: 1 },
                { episode: 6, name: 'Mya-nee Doesn\'t Have Any Friends', season: 1 },
                { episode: 7, name: 'I Don\'t Understand What Mya-nee Is Saying', season: 1 },
                { episode: 8, name: 'Sometimes Ignorance Is Bliss', season: 1 },
                { episode: 9, name: 'Please Stay Until I Fall Asleep', season: 1 },
                { episode: 10, name: 'I Said Too Much Again', season: 1 },
                { episode: 11, name: 'In Short, It\'s Your Fault, Onee-san', season: 1 },
                { episode: 12, name: 'Angel\'s Gaze', season: 1 },
            ],
            name: 'Season 1',
            season: 1,
        },
    ],
}

/**
 * @supports local, Electron, HarmonyOS
 */
describe('Initialize TV Show by TMDB', () => {
    let testFolder = ''

    beforeEach(async () => {
        resetStepContext()
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            openBrowserPage: true,
            resetUserConfig: (config) => {
                config.primaryDatabase = 'TMDB'
                config.preferMediaLanguage = 'en-US'
            },
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
            os: testbedOs,
        })
        if (testFolder) {
            await clearFolderViaBrowser(testFolder)
        }
    })

    it('TMDB ID in Folder Name', async function () {
        this.timeout(6 * 60 * 1000)

        await given('TV show folder "天使降临到我身边！" was initialized by folder name')

        if (env.slowdown) {
            await delay(5 * 1000)
        }

        const expectedTitle = 'WATATEN!: an Angel Flew Down to Me'
        const folder = getStepContext()._folder as { path: string }

        await then('sidebar shows TV show title', async () => {
            const { default: Sidebar } = await import('test/componentobjects/Sidebar')
            await Sidebar.waitForFolderTitle(expectedTitle, 3 * 60 * 1000)
        })

        await then('TV show panel shows the expected title and episode table', async () => {
            await TvShowPanel.waitForTitleToBe(expectedTitle)
            expect(await TvShowPanel.toString()).toBe(EXPECTED_EPISODE_TABLE)
        })

        await then('metadata is persisted with TMDB tvshow id 84666', async () => {
            await expectMediaMetadataViaBrowser(folder.path, (m: unknown) => {
                expect((m as MediaMetadata).tvShow).toEqual(EXPECTED_TMDB_TVSHOW)
                return true
            })
        })
    })

    it('Searching Folder Name', async function () {
        this.timeout(6 * 60 * 1000)

        const { folder1 } = await import('test/actions/import-folders')
        await given(`TV show folder "${folder1.folderName}" was initialized by folder name`)

        if (env.slowdown) {
            await delay(5 * 1000)
        }

        const expectedTitle = 'WATATEN!: an Angel Flew Down to Me'
        const folder = getStepContext()._folder as { path: string }

        await then('sidebar shows TV show title', async () => {
            const { default: Sidebar } = await import('test/componentobjects/Sidebar')
            await Sidebar.waitForFolderTitle(expectedTitle, 3 * 60 * 1000)
        })

        await then('TV show panel shows the expected title and episode table', async () => {
            await TvShowPanel.waitForTitleToBe(expectedTitle)
            expect(await TvShowPanel.toString()).toBe(EXPECTED_EPISODE_TABLE)
        })

        await then('metadata is persisted with TMDB tvshow id 84666', async () => {
            await expectMediaMetadataViaBrowser(folder.path, (m: unknown) => {
                expect((m as MediaMetadata).tvShow).toEqual(EXPECTED_TMDB_TVSHOW)
                return true
            })
        })
    })

    it('NFO', async function () {
        this.timeout(6 * 60 * 1000)

        await given('TV show folder "WhateverItIsToEnsureCannotRecognizeByFolderName" was initialized with TMDB NFO')

        if (env.slowdown) {
            await delay(5 * 1000)
        }

        const expectedTitle = 'WATATEN!: an Angel Flew Down to Me'
        const folder = getStepContext()._folder as { path: string }

        await then('sidebar shows TV show title', async () => {
            const { default: Sidebar } = await import('test/componentobjects/Sidebar')
            await Sidebar.waitForFolderTitle(expectedTitle, 3 * 60 * 1000)
        })

        await then('TV show panel shows the expected title and episode table with nfo prefix', async () => {
            await TvShowPanel.waitForTitleToBe(expectedTitle)
            await browser.pause(5000)
            expect(await TvShowPanel.toString()).toBe(EXPECTED_EPISODE_TABLE_WITH_NFO)
        })

        await then('metadata is persisted with TMDB tvshow id 84666', async () => {
            await expectMediaMetadataViaBrowser(folder.path, (m: unknown) => {
                expect((m as MediaMetadata).tvShow).toEqual(EXPECTED_TMDB_TVSHOW)
                return true
            })
        })
    })

    it('Unknown', async function () {
        // Ohos attach batches can leave import/init slower than a cold solo run.
        this.timeout(3 * 60 * 1000)

        await given('TV show folder was initialized as unknown')

        await then('immersive input is empty', async () => {
            const immersiveInput = await $('[data-testid="immersive-input"]')
            await immersiveInput.waitForDisplayed({ timeout: 3 * 60 * 1000 })
            const value = await immersiveInput.getValue()
            expect(value).toBe('')
        })
    })
})
