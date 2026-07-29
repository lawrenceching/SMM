import { browser } from '@wdio/globals'
import { setup, cleanup } from 'test/lib/testbed'
import {
    clearFolderViaBrowser,
    createAndImportFolderViaBrowser,
    resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'
import { delay } from 'es-toolkit'
import { folder2 } from 'test/actions/import-folders'
import Sidebar from 'test/componentobjects/Sidebar'
import SearchboxCO from 'test/componentobjects/Searchbox.co'
import env from 'test/lib/env'
import type { UserConfig } from '@smm/core/types'

import { testbedOs } from 'test/lib/e2e-platform'

const folder2RecognizedTitles = [
    folder2.translations?.title?.['en-US'],
    folder2.translations?.title?.['zh-CN'],
    folder2.mediaName,
].filter((title): title is string => Boolean(title))

const TITLE_WAIT_MS = 3 * 60 * 1000

/**
 * @supports local, Electron, HarmonyOS, Docker
 */
describe('Search Movie', () => {
    let testFolder = ''

    beforeEach(async () => {
        await setup({
            removeMetadataDir: true,
            removePlansDir: true,
            removeMediaFolders: true,
            removeDirInSidebar: true,
            openBrowserPage: true,
            resetUserConfig: (config: UserConfig) => {
                config.preferMediaLanguage = 'en-US'
                return config
            },
            os: testbedOs,
        })

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

    it('TMDB, English', async function () {
        this.timeout(6 * 60 * 1000)

        await createAndImportFolderViaBrowser(folder2, 'e2eTest:Search Movie')

        await Sidebar.waitForFolderName(folder2.folderName, 60000)
        // folder2 has no {tmdbid=} — Ohos folder-name search can exceed 60s.
        await SearchboxCO.waitForTitleToBeOneOf(folder2RecognizedTitles, TITLE_WAIT_MS)
        await SearchboxCO.input.click()

        await SearchboxCO.setDatabase('TMDB')
        await SearchboxCO.setLanguage('en-US')

        await SearchboxCO.searchButton.waitForClickable()
        await SearchboxCO.searchButton.click()

        await browser.waitUntil(async () => {
            const results = await SearchboxCO.results
            return (await results.length) > 0
        }, {
            timeout: 10000,
            interval: 1000,
            timeoutMsg: 'Expected to see search results',
        })

        if (env.slowdown) {
            await delay(5 * 1000)
        }
    })

    // TODO: Unable to search movie by chinese keyword in TVDB, such as "蝙蝠侠"
    it.skip('TVDB, Chinese', async function () {
        this.timeout(6 * 60 * 1000)

        await createAndImportFolderViaBrowser(folder2, 'e2eTest:Search Movie')

        await Sidebar.waitForFolderName(folder2.folderName, 60000)
        await SearchboxCO.waitForTitleToBeOneOf(folder2RecognizedTitles, TITLE_WAIT_MS)
        await SearchboxCO.input.click()
        await SearchboxCO.input.setValue('蝙蝠侠')

        await SearchboxCO.setDatabase('TVDB')
        await SearchboxCO.setLanguage('zho')

        await SearchboxCO.searchButton.waitForClickable()
        await SearchboxCO.searchButton.click()

        await browser.waitUntil(async () => {
            const results = await SearchboxCO.results
            return (await results.length) > 0
        }, {
            timeout: 10000,
            interval: 1000,
            timeoutMsg: 'Expected to see search results',
        })

        if (env.slowdown) {
            await delay(5 * 1000)
        }
    })

    it('TMDB, Chinese', async function () {
        this.timeout(6 * 60 * 1000)

        await createAndImportFolderViaBrowser(folder2, 'e2eTest:Search Movie')

        await Sidebar.waitForFolderName(folder2.folderName, 60000)
        await SearchboxCO.waitForTitleToBeOneOf(folder2RecognizedTitles, TITLE_WAIT_MS)
        await SearchboxCO.input.click()

        await SearchboxCO.setDatabase('TMDB')
        await SearchboxCO.setLanguage('zh-CN')

        await SearchboxCO.searchButton.waitForClickable()
        await SearchboxCO.searchButton.click()

        await browser.waitUntil(async () => {
            const results = await SearchboxCO.results
            return (await results.length) > 0
        }, {
            timeout: 10000,
            interval: 1000,
            timeoutMsg: 'Expected to see search results',
        })

        if (env.slowdown) {
            await delay(5 * 1000)
        }
    })

    it('TMDB, Japanese', async function () {
        this.timeout(6 * 60 * 1000)

        await createAndImportFolderViaBrowser(folder2, 'e2eTest:Search Movie')

        await Sidebar.waitForFolderName(folder2.folderName, 60000)
        await SearchboxCO.waitForTitleToBeOneOf(folder2RecognizedTitles, TITLE_WAIT_MS)
        await SearchboxCO.input.click()

        await SearchboxCO.setDatabase('TMDB')
        await SearchboxCO.setLanguage('ja-JP')

        await SearchboxCO.searchButton.waitForClickable()
        await SearchboxCO.searchButton.click()

        await browser.waitUntil(async () => {
            const results = await SearchboxCO.results
            return (await results.length) > 0
        }, {
            timeout: 10000,
            interval: 1000,
            timeoutMsg: 'Expected to see search results',
        })

        if (env.slowdown) {
            await delay(5 * 1000)
        }
    })
})
