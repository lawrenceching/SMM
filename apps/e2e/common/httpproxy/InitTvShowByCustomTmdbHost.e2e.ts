import { expect, browser } from '@wdio/globals'
import {
    setup,
    cleanup,
    isReverseProxyAccessible,
    expectMediaMetadataViaBrowser,
} from 'test/lib/testbed'
import {
    clearFolderViaBrowser,
    resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'
import { delay } from 'es-toolkit'
import { when, then, resetStepContext, getStepContext } from 'test/lib/gherkin'
import 'test/steps'
import type { MediaMetadata, UserConfig } from '@smm/core/types'
import type { TestFolder } from 'test/actions/import-folders'
import TvShowPanel from 'test/componentobjects/TVShowPanel.co'
import { env } from 'node:process'
import { randomUUID } from 'node:crypto'

import { testbedOs } from 'test/lib/e2e-platform'

const CUSTOM_TMDB_HOST = 'https://1255396852-23teay8jtp.ap-hongkong.tencentscf.com'

/**
 * @supports local, Electron, HarmonyOS, Docker
 */
describe('Init TV Show via Custom TMDB Host', () => {
    let testFolder = ''

    before(async () => {
        const proxyAccessible = await isReverseProxyAccessible()
        if (!proxyAccessible) {
            throw new Error('Reverse proxy is not accessible — CLI proxy may have failed to start')
        }
    })

    beforeEach(async () => {
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            openBrowserPage: true,
            resetUserConfig: (config: UserConfig) => {
                config.tmdb = {
                    host: CUSTOM_TMDB_HOST,
                }
                config.preferMediaLanguage = 'en-US'
                return config
            },
            os: testbedOs,
        })
        resetStepContext()

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

    it('Scenario: TV show folder initialized via custom TMDB host', async function () {
        if (env.slowdown) {
            this.timeout(60 * 1000)
        }

        // Wait for config to load before importing folder,
        // otherwise recognition may read stale default config.
        await browser.pause(5000)

        const { folder1 } = await import('test/actions/import-folders')
        // Random folder name (not the show title) so a stuck sidebar title
        // means recognition failed; a Chinese show title means language wrong.
        const opaqueFolderName = `e2e-tmdb-${randomUUID()} {tmdbid=84666}`
        await when('Import media folder', {
            ...folder1,
            folderName: opaqueFolderName,
        } satisfies TestFolder)

        if (env.slowdown) {
            await delay(5 * 1000)
        }

        const expectedTitle = 'WATATEN!: an Angel Flew Down to Me'
        const folder = getStepContext()._folder as { path: string }

        await then(`Sidebar shows folder with title "${expectedTitle}"`)

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
            await expectMediaMetadataViaBrowser(folder.path, (m: unknown) => {
                expect((m as MediaMetadata).tvShow).toEqual({
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
})
