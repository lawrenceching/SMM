import { expect, browser } from '@wdio/globals'
import { setup, cleanup, expectMediaMetadataToBe } from '../../lib/testbed'
import TvShowPanel from '../../componentobjects/TVShowPanel.co'
import { delay } from 'es-toolkit'
import { given, when, then, resetStepContext, getStepContext } from '../../lib/gherkin'
import '../../steps'
import type { MediaMetadata } from '@smm/core/types'
import { env } from 'node:process'

describe('Media Folder Initialization - TV Show - TMDB', () => {

    beforeEach(async () => {
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            openBrowserPage: true,
            resetUserConfig: true,
        })

        const { openConfigDialog } = await import('../../actions/openConfigDialog')
        const { setPrimaryDatabaseAndPreferLanguage } = await import('../../actions/setPrimaryDatabaseAndPreferLanguage')
        await openConfigDialog(async () => {
            await setPrimaryDatabaseAndPreferLanguage('TMDB', 'en-US')
        })

        resetStepContext()
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

    it('TMDB ID in Folder Name', async function () {
        if (env.slowdown) {
            this.timeout(60 * 1000)
        }

        await given('TV show folder "天使降临到我身边！" was initialized by folder name')

        if (env.slowdown) {
            await delay(5 * 1000)
        }

        const expectedTitle = 'WATATEN!: an Angel Flew Down to Me'
        const folder = getStepContext()._folder as { path: string }

        await then('sidebar shows TV show title', async () => {
            const { default: Sidebar } = await import('../../componentobjects/Sidebar')
            await Sidebar.waitForFolderTitle(expectedTitle, 60000)
        })

        await then('TV show panel shows the expected title and episode table', async () => {
            await TvShowPanel.waitForTitleToBe(expectedTitle)

            expect(await TvShowPanel.toString()).toBe(`Specials
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
	S01E12 - - - -`)
        })

        await then('metadata is persisted with TMDB tvshow id 84666', async () => {
            await expectMediaMetadataToBe(folder.path, (m: MediaMetadata) => {
                expect(m.tvShow).toEqual({
                    airDate: '2019-01-08',
                    database: 'TMDB',
                    id: '84666',
                    name: 'WATATEN!: an Angel Flew Down to Me',
                    seasons: [
                        {
                            episodes: [{ episode: 1, name: 'You Never Let Us Down / Always Growing Closer / Let\'s Change You Into This! / I\'m Your Big Sister', season: 0 }],
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
                })
                return true
            })
        })

        if (env.slowdown) {
            await delay(10 * 1000)
        }
    })

    it('Searching Folder Name', async function () {
        if (env.slowdown) {
            this.timeout(60 * 1000)
        }

        const { folder1 } = await import('../../actions/import-folders')
        await given(`TV show folder "${folder1.folderName}" was initialized by folder name`)

        if (env.slowdown) {
            await delay(5 * 1000)
        }

        const expectedTitle = 'WATATEN!: an Angel Flew Down to Me'
        const folder = getStepContext()._folder as { path: string }

        await then('sidebar shows TV show title', async () => {
            const { default: Sidebar } = await import('../../componentobjects/Sidebar')
            await Sidebar.waitForFolderTitle(expectedTitle, 60000)
        })

        await then('TV show panel shows the expected title and episode table', async () => {
            await TvShowPanel.waitForTitleToBe(expectedTitle)

            expect(await TvShowPanel.toString()).toBe(`Specials
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
	S01E12 - - - -`)
        })

        await then('metadata is persisted with TMDB tvshow id 84666', async () => {
            await expectMediaMetadataToBe(folder.path, (m: MediaMetadata) => {
                expect(m.tvShow).toEqual({
                    airDate: '2019-01-08',
                    database: 'TMDB',
                    id: '84666',
                    name: 'WATATEN!: an Angel Flew Down to Me',
                    seasons: [
                        {
                            episodes: [{ episode: 1, name: 'You Never Let Us Down / Always Growing Closer / Let\'s Change You Into This! / I\'m Your Big Sister', season: 0 }],
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
                })
                return true
            })
        })

        if (env.slowdown) {
            await delay(10 * 1000)
        }
    })

    it('NFO', async function () {
        if (env.slowdown) {
            this.timeout(60 * 1000)
        }

        await given('TV show folder "WhateverItIsToEnsureCannotRecognizeByFolderName" was initialized with TMDB NFO')

        if (env.slowdown) {
            await delay(5 * 1000)
        }

        const expectedTitle = 'WATATEN!: an Angel Flew Down to Me'
        const folder = getStepContext()._folder as { path: string }

        await then('sidebar shows TV show title', async () => {
            const { default: Sidebar } = await import('../../componentobjects/Sidebar')
            await Sidebar.waitForFolderTitle(expectedTitle, 60000)
        })

        await then('TV show panel shows the expected title and episode table with nfo prefix', async () => {
            await TvShowPanel.waitForTitleToBe(expectedTitle)
            await browser.pause(5000)

            expect(await TvShowPanel.toString()).toBe(`nfo
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
	S01E12 - - - -`)
        })

        await then('metadata is persisted with TMDB tvshow id 84666', async () => {
            await expectMediaMetadataToBe(folder.path, (m: MediaMetadata) => {
                expect(m.tvShow).toEqual({
                    airDate: '2019-01-08',
                    database: 'TMDB',
                    id: '84666',
                    name: 'WATATEN!: an Angel Flew Down to Me',
                    seasons: [
                        {
                            episodes: [{ episode: 1, name: 'You Never Let Us Down / Always Growing Closer / Let\'s Change You Into This! / I\'m Your Big Sister', season: 0 }],
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
                })
                return true
            })
        })

        if (env.slowdown) {
            await delay(10 * 1000)
        }
    })

    it('Unknown', async function () {
        this.timeout(15 * 1000)

        await given('TV show folder was initialized as unknown')

        await browser.pause(5000)

        await then('immersive input is empty', async () => {
            const immersiveInput = await $('[data-testid="immersive-input"]')
            await immersiveInput.waitForDisplayed({ timeout: 5000 })
            const value = await immersiveInput.getValue()
            expect(value).toBe('')
        })
    })
})
