import { expect } from '@wdio/globals'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import Menu from '../../componentobjects/Menu'
import Sidebar from '../../componentobjects/Sidebar'
import TVShowPanel from '../../componentobjects/TVShowPanel.co'
import { setup, cleanup } from '../../lib/testbed'
import { delay } from 'es-toolkit'
import { createAndImportFolder, folder2 } from 'test/actions/import-folders'
import SearchboxCO from 'test/componentobjects/Searchbox.co'
import env from 'test/lib/env'
import type { UserConfig } from '@smm/core/types'

const tmpMediaRoot = path.join(os.tmpdir(), 'smm-test-media')
const mediaDir = path.join(tmpMediaRoot, 'media')

const folder2RecognizedTitles = [
    folder2.translations?.title?.['en-US'],
    folder2.translations?.title?.['zh-CN'],
    folder2.mediaName,
].filter((title): title is string => Boolean(title))

describe('Search Movie', () => {

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

    it('TMDB, English', async function() {
        this.timeout(90 * 1000)

        await createAndImportFolder(folder2, 'e2eTest:Search Movie')

        await Sidebar.waitForFolderName(folder2.folderName, 60000)
        await SearchboxCO.waitForTitleToBeOneOf(folder2RecognizedTitles, 60000)
        await SearchboxCO.input.click();


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

        if(env.slowdown) {
            await delay(5 * 1000)
        }
    })


    it('TVDB, Chinese', async function() {
        this.timeout(90 * 1000)

        await createAndImportFolder(folder2, 'e2eTest:Search Movie')

        await Sidebar.waitForFolderName(folder2.folderName, 60000)
        await SearchboxCO.waitForTitleToBeOneOf(folder2RecognizedTitles, 60000)
        await SearchboxCO.input.click()

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

        if(env.slowdown) {
            await delay(5 * 1000)
        }
    })

    it('TMDB, Chinese', async function() {
        this.timeout(90 * 1000)

        await createAndImportFolder(folder2, 'e2eTest:Search Movie')

        await Sidebar.waitForFolderName(folder2.folderName, 60000)
        await SearchboxCO.waitForTitleToBeOneOf(folder2RecognizedTitles, 60000)
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

        if(env.slowdown) {
            await delay(5 * 1000)
        }
    })

    it('TMDB, Japanese', async function() {
        this.timeout(90 * 1000)

        await createAndImportFolder(folder2, 'e2eTest:Search Movie')

        await Sidebar.waitForFolderName(folder2.folderName, 60000)
        await SearchboxCO.waitForTitleToBeOneOf(folder2RecognizedTitles, 60000)
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

        if(env.slowdown) {
            await delay(5 * 1000)
        }
    })


})
