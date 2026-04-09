import { expect, browser } from '@wdio/globals'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { fileURLToPath } from 'node:url'
import Menu from '../../componentobjects/Menu'
import Sidebar from '../../componentobjects/Sidebar'
import TVShowPanel, {  } from '../../componentobjects/TVShowPanel.co'
import { cleanup, expectMediaMetadataToBe, setup } from '../../lib/testbed'
import { delay } from 'es-toolkit'
import { folder1, createAndImportFolder } from '../../actions/import-folders'
import type { MediaMetadata } from '@smm/core/types'
import ConfigDialog from 'test/componentobjects/ConfigDialog'
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

        await Menu.openConfigDialog()
        if (env.slowdown) {
            await browser.pause(1000)
        }

        await ConfigDialog.waitForDisplayed()
        if (env.slowdown) {
            await browser.pause(1000)
        }

        await ConfigDialog.setPrimaryDatabase('TMDB')
        console.log(`set primary database to TVDB in ConfigDialog`)
        if (env.slowdown) {
            await browser.pause(1000)
        }

        await ConfigDialog.setPreferMediaLanguage('en-US')
        console.log(`set prefer media language to en-US in ConfigDialog`)
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

    it('Folder Name', async function () {
        if (env.slowdown) {
            this.timeout(60 * 1000)
        }

        const folder = await createAndImportFolder({
            ...folder1,
            folderName: folder1.mediaName!
        }, 'e2eTest:Import Media Folder')

        if (env.slowdown) {
            await delay(5 * 1000)
        }

        await Sidebar.waitForFolder(folder1.translations?.title?.['en-US'] ?? 'N/A', 60000);

        await TVShowPanel.waitForTitleToBe(folder1.translations?.title?.['en-US'] ?? 'N/A')

        expect(await TVShowPanel.toString()).toBe(`Specials
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

        await expectMediaMetadataToBe(folder.path!, (m: MediaMetadata) => {
            expect(m.tvShow).toEqual({
                "airDate": "2019-01-08",
                "database": "TMDB",
                "id": "84666",
                "name": "WATATEN!: an Angel Flew Down to Me",
                "seasons": [
                    {
                        "episodes": [
                            {
                                "episode": 1,
                                "name": "You Never Let Us Down / Always Growing Closer / Let's Change You Into This! / I'm Your Big Sister",
                                "season": 0,
                            },
                        ],
                        "name": "Specials",
                        "season": 0,
                    },
                    {
                        "episodes": [
                            {
                                "episode": 1,
                                "name": "A Funny, Squirmy Feeling",
                                "season": 1,
                            },
                            {
                                "episode": 2,
                                "name": "Incontestably Cute",
                                "season": 1,
                            },
                            {
                                "episode": 3,
                                "name": "Imprinting",
                                "season": 1,
                            },
                            {
                                "episode": 4,
                                "name": "Can We Talk for a Moment?",
                                "season": 1,
                            },
                            {
                                "episode": 5,
                                "name": "Don't Worry! Leave It to Me!",
                                "season": 1,
                            },
                            {
                                "episode": 6,
                                "name": "Mya-nee Doesn't Have Any Friends",
                                "season": 1,
                            },
                            {
                                "episode": 7,
                                "name": "I Don't Understand What Mya-nee Is Saying",
                                "season": 1,
                            },
                            {
                                "episode": 8,
                                "name": "Sometimes Ignorance Is Bliss",
                                "season": 1,
                            },
                            {
                                "episode": 9,
                                "name": "Please Stay Until I Fall Asleep",
                                "season": 1,
                            },
                            {
                                "episode": 10,
                                "name": "I Said Too Much Again",
                                "season": 1,
                            },
                            {
                                "episode": 11,
                                "name": "In Short, It's Your Fault, Onee-san",
                                "season": 1,
                            },
                            {
                                "episode": 12,
                                "name": "Angel's Gaze",
                                "season": 1,
                            },
                        ],
                        "name": "Season 1",
                        "season": 1,
                    },
                ],
            })
            return true
        })

        if (env.slowdown) {
            await delay(10 * 1000)
        }
    })

    it('Searching Folder Name', async function () {
        if (env.slowdown) {
            this.timeout(60 * 1000)
        }

        const folder = await createAndImportFolder(folder1, 'e2eTest:Import Media Folder')

        if (env.slowdown) {
            await delay(5 * 1000)
        }

        await Sidebar.waitForFolder(folder1.translations?.title?.['en-US'] ?? 'N/A', 60000);

        await TVShowPanel.waitForTitleToBe(folder1.translations?.title?.['en-US'] ?? 'N/A')

        expect(await TVShowPanel.toString()).toBe(`Specials
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

        await expectMediaMetadataToBe(folder.path!, (m: MediaMetadata) => {
            expect(m.tvShow).toEqual({
                "airDate": "2019-01-08",
                "database": "TMDB",
                "id": "84666",
                "name": "WATATEN!: an Angel Flew Down to Me",
                "seasons": [
                    {
                        "episodes": [
                            {
                                "episode": 1,
                                "name": "You Never Let Us Down / Always Growing Closer / Let's Change You Into This! / I'm Your Big Sister",
                                "season": 0,
                            },
                        ],
                        "name": "Specials",
                        "season": 0,
                    },
                    {
                        "episodes": [
                            {
                                "episode": 1,
                                "name": "A Funny, Squirmy Feeling",
                                "season": 1,
                            },
                            {
                                "episode": 2,
                                "name": "Incontestably Cute",
                                "season": 1,
                            },
                            {
                                "episode": 3,
                                "name": "Imprinting",
                                "season": 1,
                            },
                            {
                                "episode": 4,
                                "name": "Can We Talk for a Moment?",
                                "season": 1,
                            },
                            {
                                "episode": 5,
                                "name": "Don't Worry! Leave It to Me!",
                                "season": 1,
                            },
                            {
                                "episode": 6,
                                "name": "Mya-nee Doesn't Have Any Friends",
                                "season": 1,
                            },
                            {
                                "episode": 7,
                                "name": "I Don't Understand What Mya-nee Is Saying",
                                "season": 1,
                            },
                            {
                                "episode": 8,
                                "name": "Sometimes Ignorance Is Bliss",
                                "season": 1,
                            },
                            {
                                "episode": 9,
                                "name": "Please Stay Until I Fall Asleep",
                                "season": 1,
                            },
                            {
                                "episode": 10,
                                "name": "I Said Too Much Again",
                                "season": 1,
                            },
                            {
                                "episode": 11,
                                "name": "In Short, It's Your Fault, Onee-san",
                                "season": 1,
                            },
                            {
                                "episode": 12,
                                "name": "Angel's Gaze",
                                "season": 1,
                            },
                        ],
                        "name": "Season 1",
                        "season": 1,
                    },
                ],
            })
            return true
        })

        if (env.slowdown) {
            await delay(10 * 1000)
        }
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
  <id>84666</id>
  <tmdbid>84666</tmdbid>
</tvshow>`
        fs.writeFileSync(path.join(folder.path!, 'tvshow.nfo'), nfoXml)

        if (env.slowdown) {
            await delay(5 * 1000)
        }

        await Sidebar.waitForFolder(folder1.translations?.title?.['en-US'] ?? 'N/A', 60000);

        await TVShowPanel.waitForTitleToBe(folder1.translations?.title?.['en-US'] ?? 'N/A')

        expect(await TVShowPanel.toString()).toBe(`nfo
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

        await expectMediaMetadataToBe(folder.path!, (m: MediaMetadata) => {
            expect(m.tvShow).toEqual({
                "airDate": "2019-01-08",
                "database": "TMDB",
                "id": "84666",
                "name": "WATATEN!: an Angel Flew Down to Me",
                "seasons": [
                    {
                        "episodes": [
                            {
                                "episode": 1,
                                "name": "You Never Let Us Down / Always Growing Closer / Let's Change You Into This! / I'm Your Big Sister",
                                "season": 0,
                            },
                        ],
                        "name": "Specials",
                        "season": 0,
                    },
                    {
                        "episodes": [
                            {
                                "episode": 1,
                                "name": "A Funny, Squirmy Feeling",
                                "season": 1,
                            },
                            {
                                "episode": 2,
                                "name": "Incontestably Cute",
                                "season": 1,
                            },
                            {
                                "episode": 3,
                                "name": "Imprinting",
                                "season": 1,
                            },
                            {
                                "episode": 4,
                                "name": "Can We Talk for a Moment?",
                                "season": 1,
                            },
                            {
                                "episode": 5,
                                "name": "Don't Worry! Leave It to Me!",
                                "season": 1,
                            },
                            {
                                "episode": 6,
                                "name": "Mya-nee Doesn't Have Any Friends",
                                "season": 1,
                            },
                            {
                                "episode": 7,
                                "name": "I Don't Understand What Mya-nee Is Saying",
                                "season": 1,
                            },
                            {
                                "episode": 8,
                                "name": "Sometimes Ignorance Is Bliss",
                                "season": 1,
                            },
                            {
                                "episode": 9,
                                "name": "Please Stay Until I Fall Asleep",
                                "season": 1,
                            },
                            {
                                "episode": 10,
                                "name": "I Said Too Much Again",
                                "season": 1,
                            },
                            {
                                "episode": 11,
                                "name": "In Short, It's Your Fault, Onee-san",
                                "season": 1,
                            },
                            {
                                "episode": 12,
                                "name": "Angel's Gaze",
                                "season": 1,
                            },
                        ],
                        "name": "Season 1",
                        "season": 1,
                    },
                ],
            })
            return true
        })

        if (env.slowdown) {
            await delay(10 * 1000)
        }

    })

    it('Unknown', async function () {
        this.timeout(15 * 1000)

        await createAndImportFolder({
            ...folder1,
            folderName: "WhateverItIsToEnsureCannotRecognizeByFolderName"
        }, 'e2eTest:MediaFolderInitialization - TVShow Unknown')

        const immersiveInput = await $('[data-testid="immersive-input"]')
        await immersiveInput.waitForDisplayed({ timeout: 5000 })
        const value = await immersiveInput.getValue()
        expect(value).toBe('')
    })
})
