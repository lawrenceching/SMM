import { expect } from '@wdio/globals'
import { TvShowPanelCO } from '../../componentobjects/TVShowPanel.co'
import { cleanup, expectMediaMetadataToBe } from '../../lib/testbed'
import { delay } from 'es-toolkit'
import { createAndImportFolder, type TestFolder, folder4, folder1 } from '../../actions/import-folders'
import { setup } from '../../lib/testbed'
import env from 'test/lib/env'
import type { MediaMetadata } from '@smm/core/types'
import ConfigDialog from 'test/componentobjects/ConfigDialog'
import Menu from 'test/componentobjects/Menu'
import path from 'path'
import Sidebar from 'test/componentobjects/Sidebar'
import TVShowPanel from 'test/componentobjects/TVShowPanel.co'
import fs from 'fs'
import { Path } from '@smm/core'

describe('Media Folder Initialization - TV Show - TVDB', () => {

    beforeEach(async () => {
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            openBrowserPage: true,
            resetUserConfig: true,
        })

        await Menu.openConfigDialog()
        if (env.slowdown) {
            await browser.pause(1000)
        }

        await ConfigDialog.waitForDisplayed()
        if (env.slowdown) {
            await browser.pause(1000)
        }

        await ConfigDialog.setPrimaryDatabase('TVDB')
        console.log(`set primary database to TVDB in ConfigDialog`)
        if (env.slowdown) {
            await browser.pause(1000)
        }

        await ConfigDialog.setPreferMediaLanguage('zh-CN')
        console.log(`set prefer media language to zh-CN in ConfigDialog`)
        if (env.slowdown) {
            await browser.pause(1000)
        }

        await ConfigDialog.clickSave()
        await ConfigDialog.pressEscape()
        await browser.pause(1000)
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

    it.only('Searching Folder Name', async function () {
        if (env.slowdown) {
            this.timeout(60 * 1000)
        }

        const folder = await createAndImportFolder({
            ...folder1,
            folderName: '天使降临到我身边',
        }, 'TVDB TV Show Media Folder Initialization:import media folder by searching folder name in TVDB');

        await delay(10 * 1000)

        expect(await TvShowPanelCO.immersiveInput.getValue()).toBe('天使降临到了我身边！')

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

        await expectMediaMetadataToBe(folder.path!, (obj) => {
            const mm = obj as MediaMetadata;
            expect(mm.tvShow).toBeDefined()
            expect(mm.tvShow?.id).toBe('355969')
            expect(mm.tvShow?.name).toBe('天使降临到了我身边！')
            expect(mm.tvShow?.database).toBe('TVDB')
            return true;
        })

    })

    it('TVDB ID in Folder Name', async function () {

        if (env.slowdown) {
            this.timeout(60 * 1000)
        }

        const folder = await createAndImportFolder(folder4, 'TVDB TV Show Media Folder Initialization:import media folder with tvdbid in folder name');

        await delay(30 * 1000)

        expect(await TvShowPanelCO.immersiveInput.getValue()).toBe('【我推的孩子】')

        const state = await TvShowPanelCO.toString()

        // folder4 - 我推的孩子 organized as 2 seasons in TMDB while 4 seasons in TVDB
        // So below assertion proved the media folder was initialized using data from TVDB
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

        await expectMediaMetadataToBe(folder.path!, (obj) => {
            const mm = obj as MediaMetadata;
            expect(mm.tvShow).toBeDefined()
            expect(mm.tvShow?.id).toBe('421069')
            expect(mm.tvShow?.name).toBe('【我推的孩子】')
            expect(mm.tvShow?.database).toBe('TVDB')
            expect(mm.tvShow?.airDate).toBe("2023-04-12")
            return true;
        })

    })

    it('NFO', async function () {
        if (env.slowdown) {
            this.timeout(60 * 1000)
        }

        const folder = await createAndImportFolder({
            ...folder1,
            folderName: "WhateverItIsToEnsureCannotRecognizeByFolderName"
        }, 'e2eTest:MediaFolderInitialization - TVShow NFO')
        const nfoXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<tvshow>
  <title>天使降临到我身边</title>
  <id>355969</id>
  <tvdbid>355969</tvdbid>
</tvshow>`
        fs.writeFileSync(path.join(folder.path!, 'tvshow.nfo'), nfoXml)

        if (env.slowdown) {
            await delay(5 * 1000)
        }

        await Sidebar.waitForFolder('天使降临到了我身边！', 60000);

        await TVShowPanel.waitForTitleToBe('天使降临到了我身边！')

        expect(await TVShowPanel.toString()).toBe(`nfo
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

        await expectMediaMetadataToBe(folder.path!, (m: MediaMetadata) => {

            expect(m).toEqual({
                "mediaFolderPath": Path.posix(folder.path!),
                "type": "tvshow-folder",
                "files": [],
                "mediaFiles": [
                    {
                        "absolutePath": Path.posix(path.join(folder.path!, 'S01E01.mkv')),
                        "episodeNumber": 1,
                        "seasonNumber": 1,
                    },
                    {
                        "absolutePath": Path.posix(path.join(folder.path!, 'S01E02.mkv')),
                        "episodeNumber": 2,
                        "seasonNumber": 1,
                    },
                    {
                        "absolutePath": Path.posix(path.join(folder.path!, 'S01E03.mkv')),
                        "episodeNumber": 3,
                        "seasonNumber": 1,
                    }
                ],
                "status": "ok",
                "tvShow": {
                    "id": "355969",
                    "name": "天使降临到了我身边！",
                    "database": "TVDB",
                    "seasons": [
                        {
                            "season": 0,
                            "name": "",
                            "episodes": [
                                {
                                    "season": 0,
                                    "episode": 1,
                                    "name": "不會辜負期待啊 / 總是形影不離 / 換上這身衣服吧！ / 我是姐姐哦"
                                },
                                {
                                    "season": 0,
                                    "episode": 2,
                                    "name": "私に天使が舞い降りた！プレシャス・フレンズ"
                                }
                            ]
                        },
                        {
                            "season": 1,
                            "name": "",
                            "episodes": [
                                {
                                    "season": 1,
                                    "episode": 1,
                                    "name": "心裏癢癢的感覺"
                                },
                                {
                                    "season": 1,
                                    "episode": 2,
                                    "name": "超級無敵可愛"
                                },
                                {
                                    "season": 1,
                                    "episode": 3,
                                    "name": "銘印"
                                },
                                {
                                    "season": 1,
                                    "episode": 4,
                                    "name": "方便說兩句嗎？"
                                },
                                {
                                    "season": 1,
                                    "episode": 5,
                                    "name": "好啦交給我來吧！"
                                },
                                {
                                    "season": 1,
                                    "episode": 6,
                                    "name": "宮姐沒有朋友哦"
                                },
                                {
                                    "season": 1,
                                    "episode": 7,
                                    "name": "聽不懂宮姐在說什麼\t"
                                },
                                {
                                    "season": 1,
                                    "episode": 8,
                                    "name": "有些事情不知為妙\t"
                                },
                                {
                                    "season": 1,
                                    "episode": 9,
                                    "name": "陪到我睡着哦"
                                },
                                {
                                    "season": 1,
                                    "episode": 10,
                                    "name": "又多嘴了"
                                },
                                {
                                    "season": 1,
                                    "episode": 11,
                                    "name": "也就是說是姐姐不好"
                                },
                                {
                                    "season": 1,
                                    "episode": 12,
                                    "name": "天使的目光"
                                }
                            ]
                        }
                    ],
                    "airDate": "2019-01-08"
                }
            })
            return true
        })

        if (env.slowdown) {
            await delay(10 * 1000)
        }

    })




})
