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
import { delay } from 'es-toolkit'
import { given, then, resetStepContext, getStepContext } from 'test/lib/gherkin'
import 'test/steps'
import type { MediaMetadata } from '@smm/core/types'
import env from 'test/lib/env'

import { testbedOs } from 'test/lib/e2e-platform'

/**
 * @supports local, Electron, HarmonyOS
 */
describe('Initialize TV Show by TVDB', () => {
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
                config.primaryDatabase = 'TVDB'
                config.preferMediaLanguage = 'zh-CN'
            },
            os: testbedOs,
        })

        const { default: Page } = await import('test/pageobjects/page')
        await Page.refresh()

        testFolder = await resolveSmmTestFolderViaBrowser()
        await clearFolderViaBrowser(testFolder)
    })

    afterEach(async function () {
        if (this.currentTest?.state === 'failed') {
            await browser.takeScreenshot()
        }

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

    it('Searching Folder Name', async function () {
        this.timeout(6 * 60 * 1000)

        await given('TV show folder "天使降临到我身边" was initialized by TVDB folder name')

        await then('TV show panel shows the TVDB title and episode table', async () => {
            // Ohos batch runs can need longer than a cold solo for TVDB search-by-name.
            await TvShowPanelCO.waitForTitleToBe('天使降临到了我身边！', 3 * 60 * 1000)
            await browser.pause(2000)

            const state = await TvShowPanelCO.toString()
            expect(state).toContain(`Season 0
S00E01 - - - -
S00E02 - - - -
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

        await then('metadata is persisted with TVDB tvshow id 355969', async () => {
            const folder = getStepContext()._folder as { path: string }
            await expectMediaMetadataViaBrowser(folder.path, (obj) => {
                const mm = obj as MediaMetadata
                expect(mm.tvShow).toBeDefined()
                expect(mm.tvShow?.id).toBe('355969')
                expect(mm.tvShow?.name).toBe('天使降临到了我身边！')
                expect(mm.tvShow?.database).toBe('TVDB')
                return true
            })
        })
    })

    it('TVDB ID in Folder Name', async function () {
        this.timeout(6 * 60 * 1000)

        await given('TV show folder was initialized by TVDB ID')

        await then('TV show panel shows Oshi no Ko title and TVDB season table', async () => {
            await TvShowPanelCO.waitForTitleToBe('【我推的孩子】', 3 * 60 * 1000)

            const state = await TvShowPanelCO.toString()
            expect(state).toContain(`Season 0
S00E01 - - - -
S00E02 - - - -
Season 1
S01E01 S01E01.mkv - - -
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
Season 2
S02E01 - - - -
S02E02 - - - -
S02E03 - - - -
S02E04 - - - -
S02E05 - - - -
S02E06 - - - -
S02E07 - - - -
S02E08 - - - -
S02E09 - - - -
S02E10 - - - -
S02E11 - - - -
S02E12 - - - -
S02E13 - - - -
Season 3
S03E01 - - - -
S03E02 - - - -
S03E03 - - - -
S03E04 - - - -
S03E05 - - - -
S03E06 - - - -
S03E07 - - - -
S03E08 - - - -
S03E09 - - - -
S03E10 - - - -
S03E11 - - - -
Season 4
S04E01 - - - -`)
        })

        await then('metadata is persisted with TVDB tvshow id 421069', async () => {
            const folder = getStepContext()._folder as { path: string }
            await expectMediaMetadataViaBrowser(folder.path, (obj) => {
                const mm = obj as MediaMetadata
                expect(mm.tvShow).toBeDefined()
                expect(mm.tvShow?.id).toBe('421069')
                expect(mm.tvShow?.name).toBe('【我推的孩子】')
                expect(mm.tvShow?.database).toBe('TVDB')
                expect(mm.tvShow?.airDate).toBe('2023-04-12')
                return true
            })
        })
    })

    it('NFO', async function () {
        this.timeout(6 * 60 * 1000)

        const { folder1 } = await import('test/actions/import-folders')
        await given(`TV show folder "${folder1.folderName}" was initialized with TVDB NFO`)

        await then('TV show panel shows the expected title and episode table with nfo prefix', async () => {
            const { default: Sidebar } = await import('test/componentobjects/Sidebar')
            await Sidebar.waitForFolderTitle('天使降临到了我身边！', 3 * 60 * 1000)
            await TvShowPanelCO.waitForTitleToBe('天使降临到了我身边！', 3 * 60 * 1000)
            await browser.pause(2000)

            expect(await TvShowPanelCO.toString()).toBe(`nfo
Season 0
S00E01 - - - -
S00E02 - - - -
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

        await then('metadata is persisted with TVDB tvshow id 355969', async () => {
            const folder = getStepContext()._folder as { path: string }
            await expectMediaMetadataViaBrowser(folder.path, (m: unknown) => {
                expect(m).toEqual({
                    mediaFolderPath: expect.any(String),
                    type: 'tvshow-folder',
                    files: [],
                    mediaFiles: [
                        {
                            absolutePath: expect.stringContaining('S01E01.mkv'),
                            episodeNumber: 1,
                            seasonNumber: 1,
                        },
                        {
                            absolutePath: expect.stringContaining('S01E02.mkv'),
                            episodeNumber: 2,
                            seasonNumber: 1,
                        },
                        {
                            absolutePath: expect.stringContaining('S01E03.mkv'),
                            episodeNumber: 3,
                            seasonNumber: 1,
                        },
                    ],
                    tvShow: {
                        id: '355969',
                        name: '天使降临到了我身边！',
                        database: 'TVDB',
                        seasons: [
                            {
                                season: 0,
                                name: '',
                                episodes: [
                                    { season: 0, episode: 1, name: '不會辜負期待啊 / 總是形影不離 / 換上這身衣服吧！ / 我是姐姐哦' },
                                    { season: 0, episode: 2, name: '私に天使が舞い降りた！プレシャス・フレンズ' },
                                ],
                            },
                            {
                                season: 1,
                                name: '',
                                episodes: [
                                    { season: 1, episode: 1, name: '心裏癢癢的感覺' },
                                    { season: 1, episode: 2, name: '超級無敵可愛' },
                                    { season: 1, episode: 3, name: '銘印' },
                                    { season: 1, episode: 4, name: '方便說兩句嗎？' },
                                    { season: 1, episode: 5, name: '好啦交給我來吧！' },
                                    { season: 1, episode: 6, name: '宮姐沒有朋友哦' },
                                    { season: 1, episode: 7, name: '聽不懂宮姐在說什麼' },
                                    { season: 1, episode: 8, name: '有些事情不知為妙' },
                                    { season: 1, episode: 9, name: '陪到我睡着哦' },
                                    { season: 1, episode: 10, name: '又多嘴了' },
                                    { season: 1, episode: 11, name: '也就是說是姐姐不好' },
                                    { season: 1, episode: 12, name: '天使的目光' },
                                ],
                            },
                        ],
                        airDate: '2019-01-08',
                    },
                })
                return true
            })
        })

        if (env.slowdown) {
            await delay(10 * 1000)
        }
    })
})
